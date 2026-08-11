import type { RolAdmin } from '../../generated/prisma/client.ts'

export {}

declare global {
  namespace Express {
    interface Request {
      // `rol` (HU-26) sale de la **base**, no del token: si se leyera del JWT, cambiarle
      // el rol a alguien no tendría efecto hasta que venciera su sesión, que dura 7 días.
      // No cuesta una consulta extra — `requireAuth` ya consultaba esta misma fila para
      // saber si el token quedó invalidado por un cambio de contraseña.
      admin?: { sub: string; usuario: string; rol: RolAdmin }
    }
  }
}
