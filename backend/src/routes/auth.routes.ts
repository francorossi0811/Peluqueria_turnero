import { Router } from 'express'
import { postLogin } from '../controllers/auth.controller'

export const authRouter = Router()

authRouter.post('/auth/login', postLogin)
