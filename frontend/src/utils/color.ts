// HU-34 — El color que Ariel le pone a un turno lo elige él, así que puede ser cualquier
// cosa: un amarillo casi blanco o un bordó casi negro. El texto que va encima no puede ser
// siempre el mismo o la mitad de los colores dejan el nombre del cliente ilegible.
//
// Es el mismo problema que ya tuvo el anillo de las insignias de HU-25, resuelto allá
// apoyándose en un token que contrasta por definición. Acá no alcanza con eso: el fondo no
// es una superficie del tema, es el color elegido, y hay que mirarlo.

/** Negro y blanco de los dos textos posibles. No son tokens del tema a propósito: van
 * sobre un color que Ariel eligió, que no cambia entre claro y oscuro, así que el texto
 * tampoco tiene que cambiar. */
const TINTA_OSCURA = '#1b1b1b'
const TINTA_CLARA = '#ffffff'

/** Un canal de 0-255 pasado a luz, deshaciendo la curva gamma de sRGB. Sin esto, un
 * promedio simple dice que el verde puro y el azul puro son igual de oscuros, y el ojo ve
 * lo contrario. La fórmula es la de WCAG para luminancia relativa. */
function canalALuz(valor: number): number {
  const v = valor / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** Qué tan clara se ve una color hexadecimal `#rrggbb`, de 0 (negro) a 1 (blanco). */
export function luminancia(color: string): number {
  const hex = color.trim().replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (
    0.2126 * canalALuz(r) + 0.7152 * canalALuz(g) + 0.0722 * canalALuz(b)
  )
}

/**
 * Con qué color de texto se lee este fondo: negro si el fondo es claro, blanco si es
 * oscuro.
 *
 * El corte en 0,179 no es a ojo: es el punto donde un fondo contrasta 4,5:1 —el mínimo que
 * pide WCAG AA para texto chico— con el blanco y con el negro por igual. Más arriba gana el
 * negro, más abajo el blanco, y así ningún color elegido puede quedar por debajo de ese
 * mínimo.
 */
export function tintaSobre(color: string): string {
  return luminancia(color) > 0.179 ? TINTA_OSCURA : TINTA_CLARA
}
