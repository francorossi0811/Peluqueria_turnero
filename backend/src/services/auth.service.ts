import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma'
import { CredencialesInvalidasError } from './errores'

const EXPIRACION_TOKEN = '7d'

/** HU-15 — Login de Ariel. No distingue "usuario inexistente" de "contraseña
 * incorrecta" en el error: por seguridad, siempre el mismo mensaje genérico. */
export async function login(
  usuario: string,
  password: string,
): Promise<string> {
  const admin = await prisma.administrador.findUnique({ where: { usuario } })
  if (!admin) throw new CredencialesInvalidasError()

  const coincide = await bcrypt.compare(password, admin.passwordHash)
  if (!coincide) throw new CredencialesInvalidasError()

  return jwt.sign(
    { sub: admin.id, usuario: admin.usuario },
    process.env.JWT_SECRET ?? '',
    {
      expiresIn: EXPIRACION_TOKEN,
    },
  )
}
