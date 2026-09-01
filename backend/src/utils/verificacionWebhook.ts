/** La regla del handshake con el que Meta da de alta un webhook.
 *
 * Meta llama una sola vez al endpoint con `hub.mode`, `hub.verify_token` y `hub.challenge`.
 * Si el token coincide con el que configuramos, hay que devolverle el `challenge` tal cual;
 * cualquier otra cosa es un 403. Recién con eso el panel deja guardar la suscripción.
 *
 * Vive acá, separada de Express, porque es una decisión de tres condiciones y una sola
 * salida: así se puede fijar con tests sin levantar un servidor ni simular un `Request`.
 * Es el mismo criterio de `resumirCobros` y `construirMensajeWhatsapp`.
 *
 * ⚠️ Los valores llegan de `req.query`, que **no** es `string` garantizado: Express
 * devuelve un array cuando el parámetro viene repetido (`?hub.mode=a&hub.mode=b`) y
 * `undefined` cuando falta. Por eso la firma acepta `unknown` y el chequeo de tipo es
 * parte de la regla, no ruido defensivo.
 */
export function resolverVerificacion(
  params: { mode?: unknown; token?: unknown; challenge?: unknown },
  tokenEsperado: string | null,
): string | null {
  // Sin token configurado no hay con qué comparar, así que no se verifica nada. Es
  // deliberado que esto no sea un error de arranque: un backend que no expone el webhook
  // tiene que poder correr igual (ver `configWhatsapp` en config/env.ts).
  if (!tokenEsperado) return null

  const { mode, token, challenge } = params
  if (typeof mode !== 'string' || typeof token !== 'string') return null
  if (typeof challenge !== 'string' || challenge === '') return null

  if (mode !== 'subscribe') return null
  if (token !== tokenEsperado) return null

  return challenge
}
