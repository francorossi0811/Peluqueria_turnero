// Validaciones de los datos que carga el cliente al reservar.
//
// Viven acá y no sueltas en el schema de zod porque son reglas de negocio con criterio
// propio (ver la HU de reserva en Docs/), y porque así se pueden testear como funciones
// puras. El frontend repite la misma regla para dar el mensaje al instante, pero la que
// vale es esta: el navegador se puede saltear.

/** Lo que se acepta escribir: dígitos, espacios, guiones, paréntesis y un `+` inicial.
 * A propósito no se normaliza ni se fuerza un formato — Ariel necesita el número para
 * llamar o mandar WhatsApp, no para procesarlo. */
const CARACTERES_PERMITIDOS = /^[+()\d\s-]+$/

/** Un celular argentino sin el 0 ni el 15 son 10 dígitos (ej. 351 459 3325). El mínimo
 * de 8 deja pasar un fijo viejo sin característica; el máximo de 15 es el largo máximo
 * de un número de teléfono según E.164, así que cubre cualquier internacional. */
const MIN_DIGITOS = 8
const MAX_DIGITOS = 15

export function esTelefonoValido(valor: string): boolean {
  const limpio = valor.trim()
  if (!CARACTERES_PERMITIDOS.test(limpio)) return false
  // El `+` es el prefijo internacional: solo tiene sentido al principio.
  if (limpio.slice(1).includes('+')) return false

  const digitos = limpio.replace(/\D/g, '').length
  return digitos >= MIN_DIGITOS && digitos <= MAX_DIGITOS
}

export const MENSAJE_TELEFONO_INVALIDO =
  'El teléfono no parece válido. Poné el número con característica, ej: 351 459 3325.'

/** Lo que se acepta como nombre: letras, espacios, apóstrofes y guiones.
 *
 * "Solo letras" a secas rechazaría el espacio, o sea cualquier nombre y apellido. El guión
 * y el apóstrofe entran porque hay apellidos que los llevan de verdad ("Pérez-López",
 * "O'Brien"), y sacárselos sería obligar a alguien a escribir mal su propio nombre para
 * poder reservar. Se aceptan los dos apóstrofes porque el teclado del celular escribe el
 * tipográfico (’) y la persona no elige cuál.
 *
 * `\p{L}` y no `[a-zA-Z]`: con el rango ASCII, "Muñoz" y "Martínez" quedarían afuera.
 *
 * ⚠️ Vale **solo para el cliente que reserva por la web**, no para el turno que Ariel carga
 * a mano. Es el mismo corte que ya hace el teléfono (obligatorio para el cliente, opcional
 * para Ariel): él anota como le sirve para reconocer a la persona —"Señora del 3B"— y esa
 * es su agenda, no un formulario. */
const CARACTERES_PERMITIDOS_NOMBRE = /^[\p{L}\s'’-]+$/u

export function esNombreValido(valor: string): boolean {
  const limpio = valor.trim()
  if (limpio.length === 0) return false
  if (!CARACTERES_PERMITIDOS_NOMBRE.test(limpio)) return false
  // Al menos una letra: si no, "---" o "' '" pasarían el filtro de caracteres.
  return /\p{L}/u.test(limpio)
}

export const MENSAJE_NOMBRE_INVALIDO =
  'El nombre solo puede tener letras, sin números ni símbolos.'
