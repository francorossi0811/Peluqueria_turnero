import { Router } from 'express'
import { getMe } from '../controllers/admin.controller'
import {
  getAgenda,
  patchEstadoTurno,
  patchTurno,
  postCancelarTurnoAdmin,
  postTurnoManual,
} from '../controllers/turnos.controller'
import {
  getServiciosAdmin,
  patchServicio,
  postServicio,
} from '../controllers/servicios.controller'
import {
  getHorarioLaboral,
  putHorarioLaboral,
} from '../controllers/horarioLaboral.controller'
import { getFeriados, patchFeriado } from '../controllers/feriados.controller'
import { requireAuth } from '../middlewares/auth.middleware'

export const adminRouter = Router()

adminRouter.get('/admin/me', requireAuth, getMe)
adminRouter.get('/admin/turnos', requireAuth, getAgenda)
adminRouter.post('/admin/turnos', requireAuth, postTurnoManual)
adminRouter.patch('/admin/turnos/:id', requireAuth, patchTurno)
adminRouter.post(
  '/admin/turnos/:id/cancelar',
  requireAuth,
  postCancelarTurnoAdmin,
)
adminRouter.patch('/admin/turnos/:id/estado', requireAuth, patchEstadoTurno)

adminRouter.get('/admin/servicios', requireAuth, getServiciosAdmin)
adminRouter.post('/admin/servicios', requireAuth, postServicio)
adminRouter.patch('/admin/servicios/:id', requireAuth, patchServicio)

adminRouter.get('/admin/horario-laboral', requireAuth, getHorarioLaboral)
adminRouter.put('/admin/horario-laboral', requireAuth, putHorarioLaboral)

adminRouter.get('/admin/feriados', requireAuth, getFeriados)
adminRouter.patch('/admin/feriados/:id', requireAuth, patchFeriado)
