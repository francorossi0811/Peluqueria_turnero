import { prisma } from '../config/prisma'
import {
  combinarFechaHora,
  formatearFecha,
  formatearHora,
  ahoraArgentina,
  seSolapan,
} from '../utils/fechaHora'
import { ServicioNoDisponibleError } from './errores'
import type {
  ModalidadFeriado,
  Servicio,
} from '../../generated/prisma/client.ts'

// Grilla de horarios candidatos y antelación mínima para reservar (no documentadas en
// las HU/CU — decisión tomada para esta función, no confundir con la ventana de 60 min
// de cancelación/reprogramación de CU-02).
const PASO_MINUTOS = 20
const MARGEN_MINIMO_MINUTOS = 30

/** HU-08 — Hasta cuántos días atrás puede Ariel registrar un turno que ya atendió.
 *
 * Vive acá, al lado de las otras dos, porque es la tercera regla de la misma familia:
 * qué momentos existen para reservar. La duplica el frontend (`utils/fecha.ts`) con la
 * nota de siempre: allá dibuja, acá manda.
 *
 * El tope existe porque sin él la API acepta un turno en 2019 y la agenda deja de ser un
 * registro de lo que pasó. */
export const DIAS_PASADOS_ADMIN = 7

/** HU-28 — Hasta cuántos días adelante puede reservar un cliente por la web.
 *
 * La cuarta regla de la misma familia que las tres de arriba, y por eso vive al lado:
 * qué momentos existen para reservar.
 *
 * Existe porque no había ningún tope y la API aceptaba un turno para 2027. Sin seña ni
 * teléfono verificado, la agenda entera de los próximos años estaba a un request de
 * distancia. Ariel **no** tiene este límite: él ya toma turnos a meses vista y el tope es
 * para el que reserva por la web, no para el dueño. */
export const DIAS_FUTURO_PUBLICO = 90

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
  /** HU-08 — Ofrecer también los horarios que ya pasaron. Solo lo enciende la carga
   * manual de Ariel: atiende clientes de vidriera y los registra cuando tiene un rato.
   *
   * Cuando es `true`, el filtro contra "ahora" no se aplica y `margenMinutos` deja de
   * mirarse: no hay antelación que exigirle a un momento que ya ocurrió.
   *
   * Es un flag y no un `margenMinutos` negativo a propósito. Un número negativo mezclaría
   * dos conceptos ("cuánta antelación exijo" y "cuánto pasado admito") en la misma
   * variable, y dejaría sin sentido el test que fija el default de 30 min del cliente.
   *
   * ⚠️ NO afloja el cierre: quien decide que el turno entre completo
   * (`inicio + duración <= cierre`, CU-04) es `candidatosDeLaFranja`, que ni siquiera
   * genera los que no entran, y este flag no lo toca. */
  permitirPasado?: boolean
}

/** En qué momentos podría **empezar** un turno de `duracionMs` dentro de esta franja.
 *
 * Son dos fuentes, y la segunda es la que hace que la agenda no desperdicie ratos:
 *
 * 1. La grilla de `PASO_MINUTOS` anclada al inicio de la franja: los horarios "redondos"
 *    de siempre (10:00, 10:20, 10:40…).
 * 2. **El final de cada rato ocupado.** Sin esto la grilla nunca se re-ancla a lo que ya
 *    está agendado, y entre que un turno termina y llega el próximo múltiplo de 20 queda
 *    un hueco que el sistema no ofrece aunque esté libre: una Barba de 15 minutos a las
 *    17:00 termina 17:15 y el siguiente horario ofrecido era 17:20; un Corte + Barba de 30
 *    a las 18:00 termina 18:30 y el siguiente era 18:40. Con la agenda llena eso son 5 a 10
 *    minutos tirados por turno.
 *
 * La cadena se arma sola: si alguien reserva a las 17:15 un corte de 20 minutos, ese turno
 * termina 17:35 y en el próximo cálculo 17:35 ya es candidato. No hace falta nada más.
 *
 * ⚠️ El candidato pegado al final de otro turno pasa por **el mismo filtro de cierre** que
 * los de la grilla (`inicio + duración <= fin de franja`, CU-04): entra en el `Set` solo si
 * el turno completo sigue entrando antes de que Ariel cierre.
 *
 * Sale ordenado y sin repetidos: un turno que termina justo sobre la grilla (20 minutos a
 * las 17:00 → 17:20) no tiene que ofrecer el mismo horario dos veces.
 */
