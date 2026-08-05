// HU-19 — Generación de archivos .ics (RFC 5545) para "agregar el turno al calendario".
//
// Escrito a mano en vez de traer una dependencia: son ~50 líneas, es 100% función pura
// (o sea, fácil de testear de verdad) y las librerías del rubro traen bastante más de lo
// que necesitamos. Los cuatro detalles de abajo son los que deciden si el archivo abre
// bien o no en Google Calendar / Apple Calendar / Outlook.

/** Argentina es UTC-3 fijo, sin horario de verano. Toda la app guarda fecha y hora como
 * valores "de pared" sin huso (ver utils/fechaHora.ts), así que para emitir un DTSTART
 * en UTC real hay que sumar 3 horas. Todo el .ics se apoya en este supuesto. */
const OFFSET_ARGENTINA_HORAS = 3

/** RFC 5545 §3.1: las líneas no pueden pasar los 75 octetos. Las que se pasan se parten
 * y siguen en la línea siguiente empezando con un espacio. El link de gestión siempre
 * supera ese largo — saltear el plegado es la causa más común de "anda en Gmail pero se
 * ve roto en Outlook". */
const MAX_OCTETOS_POR_LINEA = 75

/** RFC 5545 §3.3.11: en los valores de tipo TEXT hay que escapar la barra invertida, el
 * punto y coma, la coma y los saltos de línea. */
function escaparTexto(valor: string): string {
  return valor
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function plegarLinea(linea: string): string {
  const bytes = Buffer.from(linea, 'utf8')
  if (bytes.length <= MAX_OCTETOS_POR_LINEA) return linea

  const partes: string[] = []
  let desde = 0
  // La primera línea admite 75 octetos; las siguientes 74, porque arrancan con un
  // espacio de continuación.
  let limite = MAX_OCTETOS_POR_LINEA

  while (desde < bytes.length) {
    let hasta = Math.min(desde + limite, bytes.length)
    // No cortar en el medio de un carácter multibyte: los bytes de continuación UTF-8
    // tienen la forma 10xxxxxx.
    while (hasta > desde && hasta < bytes.length && (bytes[hasta] & 0xc0) === 0x80) {
      hasta--
    }
    partes.push(bytes.subarray(desde, hasta).toString('utf8'))
    desde = hasta
    limite = MAX_OCTETOS_POR_LINEA - 1
  }

  return partes.join('\r\n ')
}

/** Formato de fecha-hora UTC del RFC: YYYYMMDDTHHMMSSZ. */
function aFormatoUtc(fecha: Date): string {
  const p = (n: number, largo = 2) => String(n).padStart(largo, '0')
  return (
    `${p(fecha.getUTCFullYear(), 4)}${p(fecha.getUTCMonth() + 1)}${p(fecha.getUTCDate())}` +
    `T${p(fecha.getUTCHours())}${p(fecha.getUTCMinutes())}${p(fecha.getUTCSeconds())}Z`
  )
}

/** Convierte una hora "de pared" argentina a UTC real. */
export function paredArgentinaAUtc(fechaPared: Date): Date {
  return new Date(fechaPared.getTime() + OFFSET_ARGENTINA_HORAS * 3_600_000)
}

export interface EventoIcs {
  /** Identificador estable del evento. Ver el comentario de `generarIcs`. */
  uid: string
  /** Inicio y fin en hora de pared argentina (se convierten a UTC acá adentro). */
  inicio: Date
  fin: Date
  titulo: string
  descripcion: string
  ubicacion?: string
  creadoEn: Date
  /** Se incrementa cuando el evento cambia, para que el calendario lo actualice. */
  secuencia?: number
  /** Minutos antes del turno a los que el calendario avisa. Sin esto, avisa (o no)
   * según la configuración por defecto de cada cliente. */
  minutosDeAviso?: number
}

export function generarIcs(evento: EventoIcs): string {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peluqueria Ariel Enrique//Turnero//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evento.uid}`,
    `DTSTAMP:${aFormatoUtc(paredArgentinaAUtc(evento.creadoEn))}`,
    `DTSTART:${aFormatoUtc(paredArgentinaAUtc(evento.inicio))}`,
    `DTEND:${aFormatoUtc(paredArgentinaAUtc(evento.fin))}`,
    `SEQUENCE:${evento.secuencia ?? 0}`,
    `SUMMARY:${escaparTexto(evento.titulo)}`,
    `DESCRIPTION:${escaparTexto(evento.descripcion)}`,
    ...(evento.ubicacion
      ? [`LOCATION:${escaparTexto(evento.ubicacion)}`]
      : []),
    'STATUS:CONFIRMED',
    // Recordatorio propio del evento: si no, que le avise o no depende de la
    // configuración por defecto del calendario de cada cliente. Con esto, el turno
    // le suena solo — que es la parte de HU-05 que se puede cubrir sin WhatsApp.
    ...(evento.minutosDeAviso !== undefined
      ? [
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `TRIGGER:-PT${evento.minutosDeAviso}M`,
          `DESCRIPTION:${escaparTexto(evento.titulo)}`,
          'END:VALARM',
        ]
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // Saltos CRLF: el RFC los exige y varios clientes rechazan de plano un archivo que
  // solo use LF.
  return lineas.map(plegarLinea).join('\r\n') + '\r\n'
}
