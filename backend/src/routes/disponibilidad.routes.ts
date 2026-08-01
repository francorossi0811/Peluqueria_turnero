import { Router } from 'express'
import { getDisponibilidad } from '../controllers/disponibilidad.controller'

export const disponibilidadRouter = Router()

disponibilidadRouter.get('/disponibilidad', getDisponibilidad)