function candidatosDeLaFranja(
  inicioFranja: Date,
  finFranja: Date,
  duracionMs: number,
  ocupados: Intervalo[],
): Date[] {
  const entraCompleto = (desde: number) =>
    desde >= inicioFranja.getTime() &&
    desde + duracionMs <= finFranja.getTime()

  const momentos = new Set<number>()

  for (
    let t = inicioFranja.getTime();
    t + duracionMs <= finFranja.getTime();
    t += PASO_MINUTOS * MINUTO_MS
  ) {
    momentos.add(t)
  }

  for (const ocupado of ocupados) {
    const fin = ocupado.fin.getTime()
    if (entraCompleto(fin)) momentos.add(fin)
  }

  return [...momentos].sort((a, b) => a - b).map((t) => new Date(t))
}

/**
 * Función pura (sin Prisma): dado un día ya resuelto, devuelve los horarios "HH:mm"
 * válidos para reservar un servicio de `duracionMinutos`. Cubre CU-04:
 * 1-3. Un candidato solo se ofrece si entra completo dentro de una franja laboral
 *      (el descanso entre franjas nunca genera candidatos, por diseño).
 * 4.   Se descartan los que solapan con un turno activo o un bloqueo.
 * Además: si es feriado bloqueado no hay horarios, y no se ofrece nada dentro del
 * margen mínimo de reserva.
 *
 * Los candidatos no son solo la grilla de 20 minutos — ver `candidatosDeLaFranja`.
 */
