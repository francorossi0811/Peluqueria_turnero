import { Router } from 'express'
import {
  getTurno,
  getTurnoIcs,
  postCancelarTurno,
  postEnviarConfirmacion,
  postReprogramarTurno,
  postTurno,
  postTurnosEnGrupo,
} from '../controllers/turnos.controller'

export const turnosRouter = Router()

turnosRouter.post('/turnos', postTurno)
// HU-31 — Reservar 2 o 3 de una. ⚠️ Va **antes** de '/turnos/:id' para que 'grupo' no se
// lea como un id; en la práctica no colisionan (aquel es GET y este POST), pero el orden
// deja de depender de eso.
turnosRouter.post('/turnos/grupo', postTurnosEnGrupo)
turnosRouter.get('/turnos/:id', getTurno)
// HU-19 — Antes de nada más con :id no hace falta: la ruta es más específica y Express
// la matchea por el sufijo literal.
turnosRouter.get('/turnos/:id/calendario.ics', getTurnoIcs)
turnosRouter.post('/turnos/:id/cancelar', postCancelarTurno)
turnosRouter.post('/turnos/:id/reprogramar', postReprogramarTurno)
// HU-19 — Cargar el mail después de reservar, para recibir el link. Un solo uso.
turnosRouter.post('/turnos/:id/enviar-confirmacion', postEnviarConfirmacion)
