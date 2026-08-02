import { Router } from 'express'
import {
  getTurno,
  postCancelarTurno,
  postReprogramarTurno,
  postTurno,
} from '../controllers/turnos.controller'

export const turnosRouter = Router()

turnosRouter.post('/turnos', postTurno)
turnosRouter.get('/turnos/:id', getTurno)
turnosRouter.post('/turnos/:id/cancelar', postCancelarTurno)
turnosRouter.post('/turnos/:id/reprogramar', postReprogramarTurno)
