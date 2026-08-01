import cors from 'cors'
import express from 'express'
import { healthRouter } from './routes/health.routes'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', healthRouter)
