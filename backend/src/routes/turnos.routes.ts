import { Router } from 'express'
import { postTurno } from '../controllers/turnos.controller'

export const turnosRouter = Router()

turnosRouter.post('/turnos', postTurno)
