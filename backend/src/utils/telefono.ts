// Traducción del teléfono que escribió el cliente al formato que exige WhatsApp (HU-21).
//
// Es lo contrario de `validaciones.ts`: aquella decide si *aceptamos* lo que escribieron y
// a propósito no normaliza, porque el número se guarda tal cual para que Ariel lo lea y
// llame. Esto de acá es una traducción de **salida**, que corre recién al momento de
// mandar el mensaje. Lo guardado nunca cambia.
//
// Se usa `libphonenumber-js` y no una expresión regular propia por un caso concreto:
// para sacar el `15` de celular hay que saber dónde termina la característica, y las
// argentinas son de 2, 3 o 4 dígitos (`11`, `351`, `2954`). Una heurística escrita a mano
// se equivoca justo ahí, y el error sería invisible: Meta acepta el número igual y el
// mensaje nunca se entrega.
//
// Se importa la metadata `max` y no la `min` (la del import por defecto) porque `min` solo
// mira la **longitud**: da por válido cualquier argentino de 10 dígitos, aunque la
// característica no exista. `max` valida además los rangos realmente asignados, que es lo
// que queremos para decidir si hay a dónde mandar un mensaje.
import {
  parsePhoneNumberFromString,
  type PhoneNumber,
} from 'libphonenumber-js/max'

/** Pasa un teléfono escrito por una persona a E.164 sin el `+`, que es como lo quiere la
 * Cloud API (`5493514593325`). Devuelve `null` si no se puede interpretar como un número
 * válido — el llamador tiene que tratar eso como "no hay a dónde mandar". */
export function aE164(valor: string): string | null {
  const numero = parsePhoneNumberFromString(valor, 'AR')
  if (!numero || !numero.isValid()) return null

  // `.number` viene como `+549...`; WhatsApp quiere los dígitos pelados.
  return (conNueveDeCelular(numero) ?? numero).number.slice(1)
}

/** El `9` que la librería sola no pone.
 *
 * `libphonenumber-js` agrega el `9` de celular únicamente cuando encuentra el `15` en lo
 * que escribió la persona: `0351 15 459 3325` sale `+5493514593325` (MOBILE), pero
 * `351 459 3325` sale `+543514593325` (FIXED_LINE) — y a ese número WhatsApp no llega.
 * El problema es real y no teórico: el placeholder de nuestro propio formulario dice
 * `351 459 3325`, sin `15`, así que es el formato que más vamos a recibir.
 *
 * Un argentino de 10 dígitos sin `0` ni `15` es genuinamente ambiguo — puede ser un fijo o
 * un celular escrito corto — y acá **asumimos celular**. Es la decisión correcta para lo
 * que estamos haciendo: un fijo no tiene WhatsApp, así que agregarle el `9` no le quita
 * nada a nadie y es lo único que le da chance de llegar a un celular.
 *
 * El chequeo de `startsWith('9')` es seguro porque ninguna característica argentina
 * empieza con `9`: ese dígito está reservado justamente como token de celular.
 *
 * Al candidato se le pide que sea válido y nada más. Exigirle además
 * `getType() === 'MOBILE'` sería tentador, pero solo puede **rechazar**: y cuando rechaza,
 * lo que queda es el número sin el `9`, o sea el formato al que WhatsApp con seguridad no
 * llega. Un chequeo que en el mejor caso no cambia nada y en el peor nos deja peor no vale
 * la pena. */
function conNueveDeCelular(numero: PhoneNumber): PhoneNumber | null {
  if (numero.country !== 'AR') return null
  if (numero.nationalNumber.startsWith('9')) return null

  const candidato = parsePhoneNumberFromString(
    `+549${numero.nationalNumber}`,
    'AR',
  )
  return candidato?.isValid() ? candidato : null
}
