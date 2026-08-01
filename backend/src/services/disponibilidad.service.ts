import { prisma } from '../config/prisma'

// Grilla de horarios candidatos y antelación mínima para reservar (no documentadas en
// las HU/CU — decisión tomada para esta función, no confundir con la ventana de 60 min
// de cancelación/reprogramación de CU-02).
const PASO_MINUTOS = 20
const MARGEN_MINIMO_MINUTOS = 30

const MINUTO_MS = 60_000

export interface Franja {
  horaInicio: Date
  horaFin: Date
}

export interface Intervalo {
  inicio: Date
  fin: Date
}

export interface ParametrosDia {
  fecha: Date
  franjas: Franja[]
  ocupados: Intervalo[]
  feriadoBloquea: boolean
  duracionMinutos: number
  ahora: Date
}

// Argentina es UTC-3 fijo (sin horario de verano). El server puede correr en cualquier
// huso (Render suele usar UTC); esto da el "ahora" en hora de pared de Argentina,
// consistente con cómo se leen fecha/hora desde Postgres (ver combinarFechaHora).
export function ahoraArgentina(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}

// Postgres devuelve DATE y TIME como Date de JS ancladas en UTC (TIME queda con fecha
// 1970-01-01). Se combinan leyendo/escribiendo siempre con los getters/setters UTC, sin
// pasar por hora local del server — no hay conversión de huso, son valores de pared.
export function combinarFechaHora(fecha: Date, hora: Date): Date {
  return new Date(
    Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate(),
      hora.getUTCHours(),
      hora.getUTCMinutes(),
      hora.getUTCSeconds(),
    ),
  )
}

function seSolapan(
  aInicio: Date,
  aFin: Date,
  bInicio: Date,
  bFin: Date,
): boolean {
  return aInicio < bFin && bInicio < aFin
}

export function formatearHora(fecha: Date): string {
  const horas = String(fecha.getUTCHours()).padStart(2, '0')
  const minutos = String(fecha.getUTCMinutes()).padStart(2, '0')
  return `${horas}:${minutos}`
}

export function formatearFecha(fecha: Date): string {
  const anio = fecha.getUTCFullYear()
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getUTCDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Función pura (sin Prisma): dado un día ya resuelto, devuelve los horarios "HH:mm"
 * válidos para reservar un servicio de `duracionMinutos`. Cubre CU-04:
 * 1-3. Un candidato solo se ofrece si entra completo dentro de una franja laboral
 *      (el descanso entre franjas nunca genera candidatos, por diseño).
 * 4.   Se descartan los que solapan con un turno activo o un bloqueo.
 * Además: si es feriado bloqueado no hay horarios, y no se ofrece nada dentro del
 * margen mínimo de reserva.
 */
export function calcularHorariosDelDia(params: ParametrosDia): string[] {
  const { fecha, franjas, ocupados, feriadoBloquea, duracionMinutos, ahora } =
    params

  if (feriadoBloquea) return []

  const duracionMs = duracionMinutos * MINUTO_MS
  const limite = new Date(ahora.getTime() + MARGEN_MINIMO_MINUTOS * MINUTO_MS)

  const horarios: string[] = []

  for (const franja of franjas) {
    const horaInicioFranja = combinarFechaHora(fecha, franja.horaInicio)
    const horaFinFranja = combinarFechaHora(fecha, franja.horaFin)

    let candidato = horaInicioFranja
    while (candidato.getTime() + duracionMs <= horaFinFranja.getTime()) {
      const finCandidato = new Date(candidato.getTime() + duracionMs)

      const libre =
        candidato.getTime() >= limite.getTime() &&
        !ocupados.some((o) =>
          seSolapan(candidato, finCandidato, o.inicio, o.fin),
        )

      if (libre) horarios.push(formatearHora(candidato))

      candidato = new Date(candidato.getTime() + PASO_MINUTOS * MINUTO_MS)
    }
  }

  return horarios
}

export class ServicioNoDisponibleError extends Error {}

/**
 * Punto de entrada real: trae de Prisma lo que hace falta para cada día del rango y
 * llama a `calcularHorariosDelDia`. Esta es la función que van a reusar reservar,
 * reprogramar y la carga manual de turnos — cualquier cambio de reglas pasa por acá.
 */
export async function calcularDisponibilidad(
  servicioId: string,
  desde: Date,
  hasta: Date,
): Promise<Array<{ fecha: string; horarios: string[] }>> {
  const servicio = await prisma.servicio.findUnique({
    where: { id: servicioId },
  })
  if (!servicio || !servicio.activo) {
    throw new ServicioNoDisponibleError()
  }

  const ahora = ahoraArgentina()
  const resultado: Array<{ fecha: string; horarios: string[] }> = []

  for (
    let fecha = desde;
    fecha.getTime() <= hasta.getTime();
    fecha = new Date(fecha.getTime() + 24 * 60 * MINUTO_MS)
  ) {
    const diaSemana = fecha.getUTCDay()

    const [feriado, franjasDb, bloqueos, turnos] = await Promise.all([
      prisma.feriado.findUnique({ where: { fecha } }),
      prisma.horarioLaboral.findMany({ where: { diaSemana } }),
      prisma.bloqueoHorario.findMany({
        where: { fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } },
      }),
      prisma.turno.findMany({ where: { fecha, estado: 'reservado' } }),
    ])

    if (franjasDb.length === 0 || feriado?.bloquea) {
      resultado.push({ fecha: formatearFecha(fecha), horarios: [] })
      continue
    }

    const franjas: Franja[] = franjasDb.map((f) => ({
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
    }))

    // Un bloqueo con hora en null cubre desde el inicio/hasta el cierre real de ese
    // día (mín/máx de las franjas), no medianoche — así lo define modelo-datos.md.
    const inicioDelDia = combinarFechaHora(
      fecha,
      franjas.reduce(
        (min, f) => (f.horaInicio < min ? f.horaInicio : min),
        franjas[0].horaInicio,
      ),
    )
    const finDelDia = combinarFechaHora(
      fecha,
      franjas.reduce(
        (max, f) => (f.horaFin > max ? f.horaFin : max),
        franjas[0].horaFin,
      ),
    )

    const ocupados: Intervalo[] = [
      ...turnos.map((t) => ({
        inicio: combinarFechaHora(fecha, t.horaInicio),
        fin: combinarFechaHora(fecha, t.horaFin),
      })),
      ...bloqueos.map((b) => ({
        inicio: b.horaInicio
          ? combinarFechaHora(fecha, b.horaInicio)
          : inicioDelDia,
        fin: b.horaFin ? combinarFechaHora(fecha, b.horaFin) : finDelDia,
      })),
    ]

    const horarios = calcularHorariosDelDia({
      fecha,
      franjas,
      ocupados,
      feriadoBloquea: false,
      duracionMinutos: servicio.duracionMinutos,
      ahora,
    })

    resultado.push({ fecha: formatearFecha(fecha), horarios })
  }

  return resultado
}
