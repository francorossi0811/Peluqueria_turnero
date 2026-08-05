import { Request, Response } from 'express'
import { z } from 'zod'
import { cambiarPassword } from '../services/auth.service'
import {
  AdministradorNoEncontradoError,
  PasswordActualIncorrectaError,
} from '../services/errores'

/** HU-16 — Largo mínimo de la contraseña nueva. */
const LARGO_MINIMO_PASSWORD = 8

const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'Ingresá tu contraseña actual.'),
    passwordNueva: z
      .string()
      .min(
        LARGO_MINIMO_PASSWORD,
        `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
      ),
  })
  .refine((d) => d.passwordActual !== d.passwordNueva, {
    message: 'La contraseña nueva tiene que ser distinta de la actual.',
    path: ['passwordNueva'],
  })

export function getMe(req: Request, res: Response) {
  res.json({ usuario: req.admin?.usuario })
}

export async function patchPassword(req: Request, res: Response) {
  const parsed = cambiarPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0].message,
      },
    })
    return
  }

  try {
    const token = await cambiarPassword(
      req.admin!.sub,
      parsed.data.passwordActual,
      parsed.data.passwordNueva,
    )
    res.json({ token })
  } catch (err) {
    // 400 y no 401 a propósito: el interceptor del frontend desloguea ante cualquier
    // 401, así que un 401 acá sacaría a Ariel de su sesión por un error de tipeo.
    // Además encaja: el request está bien formado y el que llama SÍ está autenticado —
    // lo que está mal es el dato, no la autenticación.
    if (err instanceof PasswordActualIncorrectaError) {
      res.status(400).json({
        error: {
          codigo: 'PASSWORD_ACTUAL_INCORRECTA',
          mensaje: 'La contraseña actual no es correcta.',
        },
      })
      return
    }
    if (err instanceof AdministradorNoEncontradoError) {
      res.status(404).json({
        error: {
          codigo: 'ADMINISTRADOR_NO_ENCONTRADO',
          mensaje: 'No encontramos la cuenta.',
        },
      })
      return
    }
    throw err
  }
}
