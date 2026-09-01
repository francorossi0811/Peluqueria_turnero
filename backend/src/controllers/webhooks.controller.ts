import type { Request, Response } from 'express'
import { configWhatsapp } from '../config/env'
import { resolverVerificacion } from '../utils/verificacionWebhook'

/** El handshake de alta del webhook (`GET`).
 *
 * ⚠️ La respuesta va como **texto plano**, no como JSON. Meta compara el cuerpo con el
 * `challenge` que mandó: un `res.json(challenge)` lo devolvería entre comillas
 * (`"1158201444"`) y la verificación falla sin decir por qué.
 *
 * El 403 va **sin cuerpo** a propósito. Un mensaje distinto según si falló el token o el
 * modo le diría a quien pruebe la URL qué parte tiene que ajustar. */
export function getWebhookWhatsapp(req: Request, res: Response) {
  const challenge = resolverVerificacion(
    {
      mode: req.query['hub.mode'],
      token: req.query['hub.verify_token'],
      challenge: req.query['hub.challenge'],
    },
    configWhatsapp().verifyToken,
  )

  if (challenge === null) {
    // `.end()` y no `sendStatus(403)`: aquel manda "Forbidden" como cuerpo. Acá no hay
    // nada que contar — quien no pasó el handshake no tiene por qué recibir una pista.
    res.status(403).end()
    return
  }

  res.type('text/plain').send(challenge)
}

/** La recepción de eventos (`POST`): estados de entrega y mensajes entrantes.
 *
 * ⚠️ **El 200 sale primero, antes de mirar nada.** Meta reintenta el evento si la respuesta
 * tarda o no es 2xx, y si eso se repite termina desuscribiendo el webhook. O sea que un
 * error procesando un payload raro no puede costarnos el canal entero: primero se acusa
 * recibo, después se trabaja.
 *
 * Por eso también el `try/catch` de abajo no responde nada — no puede, la respuesta ya
 * salió. Solo evita que una excepción acá arriba se convierta en un `unhandledRejection`.
 *
 * Hoy esto solo deja rastro en el log. Es el contrato mínimo que Meta pide para dar de alta
 * la suscripción, y el manejo real de eventos está fuera del alcance de HU-22. */
export function postWebhookWhatsapp(req: Request, res: Response) {
  res.sendStatus(200)

  try {
    // `express.raw()` deja el cuerpo como Buffer: son los bytes exactos que firmó Meta en
    // `X-Hub-Signature-256`, y hacen falta tal cual para validar esa firma más adelante
    // (`JSON.stringify` de lo parseado no reproduce los mismos bytes).
    // Un `POST` sin cuerpo deja `req.body` en `undefined`, y `JSON.stringify` de eso
    // devuelve `undefined` (el valor, no el string): loguearlo así deja una línea que
    // parece un bug del handler cuando en realidad no llegó nada.
    const crudo = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : req.body === undefined
        ? ''
        : JSON.stringify(req.body)

    console.log(
      '[webhook whatsapp] evento recibido:',
      crudo === '' ? '(cuerpo vacío)' : crudo,
    )

    // 👉 Punto de enganche. Acá va el manejo de eventos cuando se implemente:
    //    parsear `crudo`, validar `X-Hub-Signature-256` contra el app secret, y de ahí
    //    los `statuses` (sent / delivered / read / failed) que taparían el agujero de
    //    "Meta responde que lo aceptó, no que lo entregó" — ver Docs/plantillas-whatsapp.md.
    //
    // ⚠️ Lo que se agregue acá tiene que seguir sin poder tumbar la respuesta: ya se envió.
  } catch (err) {
    console.error('[webhook whatsapp] no se pudo leer el evento:', err)
  }
}
