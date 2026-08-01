import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

// Esqueleto: valida el JWT en rutas /api/admin/*. El login que emite el token (HU-15)
// se implementa en la próxima etapa.
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
    jwt.verify(token, process.env.JWT_SECRET ?? '')
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
