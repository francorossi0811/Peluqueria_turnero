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
