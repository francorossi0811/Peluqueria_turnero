import cors from 'cors'
import express from 'express'
import { HEADER_TOKEN_RENOVADO } from './middlewares/auth.middleware'
import { adminRouter } from './routes/admin.routes'
import { authRouter } from './routes/auth.routes'
import { disponibilidadRouter } from './routes/disponibilidad.routes'
import { healthRouter } from './routes/health.routes'
import { imagenesRouter } from './routes/imagenes.routes'
import { pushRouter } from './routes/push.routes'
import { serviciosRouter } from './routes/servicios.routes'
import { turnosRouter } from './routes/turnos.routes'
import { webhooksRouter } from './routes/webhooks.routes'

export const app = express()

// `exposedHeaders` no es opcional: por defecto el browser solo deja leer un puñado de
// headers de respuesta, y el front (Vercel) y el backend (Render) están en dominios
// distintos. Sin esta línea la renovación deslizante andaría en localhost y sería un
// no-op silencioso en producción.
app.use(cors({ exposedHeaders: [HEADER_TOKEN_RENOVADO] }))

// HU-29 — Las rutas de fotos van **antes** del `express.json()` global, y no es un capricho de
// orden: el global tiene el límite por defecto de 100 KB y rechazaría una subida con un 413
// antes de que llegue a su handler. Las de subida traen su propio parser con un límite más alto
// (ver `imagenes.routes.ts`), y como `express.json` se saltea si el cuerpo ya fue parseado, el
// global de abajo las deja pasar sin tocarlas.
//
// La alternativa —subir el límite global— haría que *toda* la API acepte cuerpos de megabytes
// para que dos endpoints puedan. Reservar un turno no tiene por qué.
app.use('/api', imagenesRouter)

// El webhook de WhatsApp también va antes del `express.json()` global, pero por un motivo
// distinto del de las fotos: no es el tamaño del cuerpo, es que Meta firma cada evento en
// `X-Hub-Signature-256` sobre los **bytes exactos** que manda. `express.json()` los consume
// y deja solo el objeto parseado, y eso es irreversible — `JSON.stringify` no reproduce los
// mismos bytes. Su router trae un `express.raw()` propio (ver `webhooks.routes.ts`).
app.use('/api', webhooksRouter)

app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', disponibilidadRouter)
app.use('/api', turnosRouter)
app.use('/api', serviciosRouter)
app.use('/api', authRouter)
app.use('/api', pushRouter)
app.use('/api', adminRouter)
