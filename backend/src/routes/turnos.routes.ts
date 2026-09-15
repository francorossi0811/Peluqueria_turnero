import { Router } from 'express'
import {
  getTurno,
  getTurnoIcs,
  postCancelarTurno,
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
// ⚠️ `POST /turnos/:id/enviar-confirmacion` (HU-19, cargar el mail después de reservar) se
// borró el 15/9/2026 junto con el campo de mail de la reserva: el cliente ya no deja mail
// por ningún lado, y era además la única puerta pública que hacía mandar un mail.
