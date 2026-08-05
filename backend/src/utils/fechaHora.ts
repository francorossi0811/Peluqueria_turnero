// Helpers de fecha/hora compartidos por disponibilidad y turnos. Ver el comentario de
// `combinarFechaHora` — toda la app trata fecha/hora como valores de pared, sin huso.

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

const FORMATO_LEGIBLE = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  // Las fechas se guardan ancladas en UTC como valores de pared (ver combinarFechaHora),
  // así que hay que leerlas en UTC o el formateo se correría un día según el huso en el
  // que esté corriendo el server.
  timeZone: 'UTC',
})

/** Fecha en castellano para textos dirigidos a personas (mails, notificaciones):
 * "miércoles 5 de agosto". La API sigue usando `formatearFecha` (ISO). */
export function formatearFechaLegible(fecha: Date): string {
  return FORMATO_LEGIBLE.format(fecha)
}

// "YYYY-MM-DD" -> Date anclada en UTC a medianoche, para comparar/guardar como DATE.
export function fechaDesdeIso(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}

// "HH:mm" -> Date anclada en 1970-01-01 UTC, para comparar/guardar como TIME.
export function horaDesdeString(hhmm: string): Date {
  const [horas, minutos] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, horas, minutos))
}

// Compartido por disponibilidad y bloqueos: ¿se solapan [aInicio,aFin) y [bInicio,bFin)?
export function seSolapan(
  aInicio: Date,
  aFin: Date,
  bInicio: Date,
  bFin: Date,
): boolean {
  return aInicio < bFin && bInicio < aFin
}
