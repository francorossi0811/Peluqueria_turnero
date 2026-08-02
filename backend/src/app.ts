import cors from 'cors'
import express from 'express'
import { adminRouter } from './routes/admin.routes'
import { authRouter } from './routes/auth.routes'
import { disponibilidadRouter } from './routes/disponibilidad.routes'
import { healthRouter } from './routes/health.routes'
import { serviciosRouter } from './routes/servicios.routes'
import { turnosRouter } from './routes/turnos.routes'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', disponibilidadRouter)
app.use('/api', turnosRouter)
app.use('/api', serviciosRouter)
app.use('/api', authRouter)
app.use('/api', adminRouter)
