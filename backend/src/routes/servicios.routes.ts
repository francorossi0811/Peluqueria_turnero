import { Router } from 'express'
import { getServiciosPublico } from '../controllers/servicios.controller'

export const serviciosRouter = Router()

serviciosRouter.get('/servicios', getServiciosPublico)
