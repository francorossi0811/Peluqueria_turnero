// Helpers de fecha para la UI. A diferencia del backend, acá no hace falta ser
// independiente del huso horario del server — esto corre en el navegador del cliente,
// que ya está en la hora de Argentina.

function formatearFechaIso(date: Date): string {
  const anio = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function fechaDesdeIso(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function hoyIso(): string {
  return formatearFechaIso(new Date())
}

export function sumarDias(fechaIso: string, dias: number): string {
  const fecha = fechaDesdeIso(fechaIso)
  fecha.setDate(fecha.getDate() + dias)
  return formatearFechaIso(fecha)
}

/** 0 = domingo … 6 = sábado. Misma convención que `horario_laboral.dia_semana` en la
 * base y que los arrays de nombres de acá abajo, así que un `diaSemana` sirve
 * indistintamente para indexar cualquiera de los dos. */
export function diaSemana(fechaIso: string): number {
  return fechaDesdeIso(fechaIso).getDay()
}

/** El domingo de la semana que contiene a `fechaIso` (o la misma fecha, si ya es
 * domingo).
 *
 * Las semanas se anclan en domingo y no en lunes por dos motivos: es la convención que
 * ya usa `getDay()` y todos los arrays de días del proyecto, y hace que un domingo o un
 * lunes —los dos días que Ariel no trabaja— caigan en la semana que **empieza**, que es
 * la que quiere ver cuando mira la agenda esos días. */
export function domingoDeLaSemana(fechaIso: string): string {
  return sumarDias(fechaIso, -diaSemana(fechaIso))
}

/** Minutos desde medianoche de una hora `"HH:mm"`. La grilla posiciona todo con esto. */
export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** ¿Este turno está ocurriendo justo ahora?
 *
 * Vive acá y no en la grilla porque lo usan las dos vistas de la agenda, y tienen que
 * coincidir: un turno pintado como "en curso" en la semana y normal en el día sería peor
 * que no marcarlo en ninguna.
 *
 * Usa la `horaFin` guardada en el turno y no la duración del servicio actual, por la regla
 * de siempre: el turno guarda su propia copia y no se recalcula si Ariel cambia el
 * servicio después. */
export function turnoEnCurso(
  turno: { hora: string; horaFin: string },
  diaDelTurno: string,
  hoy: string,
  minutosAhora: number | null,
): boolean {
  if (diaDelTurno !== hoy || minutosAhora === null) return false
  return (
    minutosAhora >= minutosDeHora(turno.hora) &&
    minutosAhora < minutosDeHora(turno.horaFin)
  )
}

/** HU-08 — Cuántos días para atrás puede Ariel registrar un turno ya atendido.
 *
 * ⚠️ Tiene que coincidir con `DIAS_PASADOS_ADMIN` de
 * `backend/src/services/disponibilidad.service.ts`, que es quien decide de verdad. Igual
 * que `PASO_MINUTOS`: acá dibuja, allá manda. */
export const DIAS_CARGA_HACIA_ATRAS = 7

/** ¿Este día y hora ya ocurrieron?
 *
 * Vive acá y no en cada componente porque lo usan la grilla de horarios, el modal de
 * carga y la grilla semanal, y tienen que coincidir: una hora marcada como pasada en un
 * lado y no en el otro es peor que no marcarla en ninguno. Mismo motivo que
 * `turnoEnCurso`. */
export function yaPaso(
  fechaIso: string,
  hora: string,
  hoy: string,
  minutosAhora: number,
): boolean {
  if (fechaIso < hoy) return true
  if (fechaIso > hoy) return false
  return minutosDeHora(hora) < minutosAhora
}

/** Indexados por `getDay()` (0 = domingo), misma convención que `horario_laboral`. */
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function etiquetaDiaCorta(fechaIso: string): string {
  const fecha = fechaDesdeIso(fechaIso)
  return `${DIAS_CORTOS[fecha.getDay()]} ${fecha.getDate()}`
}

const DIAS_LARGOS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function fechaLegible(fechaIso: string): string {
  const fecha = fechaDesdeIso(fechaIso)
  return `${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
}
