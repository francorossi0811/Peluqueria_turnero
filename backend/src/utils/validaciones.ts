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
