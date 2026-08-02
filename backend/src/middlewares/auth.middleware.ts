import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

interface TokenPayload {
  sub: string
  usuario: string
}

// Valida el JWT en rutas /api/admin/* y deja el payload en `req.admin` (ver
// src/types/express.d.ts) para que la ruta sepa quién está logueado sin volver a
// decodificar. El login que emite el token es HU-15 (src/services/auth.service.ts).
export function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET ?? '') as TokenPayload
    next()
  } catch {
    res.status(401).json({
      error: {
        codigo: 'TOKEN_INVALIDO',
        mensaje: 'El token no es válido o expiró.',
      },
    })
  }
}
