// Lo que el cliente le escribe a Ariel por WhatsApp, en un solo lugar.
//
// Es el espejo del lado del cliente de `Docs/plantillas-whatsapp.md`: allá viven los
// mensajes que el negocio le manda al cliente (aprobados por Meta), acá los que el
// cliente le manda al negocio. Con una diferencia que importa: estos NO son una
// integración. Son un link `wa.me` con el texto preescrito, así que no dependen de la
// Cloud API, ni del token, ni de que Meta apruebe nada. Es el camino que funciona hoy y
// el que va a quedar de respaldo el día que la API ande.
//
// ⚠️ El texto no se escribe en el JSX. Son tres mensajes que dicen casi lo mismo con una
// palabra distinta; sueltos en tres pantallas, se despegan entre sí a la primera edición.

import { fechaLegible } from './fecha'
import { whatsappCon } from './contacto'

/** Por qué un cliente le escribe a Ariel sobre un turno.
 *
 * ⚠️ Son cinco y no tres porque **el tiempo verbal importa**: no es lo mismo avisar algo
 * que el sistema ya hizo que pedir algo que el sistema no pudo hacer.
 *
 * - `confirmado`, `cancelado`, `reprogramado` → el turno ya cambió en la base cuando se
 *   toca el botón. El mensaje **avisa**, no pide. Son los tres casos normales, y son los
 *   mismos tres de `TipoAviso` del backend mirados desde la otra punta.
 * - `pedirReprogramar` → el cliente está en la pantalla de elegir nuevo horario y ninguno
 *   de los que quedan le sirve. Pide, no avisa: acá el sistema todavía no hizo nada.
 *
 * Mezclarlos sería el peor error posible acá: decirle "necesito cancelar" por un turno que
 * el sistema ya canceló lo manda a cancelar algo que no existe, y decirle "cancelé" por
 * uno que sigue en pie le deja el rato bloqueado creyendo que se liberó.
 *
 * ⚠️ **No hay `pedirCancelar`, y es a propósito.** Pasados los 60 minutos la pantalla no
 * ofrece ningún botón de cancelar —ni online ni por WhatsApp—, porque ninguno cancelaría
 * nada; ahí queda el chat en blanco de `ContactoAriel`. Si alguna vez vuelve un botón de
 * "pedir que me cancelen", el mensaje se agrega acá y no suelto en la pantalla. */
export type MotivoWhatsapp =
  'confirmado' | 'cancelado' | 'reprogramado' | 'pedirReprogramar'

export interface DatosDelTurno {
  /** Con quién habla Ariel. Los cuatro mensajes empiezan con "soy ___", así que no es
   * opcional: un mensaje sin firmar lo obliga a adivinar quién le escribió. Viene del
   * formulario al reservar y de `turno.clienteNombre` en la pantalla de gestión. */
  nombre: string
  servicio: string
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  /** El link único de gestión. Va adentro del mensaje para que Ariel abra el turno de
   * una, sin buscarlo en la agenda. No es un secreto frente a él: ve todos los turnos
   * desde el panel. */
  link: string
}

/** Qué anuncia el mensaje, y con qué lo cierra.
 *
 * ⚠️ **`cierre` es lo que separa un turno que sigue en pie de uno que ya no.** Los tres
 * primeros terminan con el link de gestión y un "nos vemos"; el de cancelación termina
 * en "lo lamento" **y sin link**, porque un turno cancelado no se gestiona: mandarle el
 * link sería invitarlo a entrar a una pantalla donde no hay nada para hacer. */
const TEXTOS: Record<MotivoWhatsapp, { anuncio: string; cierre: string[] }> = {
  confirmado: {
    anuncio: 'mi turno quedó confirmado:',
    cierre: ['¡Nos vemos!'],
  },
  reprogramado: {
    anuncio: 'reprogramé mi turno en la web:',
    cierre: ['¡Nos vemos!'],
  },
  pedirReprogramar: {
    anuncio: 'necesito cambiar el horario de mi turno:',
    cierre: [],
  },
  cancelado: {
    anuncio: 'tuve que cancelar el turno:',
    cierre: ['Lo lamento.'],
  },
}

