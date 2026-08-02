import { Request, Response } from 'express'
import { z } from 'zod'
import { login } from '../services/auth.service'
import { CredencialesInvalidasError } from '../services/errores'

const bodySchema = z.object({
  usuario: z.string().trim().min(1),
  password: z.string().min(1),
})

export async function postLogin(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: { codigo: 'PARAMETROS_INVALIDOS', mensaje: 'Falta usuario o contraseña.' },
    })
    return
  }

  try {
    const token = await login(parsed.data.usuario, parsed.data.password)
    res.json({ token })
  } catch (err) {
    if (err instanceof CredencialesInvalidasError) {
      res.status(401).json({
        error: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Usuario o contraseña incorrectos.' },
      })
      return
    }
    throw err
  }
}
