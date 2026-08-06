// Botones del lado del cliente (landing y wizard de reserva). Comparten lenguaje con el
// <Button> del panel: `outline` con fondo propio para que se despegue del crema de la
// página, y `ghost` sin caja para las acciones de escape.
//
// El texto va en `text-base` y no `text-sm`: son los botones que toca un cliente desde
// el celular, muchas veces mayor, y el tamaño anterior quedaba chico.
export const BTN_OUTLINE =
  'inline-flex items-center justify-center rounded-md border border-miel bg-superficie px-5 py-3 font-display text-base font-semibold text-miel transition hover:bg-miel-suave active:bg-miel/20'

/** Relleno sólido, para la acción principal de una pantalla. */
export const BTN_SOLIDO =
  'inline-flex items-center justify-center rounded-md border border-miel-fuerte bg-miel-fuerte px-5 py-3 font-display text-base font-semibold text-white transition hover:bg-miel active:bg-miel'

export const BTN_GHOST =
  'inline-flex items-center justify-center rounded-md px-3 py-3 font-display text-base font-semibold text-miel transition hover:bg-miel-suave active:bg-miel/20'