export function calcularHorariosDelDia(params: ParametrosDia): string[] {
  const { fecha, franjas, ocupados, feriadoBloquea, duracionMinutos, ahora } =
    params
  const margenMinutos = params.margenMinutos ?? MARGEN_MINIMO_MINUTOS
  const permitirPasado = params.permitirPasado ?? false

  if (feriadoBloquea) return []

  const duracionMs = duracionMinutos * MINUTO_MS
  const limite = new Date(ahora.getTime() + margenMinutos * MINUTO_MS)

  const horarios: string[] = []

  for (const franja of franjas) {
    const horaInicioFranja = combinarFechaHora(fecha, franja.horaInicio)
    const horaFinFranja = combinarFechaHora(fecha, franja.horaFin)

    const candidatos = candidatosDeLaFranja(
      horaInicioFranja,
      horaFinFranja,
      duracionMs,
      ocupados,
    )

    for (const candidato of candidatos) {
      const finCandidato = new Date(candidato.getTime() + duracionMs)

      const noEsDemasiadoPronto =
        permitirPasado || candidato.getTime() >= limite.getTime()

      const libre =
        noEsDemasiadoPronto &&
        !ocupados.some((o) =>
          seSolapan(candidato, finCandidato, o.inicio, o.fin),
        )

      if (libre) horarios.push(formatearHora(candidato))
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
  permitirPasado?: boolean
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
  /** Lo que Ariel escribió al bloquear, o el nombre del feriado.
   *
   * Ojo: **puede venir con `estado: 'disponible'`**. Un feriado de medio día es un día
   * que atiende, pero con menos horario del habitual, y el cliente necesita entender por
   * qué ve tan pocos huecos. Antes `motivo` solo aparecía cuando no había nada. */
  motivo: string | null
}

/** Aplica la modalidad del feriado sobre las franjas del día (HU-24).
 *
 * Función pura y separada para poder testear la regla sin base de datos, que es donde
 * están los casos que importan.
 *
 * `medio_dia` es el default de la tabla porque es lo que Ariel hace de verdad, y se
 * resuelve como **la primera franja del día** — no como "la mañana". La diferencia
 * importa: si algún día cambia sus horarios, la regla lo sigue sola sin tocar código.
 * Si el día tiene una sola franja, medio día y día completo son lo mismo, que es la
 * respuesta correcta. */
export function franjasSegunFeriado(
  franjas: Franja[],
  modalidad: ModalidadFeriado | null,
): Franja[] {
  if (modalidad !== 'medio_dia' || franjas.length === 0) return franjas

  const primera = franjas.reduce((min, f) =>
    f.horaInicio < min.horaInicio ? f : min,
  )
  return [primera]
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
    // Qué turnos tapan un rato. `reservado` es obvio; `realizado` entró con HU-08: desde
    // que Ariel puede registrar en el pasado, un turno que ya atendió es un rato ocupado
    // de verdad y pisarlo sería perder uno de los dos.
    //
    // ⚠️ `ausente` NO está, y no es un olvido: marcarlo Ausente libera el rato es el flujo
    // que Ariel usa todos los días (el cliente no vino a los 10 minutos, lo marca y mete a
    // otro). `cancelado` y `reprogramado` tampoco, por lo mismo — ese rato volvió a estar
    // libre. Es la misma lista que el predicado del EXCLUDE en la base.
    prisma.turno.findMany({
      where: {
        fecha,
        estado: { in: ['reservado', 'realizado'] },
        ...(opciones.excluirTurnoId
          ? { id: { not: opciones.excluirTurnoId } }
          : {}),
      },
    }),
  ])

  // Este chequeo va primero a propósito, y es lo que hace que la regla del feriado valga
  // "solo los días que Ariel trabaja": un feriado que cae domingo o lunes no cambia nada,
  // porque esos días no tienen franjas y el día ya estaba cerrado.
  if (franjasDb.length === 0) {
    return { horarios: [], estado: 'cerrado', motivo: null }
  }
  if (feriado?.modalidad === 'cerrado') {
    return { horarios: [], estado: 'feriado', motivo: feriado.nombre }
  }

  const franjas = franjasSegunFeriado(
    franjasDb.map((f) => ({ horaInicio: f.horaInicio, horaFin: f.horaFin })),
    feriado?.modalidad ?? null,
  )

  // Un feriado de medio día no impide reservar, pero recorta el día: sin decirlo, el
  // cliente ve la mitad de los horarios de siempre y no entiende por qué.
  const motivoFeriado =
    feriado && feriado.modalidad === 'medio_dia'
      ? `${feriado.nombre ?? 'Feriado'}: atendemos de ${formatearHora(franjas[0].horaInicio)} a ${formatearHora(franjas[0].horaFin)}.`
      : null

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
    permitirPasado: opciones.permitirPasado,
  })

  if (horarios.length > 0) {
    return { horarios, estado: 'disponible', motivo: motivoFeriado }
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

  // Si además era feriado de medio día, el motivo explica por qué se llenó tan rápido:
  // no es que Ariel tenga el día lleno, es que ese día atiende la mitad.
  return { horarios, estado: 'completo', motivo: motivoFeriado }
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

/** Las opciones que acepta el cálculo de un rango. Las usa solo el endpoint admin: el
 * público llama sin opciones y se comporta exactamente igual que siempre. */
export interface OpcionesDisponibilidad {
  margenMinutos?: number
  permitirPasado?: boolean
}

export async function calcularDisponibilidad(
  servicioId: string,
  desde: Date,
  hasta: Date,
  opciones: OpcionesDisponibilidad = {},
): Promise<DisponibilidadDia[]> {
  const servicio = await obtenerServicioActivo(servicioId)
  const ahora = ahoraArgentina()
  const resultado: DisponibilidadDia[] = []

  for (
    let fecha = desde;
    fecha.getTime() <= hasta.getTime();
    fecha = new Date(fecha.getTime() + 24 * 60 * MINUTO_MS)
  ) {
    const detalle = await obtenerDetalleDelDia(servicio, fecha, ahora, opciones)
    resultado.push({ fecha: formatearFecha(fecha), ...detalle })
  }

  return resultado
}
