import { Router } from 'express'
import { getMe } from '../controllers/admin.controller'
import {
  getAgenda,
  patchEstadoTurno,
  patchTurno,
  postCancelarTurnoAdmin,
  postTurnoManual,
} from '../controllers/turnos.controller'
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
