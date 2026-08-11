import { Router } from 'express'
import {
  getRecuperacionDisponible,
  postLogin,
  postOlvidePassword,
  postRestablecerPassword,
} from '../controllers/auth.controller'

export const authRouter = Router()

authRouter.post('/auth/login', postLogin)

// HU-26 — Restablecer la contraseña. Las tres son públicas por definición: quien las llama
// es justamente alguien que no puede entrar. La protección no es la autenticación sino que
// `/olvide-password` responde lo mismo exista o no la cuenta, y que el token del mail está
// firmado con el hash de la contraseña, así que dura un solo uso.
authRouter.get('/auth/recuperacion-disponible', getRecuperacionDisponible)
authRouter.post('/auth/olvide-password', postOlvidePassword)
authRouter.post('/auth/restablecer-password', postRestablecerPassword)
