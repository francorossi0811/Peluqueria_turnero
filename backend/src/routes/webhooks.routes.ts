import { Router, raw } from 'express'
import {
  getWebhookWhatsapp,
  postWebhookWhatsapp,
} from '../controllers/webhooks.controller'

export const webhooksRouter = Router()

/** El parser del webhook: deja el cuerpo como `Buffer` en vez de parsearlo.
 *
 * ⚠️ Es a propósito y no una omisión. Meta firma cada evento en `X-Hub-Signature-256`, y esa
 * firma se calcula sobre **los bytes exactos** que mandó. `express.json()` los consume y
 * deja solo el objeto ya parseado, y eso no se puede deshacer: `JSON.stringify` del objeto
 * no reproduce los mismos bytes (orden de claves, espacios, escapes). Parsear primero es
 * perder la posibilidad de validar la firma para siempre.
 *
 * El `type: () => true` es porque el parser tiene que quedarse con el cuerpo **sea cual sea**
 * el `Content-Type` que llegue. Si filtrara por `application/json`, un evento con otro header
 * caería en el `express.json()` global de `app.ts` y perderíamos los bytes justamente en el
 * caso raro, que es donde uno más quiere poder mirar qué pasó. */
const cuerpoCrudo = raw({ type: () => true, limit: '1mb' })

/** Pública y sin JWT, como corresponde: el que llama es Meta, no el panel. La autorización
 * del `GET` es conocer el `WHATSAPP_VERIFY_TOKEN`; la del `POST` va a ser la firma. */
webhooksRouter.get('/webhooks/whatsapp', getWebhookWhatsapp)
webhooksRouter.post('/webhooks/whatsapp', cuerpoCrudo, postWebhookWhatsapp)
