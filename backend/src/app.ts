import cors from 'cors'
import express from 'express'
import { HEADER_TOKEN_RENOVADO } from './middlewares/auth.middleware'
import { adminRouter } from './routes/admin.routes'
import { authRouter } from './routes/auth.routes'
import { disponibilidadRouter } from './routes/disponibilidad.routes'
import { healthRouter } from './routes/health.routes'
import { serviciosRouter } from './routes/servicios.routes'
import { turnosRouter } from './routes/turnos.routes'

export const app = express()

// `exposedHeaders` no es opcional: por defecto el browser solo deja leer un puñado de
// headers de respuesta, y el front (Vercel) y el backend (Render) están en dominios
// distintos. Sin esta línea la renovación deslizante andaría en localhost y sería un
// no-op silencioso en producción.
app.use(cors({ exposedHeaders: [HEADER_TOKEN_RENOVADO] }))
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', disponibilidadRouter)
app.use('/api', turnosRouter)
app.use('/api', serviciosRouter)
app.use('/api', authRouter)
app.use('/api', adminRouter)
