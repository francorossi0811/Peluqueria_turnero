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
