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

/** El mismo chat de WhatsApp, pero con el mensaje ya escrito y listo para mandar.
 *
 * ⚠️ **Va por `api.whatsapp.com/send` y NO por `wa.me`, y no es capricho: `wa.me` rompe
 * todo carácter que no entre en latin-1.** Su redirección decodifica el `text` como
 * latin-1 y lo vuelve a encodear, así que cada emoji sale convertido en `%EF%BF%BD` —el
 * rombito con el signo de pregunta— y Ariel recibe eso. Medido, no supuesto: mandando
 * `A 👇 B é C` por `wa.me` llega `A � B é C` (la `é` sobrevive porque **sí** es latin-1;
 * el emoji no). Por la URL directa el `%F0%9F%91%87` llega entero.
 *
 * `WHATSAPP_URL` sigue siendo `wa.me` para los links **sin texto** (la landing, el botón
 * de contacto): ahí no hay nada que romper y es la forma corta y conocida.
 *
 * `encodeURIComponent` tampoco es un detalle: los mensajes llevan tildes, el `·` de los
 * separadores, saltos de línea y una URL con `/` adentro. Sin codificar, el mensaje llega
 * cortado en el primer `&` o `#`. */
export function whatsappCon(mensaje: string): string {
  return `https://api.whatsapp.com/send?phone=549${TELEFONO_LEGIBLE}&text=${encodeURIComponent(mensaje)}`
}

/** La casilla a la que se escribe por datos personales (política de privacidad y pedido
 * de eliminación, Ley 25.326).
 *
 * ⚠️ No es una decisión de diseño que esté acá adentro y no en las dos páginas legales:
 * la dirección aparece **cuatro veces** entre las dos, y una de ellas es la que Meta
 * revisa. Tenerla en un solo lugar es lo que evita corregir tres y olvidarse de la
 * cuarta. */
export const EMAIL_CONTACTO = 'contametodo_@hotmail.com'
export const EMAIL_CONTACTO_URL = `mailto:${EMAIL_CONTACTO}`
