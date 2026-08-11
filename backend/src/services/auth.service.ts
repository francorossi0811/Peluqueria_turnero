import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../config/env'
import { prisma } from '../config/prisma'
import type { RolAdmin } from '../../generated/prisma/client.ts'
import {
  AdministradorNoEncontradoError,
  CredencialesInvalidasError,
  PasswordActualIncorrectaError,
  TokenDeResetInvalidoError,
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

/**
 * HU-16 + HU-26 — Lo que `requireAuth` necesita saber de la base en cada request: si el
 * token quedó invalidado por un cambio de contraseña, y con qué rol está entrando.
 *
 * Es **una sola consulta** para las dos cosas. Antes ya se hacía una por el primer motivo,
 * así que el rol sale gratis — y sacarlo de la base y no del token es lo que hace que
 * cambiarle el rol a alguien tenga efecto en el próximo request en vez de en 7 días.
 *
 * Devuelve `null` cuando la sesión no vale (cuenta borrada o token viejo), que es lo que
 * el middleware traduce a 401.
 */
export async function estadoDeSesion(payload: {
  sub: string
  iat?: number
}): Promise<{ rol: RolAdmin } | null> {
  const admin = await prisma.administrador.findUnique({
    where: { id: payload.sub },
    select: { passwordChangedAt: true, rol: true },
  })
  if (!admin) return null
  if (tokenPrecedeAlCambioDePassword(payload.iat, admin.passwordChangedAt)) {
    return null
  }
  return { rol: admin.rol }
}

/** HU-15, HU-26 — Login. **La credencial es el email**, no el usuario: `usuario` quedó
 * como el nombre que se muestra en el panel.
 *
 * No distingue "no existe esa cuenta" de "contraseña incorrecta": siempre el mismo error
 * genérico, para no confirmarle a nadie qué direcciones tienen cuenta.
 *
 * El email se normaliza a minúsculas porque las direcciones no distinguen mayúsculas en
 * la práctica, y nadie tipea su mail igual dos veces. Se compara contra la columna en
 * minúsculas: el seed y el alta las guardan así. */
export async function login(email: string, password: string): Promise<string> {
  const admin = await prisma.administrador.findUnique({
    where: { email: normalizarEmail(email) },
  })
  if (!admin) throw new CredencialesInvalidasError()

  const coincide = await bcrypt.compare(password, admin.passwordHash)
  if (!coincide) throw new CredencialesInvalidasError()

  return firmarToken(admin)
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Mismo costo que usa el seed (prisma/seed.ts) para crear la cuenta inicial. */
const COSTO_BCRYPT = 10

// --- HU-26: restablecer la contraseña -------------------------------------------------

/** El link de "me olvidé la contraseña" vale 30 minutos. Corto a propósito: es un token
 * que viaja por mail y queda escrito en la bandeja de entrada para siempre. */
const EXPIRACION_RESET_SEGUNDOS = 30 * 60

/**
 * El secreto con el que se firma un token de restablecimiento: el secreto global **más el
 * hash actual de la contraseña de esa cuenta**.
 *
 * De acá sale la propiedad que importa: **el token se invalida solo al usarse**. Al
 * restablecer, el hash cambia; el token viejo se firmó con el hash anterior, así que deja
 * de verificar. Un solo uso, sin tabla de tokens, sin job que limpie los vencidos y sin
 * estado que se pueda desincronizar.
 *
 * De regalo, pedir un link nuevo no invalida el anterior (los dos se firman con el mismo
 * hash), lo cual es lo que uno espera cuando toca "reenviar" dos veces. Y cambiar la
 * contraseña desde el panel invalida cualquier link pendiente.
 */
function secretoDeReset(passwordHash: string): string {
  return `${jwtSecret()}.${passwordHash}`
}

interface PayloadReset {
  sub: string
  tipo: 'reset'
}

export function firmarTokenDeReset(admin: {
  id: string
  passwordHash: string
}): string {
  const payload: PayloadReset = { sub: admin.id, tipo: 'reset' }
  return jwt.sign(payload, secretoDeReset(admin.passwordHash), {
    expiresIn: EXPIRACION_RESET_SEGUNDOS,
  })
}

/**
 * Valida un token de restablecimiento y devuelve de quién es.
 *
 * El `decode` sin verificar de la primera línea no es un descuido: hace falta para saber a
 * qué cuenta pertenece el token y así poder buscar su hash, que es parte del secreto con
 * el que se verifica. Nada de lo decodificado se usa como verdad — el `verify` de abajo es
 * el que decide, y si el token fuera falso no habría hash con el que pudiera verificar.
 */
export async function adminDeTokenDeReset(token: string) {
  const sinVerificar = jwt.decode(token)
  const sub =
    sinVerificar && typeof sinVerificar === 'object'
      ? (sinVerificar as { sub?: unknown }).sub
      : null
  if (typeof sub !== 'string') throw new TokenDeResetInvalidoError()

  const admin = await prisma.administrador.findUnique({ where: { id: sub } })
  if (!admin) throw new TokenDeResetInvalidoError()

  let payload: PayloadReset
  try {
    payload = jwt.verify(
      token,
      secretoDeReset(admin.passwordHash),
    ) as PayloadReset
  } catch {
    throw new TokenDeResetInvalidoError()
  }

  // Sin esto, un token de sesión normal (firmado con el secreto pelado) no serviría igual
  // —el secreto es distinto— pero el chequeo deja explícito que estos dos tipos de token
  // no son intercambiables.
  if (payload.tipo !== 'reset') throw new TokenDeResetInvalidoError()

  return admin
}

/**
 * HU-26 — Genera el link de restablecimiento para un email.
 *
 * Devuelve `null` si no hay cuenta con ese email, y **el llamador tiene que responder lo
 * mismo igual**: si la respuesta cambiara, el endpoint sería una forma de averiguar qué
 * direcciones tienen cuenta en el panel.
 */
export async function prepararResetDePassword(
  email: string,
): Promise<{ admin: { id: string; usuario: string; email: string | null }; token: string } | null> {
  const admin = await prisma.administrador.findUnique({
    where: { email: normalizarEmail(email) },
  })
  if (!admin) return null

  return { admin, token: firmarTokenDeReset(admin) }
}

/** HU-26 — Fija la contraseña nueva a partir del token del mail.
 *
 * Devuelve un token de sesión: quien acaba de probar que tiene acceso a ese mail y eligió
 * una contraseña nueva ya está autenticado, y mandarlo de vuelta al login a tipear lo que
 * escribió hace dos segundos no agrega seguridad. */
export async function restablecerPassword(
  token: string,
  passwordNueva: string,
): Promise<string> {
  const admin = await adminDeTokenDeReset(token)

  const passwordHash = await bcrypt.hash(passwordNueva, COSTO_BCRYPT)
  await prisma.administrador.update({
    where: { id: admin.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  })

  return firmarToken(admin)
}

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