/** El renglón del link, con la manito que lo señala. Solo para los turnos en pie. */
const LINEA_DEL_LINK =
  'El link para reprogramar o cancelar el turno es el siguiente 👇'

/** La variante en plural, para la reserva en grupo. La de arriba queda intacta: cada turno
 * del grupo tiene **su propio** link, porque el id de cada uno es su token de gestión. */
const LINEA_DE_LOS_LINKS =
  'Los links para reprogramar o cancelar cada turno 👇'

/** El mensaje armado, en singular — Ariel es uno solo, igual que en las plantillas. */
export function mensajeDeTurno(
  motivo: MotivoWhatsapp,
  { nombre, servicio, fecha, hora, link }: DatosDelTurno,
): string {
  const { anuncio, cierre } = TEXTOS[motivo]
  const lineas = [
    `Hola Ariel, soy ${nombre}, ${anuncio}`,
    '',
    servicio,
    `${fechaLegible(fecha)} · ${hora}`,
  ]
  // ⚠️ El renglón en blanco lo pone cada bloque **al entrar**, nunca el anterior al salir.
  // Al revés —dejando un '' fijo al final de la cabecera— el único motivo sin cierre
  // (`pedirReprogramar`) quedaba con dos renglones vacíos seguidos antes del link.
  if (cierre.length > 0) lineas.push('', ...cierre)
  // Cancelado es el único que no lleva link: el turno ya no existe para gestionar.
  if (motivo !== 'cancelado') lineas.push('', LINEA_DEL_LINK, link)
  return lineas.join('\n')
}

/** El link de WhatsApp listo para un `href`, que es como se usa en las tres pantallas. */
export function whatsappDeTurno(
  motivo: MotivoWhatsapp,
  datos: DatosDelTurno,
): string {
  return whatsappCon(mensajeDeTurno(motivo, datos))
}

/** HU-31 — El mensaje de una reserva en grupo (la mamá que trae a los hijos).
 *
 * ⚠️ Con **un** turno delega en `mensajeDeTurno('confirmado', …)`, carácter por carácter. Es
 * lo que hace imposible que el caso normal —la reserva de a uno, el 99%— derive de lo que
 * Ariel recibe hoy. Hay un test que lo fija con un `toBe`.
 *
 * ⚠️ **No se agrega un motivo nuevo a `MotivoWhatsapp`.** Lo que pasó sigue siendo
 * "confirmado"; lo que cambia es la cardinalidad. Meter "confirmadoVarios" en ese enum
 * mezclaría dos ejes —qué pasó y cuántos son— que el archivo ya se ocupó de separar cuando
 * distinguió avisar de pedir.
 *
 * El nombre de cada uno va **adelante** del servicio: es lo único que distingue tres
 * renglones que si no serían casi idénticos, y es lo que le deja a Ariel saber quién es
 * quién sin abrir un solo link. */
export function mensajeDeTurnosConfirmados(turnos: DatosDelTurno[]): string {
  if (turnos.length === 1) return mensajeDeTurno('confirmado', turnos[0])

  const lineas = [
    `Hola Ariel, soy ${turnos[0].nombre}, reservé ${turnos.length} turnos:`,
  ]
  for (const t of turnos) {
    // Mismo criterio que `mensajeDeTurno`: el renglón en blanco lo pone cada bloque al
    // entrar, nunca el anterior al salir.
    lineas.push('', `${t.nombre} · ${t.servicio}`, `${fechaLegible(t.fecha)} · ${t.hora}`)
  }
  lineas.push('', '¡Nos vemos!')
  lineas.push('', LINEA_DE_LOS_LINKS)
  for (const t of turnos) lineas.push(`${t.nombre}: ${t.link}`)
  return lineas.join('\n')
}

/** El link de WhatsApp de una reserva en grupo, listo para un `href`. */
export function whatsappDeTurnosConfirmados(turnos: DatosDelTurno[]): string {
  return whatsappCon(mensajeDeTurnosConfirmados(turnos))
}
