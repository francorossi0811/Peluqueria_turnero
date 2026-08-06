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

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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
