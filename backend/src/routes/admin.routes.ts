import { Router } from 'express'
import { getMe } from '../controllers/admin.controller'
import { requireAuth } from '../middlewares/auth.middleware'

export const adminRouter = Router()

adminRouter.get('/admin/me', requireAuth, getMe)
