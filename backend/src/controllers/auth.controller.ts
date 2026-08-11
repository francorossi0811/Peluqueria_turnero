import { Request, Response } from 'express'
import { z } from 'zod'
import {
  login,
  prepararResetDePassword,
  restablecerPassword,
} from '../services/auth.service'
import { enviarMailDeReset } from '../services/recuperacion.service'
import {
  CredencialesInvalidasError,
  TokenDeResetInvalidoError,
} from '../services/errores'
import { mailEstaConfigurado } from '../services/mail'

/** HU-26 — La credencial es el email. `usuario` quedó como el nombre que se muestra. */
const bodySchema = z.object({
  email: z.email('Poné un email válido.'),
  password: z.string().min(1),
})

/** Cuánto dura el link del mail. Duplicado del service para poder decírselo a la persona
 * en el texto del mail; el que decide es el service. */
const MINUTOS_DE_VIDA_DEL_LINK = 30

/** HU-16 — Mismo mínimo que el cambio de contraseña desde el panel. Que sean dos caminos
 * distintos hacia el mismo campo no puede significar dos reglas distintas. */
const LARGO_MINIMO_PASSWORD = 8

export async function postLogin(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: 'Falta el email o la contraseña.',
      },
    })
    return
  }

  try {
    const token = await login(parsed.data.email, parsed.data.password)
    res.json({ token })
  } catch (err) {
    if (err instanceof CredencialesInvalidasError) {
      res.status(401).json({
        error: {
          codigo: 'CREDENCIALES_INVALIDAS',
          mensaje: 'Email o contraseña incorrectos.',
        },
      })
      return
    }
    throw err
  }
}

/**
 * HU-26 — Le dice al login si mostrar el botón de "me olvidé la contraseña".
 *
 * Es público y no dice nada sensible: solo si el servidor tiene con qué mandar mails.
 * Sin esto, el botón aparecería siempre y le prometería a Ariel un mail que sin cuenta de
 * Brevo se imprime en el log del servidor y no sale a ningún lado.
 */
export function getRecuperacionDisponible(_req: Request, res: Response) {
  res.json({ disponible: mailEstaConfigurado() })
}

const olvideSchema = z.object({ email: z.email('Poné un email válido.') })

/**
 * HU-26 — Pide el link de restablecimiento.
 *
 * **Responde 200 exista o no la cuenta.** Si la respuesta cambiara según el caso, este
 * endpoint sería una forma de averiguar qué direcciones tienen cuenta en el panel. Por el
 * mismo motivo el login no distingue "no existe" de "contraseña incorrecta".
 */
export async function postOlvidePassword(req: Request, res: Response) {
  const parsed = olvideSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Email inválido.',
      },
    })
    return
  }

  const resultado = await prepararResetDePassword(parsed.data.email)

  res.json({
    mensaje:
      'Si esa dirección tiene una cuenta, le mandamos un mail con el link para restablecer la contraseña.',
  })

  // Después de responder y sin `await`, igual que los avisos de turno: el mail no puede
  // hacer que este endpoint tarde ni que falle.
  if (resultado?.admin.email) {
    void enviarMailDeReset(
      resultado.admin.email,
      resultado.admin.usuario,
      resultado.token,
      MINUTOS_DE_VIDA_DEL_LINK,
    )
  }
}

const restablecerSchema = z.object({
  token: z.string().min(1),
  passwordNueva: z
    .string()
    .min(
      LARGO_MINIMO_PASSWORD,
      `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    ),
})

/** HU-26 — Fija la contraseña nueva con el token del mail. Devuelve un token de sesión:
 * quien probó tener acceso a ese mail y eligió una contraseña ya está autenticado. */
export async function postRestablecerPassword(req: Request, res: Response) {
  const parsed = restablecerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
      },
    })
    return
  }

  try {
    const token = await restablecerPassword(
      parsed.data.token,
      parsed.data.passwordNueva,
    )
    res.json({ token })
  } catch (err) {
    if (err instanceof TokenDeResetInvalidoError) {
      res.status(400).json({
        error: {
          codigo: 'TOKEN_DE_RESET_INVALIDO',
          mensaje:
            'Este link ya no sirve: puede haber vencido o haberse usado. Pedí uno nuevo.',
        },
      })
      return
    }
    throw err
  }
}
