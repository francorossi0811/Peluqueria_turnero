// Mismas reglas que backend/src/utils/validaciones.ts, repetidas acá para poder mostrar
// el error al instante y en el campo, sin esperar el viaje al servidor. La que decide es
// siempre la del backend: esta es solo comodidad. Si una cambia, cambiar las dos.

const CARACTERES_PERMITIDOS_TELEFONO = /^[+()\d\s-]+$/
const MIN_DIGITOS = 8
const MAX_DIGITOS = 15

export function esTelefonoValido(valor: string): boolean {
  const limpio = valor.trim()
  if (!CARACTERES_PERMITIDOS_TELEFONO.test(limpio)) return false
  if (limpio.slice(1).includes('+')) return false

  const digitos = limpio.replace(/\D/g, '').length
  return digitos >= MIN_DIGITOS && digitos <= MAX_DIGITOS
}

export const MENSAJE_TELEFONO_INVALIDO =
  'Poné un teléfono válido con característica, ej: 351 459 3325.'

/** Chequeo deliberadamente laxo: alcanza para atajar el error de tipeo típico
 * (falta la arroba, falta el punto, sobra un espacio) sin rechazar direcciones raras
 * pero válidas. La validación de verdad la hace `z.email()` en el backend. */
const FORMA_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function esEmailValido(valor: string): boolean {
  return FORMA_DE_EMAIL.test(valor.trim())
}

export const MENSAJE_EMAIL_INVALIDO = 'Ese email no parece válido.'

/** Letras, espacios, apóstrofes y guiones. El comentario largo está en el backend, que es
 * el que manda; acá se repite para poder mostrar el error en el campo al instante.
 *
 * ⚠️ Solo se usa en el formulario del **cliente**. El turno que Ariel carga a mano no pasa
 * por esta regla, igual que ya pasa con el teléfono. */
const CARACTERES_PERMITIDOS_NOMBRE = /^[\p{L}\s'’-]+$/u

export function esNombreValido(valor: string): boolean {
  const limpio = valor.trim()
  if (limpio.length === 0) return false
  if (!CARACTERES_PERMITIDOS_NOMBRE.test(limpio)) return false
  return /\p{L}/u.test(limpio)
}

export const MENSAJE_NOMBRE_INVALIDO =
  'El nombre solo puede tener letras, sin números ni símbolos.'
