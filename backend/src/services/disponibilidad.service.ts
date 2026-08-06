import { prisma } from '../config/prisma'
import {
  combinarFechaHora,
  formatearFecha,
  formatearHora,
  ahoraArgentina,
  seSolapan,
} from '../utils/fechaHora'
import { ServicioNoDisponibleError } from './errores'
import type { Servicio } from '../../generated/prisma/client.ts'

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
  // Margen mínimo antes de "ahora" para ofrecer un horario. Default: el de reserva
  // online (30 min). Las acciones de Ariel (carga manual, mover un turno) pasan 0 —
  // no tiene sentido protegerlo de sí mismo.
  margenMinutos?: number
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
  const margenMinutos = params.margenMinutos ?? MARGEN_MINIMO_MINUTOS

  if (feriadoBloquea) return []

  const duracionMs = duracionMinutos * MINUTO_MS
  const limite = new Date(ahora.getTime() + margenMinutos * MINUTO_MS)

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

/**
 * Trae de Prisma todo lo que hace falta para UN día (feriado, franjas, bloqueos, turnos
 * activos) y llama a `calcularHorariosDelDia`. Esta es la única función que consulta
 * disponibilidad real — `calcularDisponibilidad` (rango) y `crearTurno` (un día) pasan
 * siempre por acá, tal como pide CU-04.
 */
export interface OpcionesHorariosDelDia {
  // Para HU-09 (mover un turno): no chocar contra sí mismo en la lista de ocupados.
  excluirTurnoId?: string
  margenMinutos?: number
}

/** Por qué un día no tiene horarios. Sin esto el frontend solo ve una lista vacía y no
 * puede distinguir "Ariel no atiende los lunes" de "se llenó": termina mostrando el
 * mismo cartel genérico para situaciones que piden respuestas distintas del cliente. */
export type EstadoDia =
  | 'disponible'
  | 'cerrado' // no hay franjas laborales ese día de la semana
  | 'feriado'
  | 'bloqueado' // Ariel bloqueó el día entero (vacaciones, un trámite…)
  | 'completo' // atiende, pero no queda ningún hueco libre

export interface DetalleDia {
  horarios: string[]
  estado: EstadoDia
  /** Lo que Ariel escribió al bloquear o el nombre del feriado, si corresponde. */
  motivo: string | null
}

export async function obtenerDetalleDelDia(
  servicio: Pick<Servicio, 'duracionMinutos'>,
  fecha: Date,
  ahora: Date,
  opciones: OpcionesHorariosDelDia = {},
): Promise<DetalleDia> {
  const diaSemana = fecha.getUTCDay()

  const [feriado, franjasDb, bloqueos, turnos] = await Promise.all([
    prisma.feriado.findUnique({ where: { fecha } }),
    prisma.horarioLaboral.findMany({ where: { diaSemana } }),
    prisma.bloqueoHorario.findMany({
      where: { fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } },
    }),
    prisma.turno.findMany({
      where: {
        fecha,
        estado: 'reservado',
        ...(opciones.excluirTurnoId
          ? { id: { not: opciones.excluirTurnoId } }
          : {}),
      },
    }),
  ])

  if (franjasDb.length === 0) {
    return { horarios: [], estado: 'cerrado', motivo: null }
  }
  if (feriado?.bloquea) {
    return { horarios: [], estado: 'feriado', motivo: feriado.nombre }
  }

  const franjas: Franja[] = franjasDb.map((f) => ({
    horaInicio: f.horaInicio,
    horaFin: f.horaFin,
  }))

  // Un bloqueo con hora en null cubre desde el inicio/hasta el cierre real de ese día
  // (mín/máx de las franjas), no medianoche — así lo define modelo-datos.md.
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
    margenMinutos: opciones.margenMinutos,
  })

  if (horarios.length > 0) {
    return { horarios, estado: 'disponible', motivo: null }
  }

  // Sin horarios: distinguimos "Ariel cerró el día" de "se llenó". Un bloqueo que tapa
  // el día entero es lo primero; si además dejó un motivo, se lo mostramos al cliente,
  // que es mucho más útil que un "no hay turnos" a secas.
  const bloqueoDelDiaCompleto = bloqueos.find(
    (b) =>
      (b.horaInicio ? combinarFechaHora(fecha, b.horaInicio) : inicioDelDia) <=
        inicioDelDia &&
      (b.horaFin ? combinarFechaHora(fecha, b.horaFin) : finDelDia) >=
        finDelDia,
  )
  if (bloqueoDelDiaCompleto) {
    return { horarios, estado: 'bloqueado', motivo: bloqueoDelDiaCompleto.motivo }
  }

  return { horarios, estado: 'completo', motivo: null }
}

/** Igual que `obtenerDetalleDelDia` pero devolviendo solo los horarios. La usan los
 * flujos que validan una reserva (crear, reprogramar, editar), a los que el motivo no
 * les aporta nada. */
export async function obtenerHorariosDelDia(
  servicio: Pick<Servicio, 'duracionMinutos'>,
  fecha: Date,
  ahora: Date,
  opciones: OpcionesHorariosDelDia = {},
): Promise<string[]> {
  return (await obtenerDetalleDelDia(servicio, fecha, ahora, opciones)).horarios
}

export async function obtenerServicioActivo(
  servicioId: string,
): Promise<Servicio> {
  const servicio = await prisma.servicio.findUnique({
    where: { id: servicioId },
  })
  if (!servicio || !servicio.activo) throw new ServicioNoDisponibleError()
  return servicio
}

export interface DisponibilidadDia extends DetalleDia {
  fecha: string
}

export async function calcularDisponibilidad(
  servicioId: string,
  desde: Date,
  hasta: Date,
): Promise<DisponibilidadDia[]> {
  const servicio = await obtenerServicioActivo(servicioId)
  const ahora = ahoraArgentina()
  const resultado: DisponibilidadDia[] = []

  for (
    let fecha = desde;
    fecha.getTime() <= hasta.getTime();
    fecha = new Date(fecha.getTime() + 24 * 60 * MINUTO_MS)
  ) {
    const detalle = await obtenerDetalleDelDia(servicio, fecha, ahora)
    resultado.push({ fecha: formatearFecha(fecha), ...detalle })
  }

  return resultado
}
