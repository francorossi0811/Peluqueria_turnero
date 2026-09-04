// Botones del lado del cliente (landing y wizard de reserva). Comparten lenguaje con el
// <Button> del panel: `outline` con fondo propio para que se despegue del crema de la
// página, y `ghost` sin caja para las acciones de escape.
//
// El texto va en `text-base` y no `text-sm`: son los botones que toca un cliente desde
// el celular, muchas veces mayor, y el tamaño anterior quedaba chico.
//
// ⚠️ **Van todos en mayúscula** (pedido de Franco, 4/9/2026). No es una decisión suelta de
// esta pantalla: el panel de Ariel ya está entero en mayúscula desde que él lo pidió por
// su vista (ver la regla de `data-panel="admin"` en index.css), y el lado del cliente
// quedaba escrito con otra voz. Se resuelve acá y no con una regla global sobre `button`
// como en el panel, porque del lado del cliente **no** va todo en mayúscula: van los
// botones y el nombre del servicio, no los párrafos.
//
// `tracking-wide` no es decoración: una palabra en mayúscula pierde el perfil que le dan
// las ascendentes y descendentes, y sin abrir un poco el espaciado se lee como un bloque.
//
// ⚠️ `whitespace-nowrap` va con la mayúscula, no aparte: el mismo texto ocupa más ancho en
// mayúscula y con el espaciado abierto, y a 375 px el "Reservar turno" del encabezado
// pasó a partirse en dos renglones — un botón de dos líneas se lee como algo roto, no como
// un botón. Se vio midiendo la landing a ancho de celular, no compilando.
const MAYUSCULA = 'uppercase tracking-wide whitespace-nowrap'

export const BTN_OUTLINE =
  `inline-flex items-center justify-center rounded-md border border-miel bg-superficie px-5 py-3 font-display text-base font-semibold ${MAYUSCULA} text-miel transition hover:bg-miel-suave active:bg-miel/20`

/** Relleno sólido, para la acción principal de una pantalla. */
export const BTN_SOLIDO =
  `inline-flex items-center justify-center rounded-md border border-miel-fuerte bg-miel-fuerte px-5 py-3 font-display text-base font-semibold ${MAYUSCULA} text-white transition hover:bg-miel active:bg-miel`

/**
 * El CTA rojo: "Reservar turno" en la landing.
 *
 * Es el único botón del sitio que no usa el ámbar de la marca, y es a propósito — pedido
 * de Franco. En la landing conviven tres botones ámbar ("Reservar turno", "WhatsApp", los
 * del nav) y el que hay que tocar no se distinguía de los otros dos. El rojo lo saca del
 * conjunto sin agregar un color nuevo a la paleta: `rojo` es el mismo valor que ya usaban
 * `ahora` y `ausente`, declarado aparte (ver index.css).
 */
export const BTN_ROJO =
  `inline-flex items-center justify-center rounded-md border border-rojo bg-rojo px-5 py-3 font-display text-base font-semibold ${MAYUSCULA} text-white transition hover:opacity-90 active:opacity-80`

export const BTN_GHOST =
  `inline-flex items-center justify-center rounded-md px-3 py-3 font-display text-base font-semibold ${MAYUSCULA} text-miel transition hover:bg-miel-suave active:bg-miel/20`
