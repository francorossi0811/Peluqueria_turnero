// Los datos de contacto de Ariel, en un solo lugar.
//
// Estaban sueltos en `Landing.tsx`; salieron acá cuando la pantalla de gestión del turno
// también los necesitó. Es un número que puede cambiar, y tenerlo en dos archivos es
// tenerlo mal en uno de los dos tarde o temprano.

/** Cómo se lee y se escribe el número acá en Córdoba. */
export const TELEFONO_LEGIBLE = '3514593325'

/** ⚠️ El `9` va solo en el link de WhatsApp, no en el de llamar.
 *
 * Es la misma distinción que hace `backend/src/utils/telefono.ts`: WhatsApp identifica a
 * los celulares argentinos con `+54 9`, pero marcar `+54 9 …` en el teléfono no llama a
 * ningún lado. Un solo número, dos formatos, según para qué se use. */
export const WHATSAPP_URL = 'https://wa.me/549' + TELEFONO_LEGIBLE
export const TELEFONO_URL = 'tel:+54' + TELEFONO_LEGIBLE

export const DIRECCION = 'Pastor Taboada 10, X5016 Córdoba'
