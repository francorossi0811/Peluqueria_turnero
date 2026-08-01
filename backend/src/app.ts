import cors from 'cors'
import express from 'express'
import { disponibilidadRouter } from './routes/disponibilidad.routes'
import { healthRouter } from './routes/health.routes'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', disponibilidadRouter)
