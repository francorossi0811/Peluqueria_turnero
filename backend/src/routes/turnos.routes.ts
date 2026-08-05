import { Router } from 'express'
import {
  getTurno,
  getTurnoIcs,
  postCancelarTurno,
  postReprogramarTurno,
  postTurno,
} from '../controllers/turnos.controller'

export const turnosRouter = Router()

turnosRouter.post('/turnos', postTurno)
turnosRouter.get('/turnos/:id', getTurno)
// HU-19 — Antes de nada más con :id no hace falta: la ruta es más específica y Express
// la matchea por el sufijo literal.
turnosRouter.get('/turnos/:id/calendario.ics', getTurnoIcs)
turnosRouter.post('/turnos/:id/cancelar', postCancelarTurno)
turnosRouter.post('/turnos/:id/reprogramar', postReprogramarTurno)
