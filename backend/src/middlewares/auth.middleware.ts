import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../config/env'
import {
  debeRenovarse,
  firmarToken,
  sesionInvalidadaPorCambioDePassword,
} from '../services/auth.service'

// `iat`/`exp` los agrega jsonwebtoken al firmar; los necesitamos acá para decidir la
// renovación, pero no se propagan a `req.admin` (ver src/types/express.d.ts): el resto
// de la app no tiene por qué conocer los claims de reloj del token.
interface TokenPayload {
  sub: string
  usuario: string
  iat?: number
  exp?: number
}

/** Header por el que viaja el token renovado. Tiene que estar en `exposedHeaders` del
 * CORS (ver src/app.ts) o el browser no lo ve cuando el front está en otro dominio. */
export const HEADER_TOKEN_RENOVADO = 'X-Token-Renovado'

// Valida el JWT en rutas /api/admin/* y deja el payload en `req.admin` (ver
// src/types/express.d.ts) para que la ruta sepa quién está logueado sin volver a
// decodificar. El login que emite el token es HU-15 (src/services/auth.service.ts).
//
// Además implementa la renovación deslizante (HU-15): cada request autenticado
// funciona como latido, así que mientras Ariel use el panel su sesión no vence nunca.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({
      error: {
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Falta el token de autenticación.',
      },
    })
    return
  }

  let payload: TokenPayload
  try {
    payload = jwt.verify(token, jwtSecret()) as TokenPayload
  } catch {
    res.status(401).json({
      error: {
        codigo: 'TOKEN_INVALIDO',
        mensaje: 'El token no es válido o expiró.',
      },
    })
    return
  }

  // Antes de renovar, no después: si no, un token ya invalidado se renovaría a sí mismo
  // indefinidamente y el cambio de contraseña nunca cerraría esa sesión.
  if (await sesionInvalidadaPorCambioDePassword(payload)) {
    res.status(401).json({
      error: {
        codigo: 'TOKEN_INVALIDO',
        mensaje: 'El token no es válido o expiró.',
      },
    })
    return
  }

  req.admin = { sub: payload.sub, usuario: payload.usuario }

  if (debeRenovarse(payload, Math.floor(Date.now() / 1000))) {
    res.setHeader(
      HEADER_TOKEN_RENOVADO,
      firmarToken({ id: payload.sub, usuario: payload.usuario }),
    )
  }

  next()
}
