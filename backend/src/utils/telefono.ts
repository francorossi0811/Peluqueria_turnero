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
 * válido — el llamador tiene que tratar eso como "no hay a dónde mandar".
 *
 * ⚠️ `conNueve: false` es **solo para enviar** por el número de prueba de Meta, cuya lista
 * de destinatarios autorizados guarda los números sin el `9` y compara literal: un envío a
 * `549…` rebota con `131030` aunque Meta después resuelva ese mismo destino. Lo enciende
 * `WHATSAPP_NUMERO_DE_PRUEBA` y no tiene ningún sentido con el número real.
 *
 * ⚠️⚠️ **Nunca pasar `conNueve: false` desde `clientes.service`.** Ahí el resultado es la
 * identidad del cliente (`clientes.telefono_e164`), no un destino: cambiarlo haría que la
 * misma persona se convierta en dos fichas distintas según cuándo se la haya guardado. El
 * default es `true` justamente para que el que no sabe de esto no se lo lleve puesto. */
export function aE164(
  valor: string,
  opciones: { conNueve?: boolean } = {},
): string | null {
  const numero = interpretar(valor)
  if (!numero) return null

  if (opciones.conNueve === false) return sinNueveDeCelular(numero)

  // `.number` viene como `+549...`; WhatsApp quiere los dígitos pelados.
  return (conNueveDeCelular(numero) ?? numero).number.slice(1)
}

/** La característica que se asume cuando el número viene sin ella. Es la de Córdoba,
 * donde está la peluquería: el cliente que no la escribe es, casi siempre, de acá. */
export const CARACTERISTICA_POR_DEFECTO = '351'

/** Lee el número tal como vino y, si así no es válido, prueba con la característica de
 * Córdoba adelante.
 *
 * ⚠️ **El orden importa: primero tal cual, después con 351.** Un número que ya es válido
 * nunca se reinterpreta, así que `11 4555 1234` sigue siendo de Buenos Aires y lo único
 * que cambia es que lo que antes se rechazaba ahora tiene una segunda oportunidad.
 *
 * Solo se intenta con las dos formas en que se escribe un número local de Córdoba sin
 * característica: **7 dígitos** (`555 1234`) o **9 empezando con `15`** (`15 555 1234`).
 * Cualquier otro largo es otra cosa y no se adivina — un `4555 1234` (8 dígitos, un fijo
 * porteño sin el 11) daría 11 dígitos con el 351 y se rechaza igual que antes.
 *
 * Con `+` adelante tampoco: el que escribe el prefijo internacional ya dijo de dónde es.
 *
 * El riesgo, asumido (HU-25): un cliente de otra ciudad cargado sin su característica
 * queda con un número cordobés que no es el suyo. Es el mismo número que antes se
 * rechazaba, y la regla la pidió Franco porque Ariel tipea los números como le salen. */
function interpretar(valor: string): PhoneNumber | null {
  const numero = parsePhoneNumberFromString(valor, 'AR')
  if (numero?.isValid()) return numero

  const conCaracteristica = conCaracteristicaPorDefecto(valor)
  if (!conCaracteristica) return null
  const local = parsePhoneNumberFromString(conCaracteristica, 'AR')
  return local?.isValid() ? local : null
}

function conCaracteristicaPorDefecto(valor: string): string | null {
  const limpio = valor.trim()
  if (limpio.startsWith('+')) return null
  const digitos = limpio.replace(/\D/g, '')
  const esLocal =
    digitos.length === 7 || (digitos.length === 9 && digitos.startsWith('15'))
  // Con el `0` adelante, que es como se marca de larga distancia: así la librería
  // reconoce el `15` que viene después y lo saca.
  return esLocal ? `0${CARACTERISTICA_POR_DEFECTO}${digitos}` : null
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
/** El inverso de `conNueveDeCelular`: saca el `9` si está.
 *
 * No alcanza con "no agregarlo". Cuando la persona escribe el `15` (`0351 15 616 7991`),
 * `libphonenumber-js` ya devuelve `+549…` por su cuenta, así que omitir nuestro paso no
 * cambia nada. La lista de autorizados del número de prueba guarda el número **sin** el
 * `9` sea como sea que se lo haya tipeado, así que hay que quitarlo activamente. */
function sinNueveDeCelular(numero: PhoneNumber): string {
  const nacional = numero.nationalNumber
  if (numero.country !== 'AR' || !nacional.startsWith('9')) {
    return numero.number.slice(1)
  }
  return `54${nacional.slice(1)}`
}

function conNueveDeCelular(numero: PhoneNumber): PhoneNumber | null {
  if (numero.country !== 'AR') return null
  if (numero.nationalNumber.startsWith('9')) return null

  const candidato = parsePhoneNumberFromString(
    `+549${numero.nationalNumber}`,
    'AR',
  )
  return candidato?.isValid() ? candidato : null
}
