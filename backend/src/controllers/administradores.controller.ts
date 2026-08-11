import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarDatosDe,
  cambiarRol,
  crearAdministrador,
  eliminarAdministrador,
  listarAdministradores,
  resetearPasswordDe,
} from '../services/administradores.service'
import {
  AdministradorNoEncontradoError,
  EmailDuplicadoError,
  NoAutorizadoError,
} from '../services/errores'

const ROLES = ['super_admin', 'admin'] as const

/** Mismo mínimo que HU-16 y que el restablecimiento por mail: un solo número para el
 * mismo campo, por más que haya tres caminos que lleguen a él. */
const LARGO_MINIMO_PASSWORD = 8

const idSchema = z.object({ id: z.uuid() })

const crearSchema = z.object({
  usuario: z.string().trim().min(1, 'Ponele un nombre a la cuenta.').max(60),
  email: z.email('Poné un email válido.'),
  password: z
    .string()
    .min(
      LARGO_MINIMO_PASSWORD,
      `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    ),
  rol: z.enum(ROLES),
})

const passwordSchema = z.object({
  passwordNueva: z
    .string()
    .min(
      LARGO_MINIMO_PASSWORD,
      `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    ),
})

const rolSchema = z.object({ rol: z.enum(ROLES) })

const datosSchema = z
  .object({
    usuario: z.string().trim().min(1, 'El nombre no puede quedar vacío.').max(60).optional(),
    email: z.email('Poné un email válido.').optional(),
  })
  .refine((d) => d.usuario !== undefined || d.email !== undefined, {
    message: 'No mandaste ningún cambio.',
  })

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

function manejarErrores(err: unknown, res: Response): boolean {
  if (err instanceof AdministradorNoEncontradoError) {
    res.status(404).json({
      error: {
        codigo: 'ADMINISTRADOR_NO_ENCONTRADO',
        mensaje: 'No encontramos esa cuenta.',
      },
    })
    return true
  }
  if (err instanceof EmailDuplicadoError) {
    res.status(409).json({
      error: {
        codigo: 'ADMINISTRADOR_DUPLICADO',
        mensaje: 'Ya existe una cuenta con ese email o ese nombre.',
      },
    })
    return true
  }
  if (err instanceof NoAutorizadoError) {
    res.status(403).json({
      error: {
        codigo: 'NO_AUTORIZADO',
        mensaje:
          'No podés hacer eso sobre tu propia cuenta, ni dejar al sistema sin administrador general.',
      },
    })
    return true
  }
  return false
}

export async function getAdministradores(_req: Request, res: Response) {
  res.json({ administradores: await listarAdministradores() })
}

export async function postAdministrador(req: Request, res: Response) {
  const parsed = crearSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    res.status(201).json(await crearAdministrador(parsed.data))
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}

/** El super admin le fija una contraseña a otra cuenta. Es la recuperación que no depende
 * de que el mail salga — ver el comentario del service. */
export async function patchPasswordDeAdministrador(
  req: Request,
  res: Response,
) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de cuenta inválido.')
    return
  }

  const bodyParsed = passwordSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    await resetearPasswordDe(
      idParsed.data.id,
      bodyParsed.data.passwordNueva,
      req.admin!.sub,
    )
    res.status(204).end()
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}

/**
 * Cambia el nombre y/o el email de una cuenta.
 *
 * A diferencia de los otros dos `PATCH`, **sí se puede sobre la cuenta propia**: corregirse
 * el mail no es un privilegio que se pueda abusar (hay que estar logueado igual), y
 * prohibirlo dejaría al super admin sin forma de arreglar su propia dirección.
 */
export async function patchAdministrador(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de cuenta inválido.')
    return
  }

  const bodyParsed = datosSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    await actualizarDatosDe(idParsed.data.id, bodyParsed.data)
    res.status(204).end()
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}

/** Borra una cuenta. Ver el service: se borra de verdad porque nada la referencia, y las
 * sesiones de esa cuenta dejan de valer solas. */
export async function deleteAdministrador(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de cuenta inválido.')
    return
  }

  try {
    await eliminarAdministrador(parsed.data.id, req.admin!.sub)
    res.status(204).end()
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}

export async function patchRolDeAdministrador(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de cuenta inválido.')
    return
  }

  const bodyParsed = rolSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      `El rol tiene que ser uno de: ${ROLES.join(', ')}.`,
    )
    return
  }

  try {
    await cambiarRol(idParsed.data.id, bodyParsed.data.rol, req.admin!.sub)
    res.status(204).end()
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}
