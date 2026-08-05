import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../config/env'
import { prisma } from '../config/prisma'
import {
  AdministradorNoEncontradoError,
  CredencialesInvalidasError,
  PasswordActualIncorrectaError,
} from './errores'

// HU-15 — Duración de la sesión de Ariel. 7 días con renovación deslizante (ver
// `debeRenovarse`): la peluquería cierra domingo y lunes, así que cualquier duración
// menor a ~3 días le garantizaría un login por semana, justo lo contrario de lo que
// necesita alguien que tiene el panel abierto todo el día.
//
// En segundos (y no '7d') a propósito: el mismo número tiene que servir para firmar y
// para calcular el umbral de renovación. Si fueran dos constantes distintas podrían
// desincronizarse sin que nada falle de forma visible.
const EXPIRACION_TOKEN_SEGUNDOS = 7 * 24 * 60 * 60

/** Fracción de la vida del token a partir de la cual se emite uno nuevo. */
const FRACCION_PARA_RENOVAR = 0.5

interface AdminParaToken {
  id: string
  usuario: string
}

/** Firma un token nuevo. La usan el login, la renovación deslizante y el cambio de
 * contraseña — siempre construyendo el payload desde cero: `jsonwebtoken` rechaza
 * firmar con `expiresIn` un payload que ya trae `exp` (o sea, uno ya verificado). */
export function firmarToken(admin: AdminParaToken): string {
  return jwt.sign({ sub: admin.id, usuario: admin.usuario }, jwtSecret(), {
    expiresIn: EXPIRACION_TOKEN_SEGUNDOS,
  })
}

/** ¿El token ya pasó la mitad de su vida y conviene renovarlo?
 *
 * `ahoraSegundos` se inyecta para poder testear la función sin tocar el reloj. Ojo: son
 * segundos de epoch REAL — no usar `ahoraArgentina()` de utils/fechaHora, que devuelve
 * hora de pared (epoch - 3h) y acá metería un error de 3 horas en silencio. */
export function debeRenovarse(
  payload: { iat?: number; exp?: number },
  ahoraSegundos: number,
): boolean {
  const { iat, exp } = payload
  if (iat === undefined || exp === undefined) return false
  return ahoraSegundos - iat >= (exp - iat) * FRACCION_PARA_RENOVAR
}

/** Un token emitido antes del último cambio de contraseña deja de valer (HU-16).
 *
 * La comparación va en segundos truncados porque `iat` viene truncado: si comparáramos
 * con la precisión de milisegundos de `passwordChangedAt`, el token que emite el propio
 * endpoint de cambio nacería inválido (se firma en el mismo segundo, pero unos
 * milisegundos antes del UPDATE). Por eso `<` estricto sobre segundos. */
export function tokenPrecedeAlCambioDePassword(
  iatSegundos: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  if (iatSegundos === undefined || passwordChangedAt === null) return false
  return iatSegundos < Math.floor(passwordChangedAt.getTime() / 1000)
}

/** HU-16 — ¿Este token quedó invalidado por un cambio de contraseña posterior?
 *
 * Es la única consulta a base que hace `requireAuth`, y rompe a propósito la pureza
 * "stateless" del JWT: sin esto, cambiar la contraseña no cerraría las sesiones ya
 * abiertas y la funcionalidad daría una sensación falsa de seguridad. Es un
 * `findUnique` por clave primaria sobre una tabla de una fila; para un solo usuario el
 * costo es ruido. No cachear en memoria: sería correcto solo mientras Render tenga una
 * única instancia. */
export async function sesionInvalidadaPorCambioDePassword(payload: {
  sub: string
  iat?: number
}): Promise<boolean> {
  const admin = await prisma.administrador.findUnique({
    where: { id: payload.sub },
    select: { passwordChangedAt: true },
  })
  // Si el admin ya no existe, el token tampoco debería valer.
  if (!admin) return true
  return tokenPrecedeAlCambioDePassword(payload.iat, admin.passwordChangedAt)
}

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

  return firmarToken(admin)
}

/** Mismo costo que usa el seed (prisma/seed.ts) para crear la cuenta inicial. */
const COSTO_BCRYPT = 10

/** HU-16 — Ariel cambia su contraseña desde el panel.
 *
 * Devuelve un token nuevo: como el cambio invalida todo token emitido antes (ver
 * `sesionInvalidadaPorCambioDePassword`), sin esto lo dejaríamos afuera del propio
 * navegador donde acaba de tipear la contraseña. */
export async function cambiarPassword(
  adminId: string,
  passwordActual: string,
  passwordNueva: string,
): Promise<string> {
  const admin = await prisma.administrador.findUnique({
    where: { id: adminId },
  })
  if (!admin) throw new AdministradorNoEncontradoError()

  const coincide = await bcrypt.compare(passwordActual, admin.passwordHash)
  if (!coincide) throw new PasswordActualIncorrectaError()

  const passwordHash = await bcrypt.hash(passwordNueva, COSTO_BCRYPT)
  await prisma.administrador.update({
    where: { id: admin.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  })

  return firmarToken(admin)
}
