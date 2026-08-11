// HU-26 — Administración de cuentas del panel. Solo para el super admin.
//
// Es lo único que un `admin` no puede hacer: todo el resto del panel *es* gestionar la
// peluquería. Vale decirlo explícito para que nadie busque una segunda diferencia que no
// existe.

import bcrypt from 'bcrypt'
import { prisma } from '../config/prisma'
import { normalizarEmail } from './auth.service'
import {
  AdministradorNoEncontradoError,
  EmailDuplicadoError,
  NoAutorizadoError,
} from './errores'
import type { RolAdmin } from '../../generated/prisma/client.ts'

/** Mismo costo que el seed y que el cambio de contraseña. */
const COSTO_BCRYPT = 10

const PRISMA_UNIQUE_VIOLATION = 'P2002'

function esDuplicado(err: unknown): boolean {
  return (err as { code?: string })?.code === PRISMA_UNIQUE_VIOLATION
}

export interface AdministradorResumen {
  id: string
  usuario: string
  email: string | null
  rol: RolAdmin
  creadaEn: Date
  passwordCambiadaEn: Date | null
}

export async function listarAdministradores(): Promise<AdministradorResumen[]> {
  const admins = await prisma.administrador.findMany({
    select: {
      id: true,
      usuario: true,
      email: true,
      rol: true,
      createdAt: true,
      passwordChangedAt: true,
    },
    orderBy: [{ rol: 'asc' }, { usuario: 'asc' }],
  })

  return admins.map((a) => ({
    id: a.id,
    usuario: a.usuario,
    email: a.email,
    rol: a.rol,
    creadaEn: a.createdAt,
    passwordCambiadaEn: a.passwordChangedAt,
  }))
}

export async function crearAdministrador(datos: {
  usuario: string
  email: string
  password: string
  rol: RolAdmin
}) {
  try {
    return await prisma.administrador.create({
      data: {
        usuario: datos.usuario,
        email: normalizarEmail(datos.email),
        rol: datos.rol,
        passwordHash: await bcrypt.hash(datos.password, COSTO_BCRYPT),
      },
      select: { id: true, usuario: true, email: true, rol: true },
    })
  } catch (err) {
    // El nombre y el email son los dos únicos, así que el mensaje habla de los dos: no
    // vale la pena una consulta extra para distinguir cuál chocó.
    if (esDuplicado(err)) throw new EmailDuplicadoError()
    throw err
  }
}

/**
 * El super admin le fija una contraseña nueva a otra cuenta.
 *
 * **Es la recuperación que funciona sin depender del mail**, y por eso existe: mientras no
 * haya cuenta de Brevo cargada, el link de "me olvidé la contraseña" no sale a ningún
 * lado, y sin esto la única salida sería entrar a la base a mano.
 *
 * Escribir `passwordChangedAt` no es un detalle: es lo que cierra las sesiones abiertas de
 * esa cuenta. Si a alguien le tienen que resetear la contraseña, lo que menos querés es
 * que la sesión vieja siga viva en el dispositivo donde estaba.
 *
 * No se puede usar sobre uno mismo: para eso está "Mi cuenta" (HU-16), que pide la
 * contraseña actual. Sin esa regla, esta pantalla sería una forma de cambiarse la propia
 * contraseña sin conocer la anterior — o sea, de aprovechar una sesión robada.
 */
export async function resetearPasswordDe(
  adminId: string,
  passwordNueva: string,
  quienLoPide: string,
): Promise<void> {
  if (adminId === quienLoPide) throw new NoAutorizadoError()

  const admin = await prisma.administrador.findUnique({ where: { id: adminId } })
  if (!admin) throw new AdministradorNoEncontradoError()

  await prisma.administrador.update({
    where: { id: adminId },
    data: {
      passwordHash: await bcrypt.hash(passwordNueva, COSTO_BCRYPT),
      passwordChangedAt: new Date(),
    },
  })
}

/**
 * Cambia el nombre y/o el email de una cuenta.
 *
 * Existe porque, sin esto, **un email cargado no se podía cambiar por ningún lado**: el
 * seed solo lo completa cuando está vacío y el panel no lo editaba. Un mail mal tipeado
 * —o un placeholder puesto durante el desarrollo— quedaba clavado para siempre, y como el
 * login es por email, eso es una cuenta que no se puede arreglar sin entrar a la base.
 *
 * **No toca la contraseña ni el rol**: cada uno tiene su endpoint. Cambiar el email no
 * invalida la sesión, a diferencia de la contraseña — no cambia quién es la persona, solo
 * cómo se la identifica al entrar.
 */
export async function actualizarDatosDe(
  adminId: string,
  datos: { usuario?: string; email?: string },
): Promise<void> {
  const admin = await prisma.administrador.findUnique({ where: { id: adminId } })
  if (!admin) throw new AdministradorNoEncontradoError()

  try {
    await prisma.administrador.update({
      where: { id: adminId },
      data: {
        ...(datos.usuario !== undefined ? { usuario: datos.usuario } : {}),
        ...(datos.email !== undefined
          ? { email: normalizarEmail(datos.email) }
          : {}),
      },
    })
  } catch (err) {
    if (esDuplicado(err)) throw new EmailDuplicadoError()
    throw err
  }
}

/**
 * Borra una cuenta del panel.
 *
 * **Se borra de verdad, no se desactiva**, y hay un criterio detrás. Un turno nunca se
 * borra porque otras filas lo referencian y quedarían sin sentido; una cuenta de
 * administrador **no está referenciada por ninguna tabla** (`administradores` no tiene
 * relaciones — ver Docs/modelo-datos.md, y `push_suscripciones` a propósito tampoco), así
 * que borrarla no deja ningún registro incompleto atrás. Es el mismo razonamiento que
 * `eliminarEtiqueta`.
 *
 * **Las sesiones de esa cuenta mueren solas.** `estadoDeSesion` devuelve `null` cuando no
 * encuentra la fila, y `requireAuth` traduce eso a 401. No hace falta invalidar nada a
 * mano: si la cuenta no existe, su token no vale.
 *
 * Un solo candado: **nadie se borra a sí mismo.** Y con eso alcanza para no quedarse sin
 * administrador general — el que llama siempre es un `super_admin` (lo garantiza
 * `requireSuperAdmin`) y no puede ser el borrado, así que después de cualquier borrado
 * queda al menos uno. Por eso acá no va el chequeo del "último super admin" que sí tiene
 * `cambiarRol`, donde el que se degrada puede ser otro.
 */
export async function eliminarAdministrador(
  adminId: string,
  quienLoPide: string,
): Promise<void> {
  if (adminId === quienLoPide) throw new NoAutorizadoError()

  const admin = await prisma.administrador.findUnique({ where: { id: adminId } })
  if (!admin) throw new AdministradorNoEncontradoError()

  await prisma.administrador.delete({ where: { id: adminId } })
}

/**
 * Cambia el rol de una cuenta.
 *
 * Dos candados, y los dos son contra el mismo accidente —quedarse sin nadie que pueda
 * administrar cuentas—, que no tiene arreglo desde la aplicación:
 *
 * 1. Nadie se puede cambiar el rol a sí mismo.
 * 2. No se puede bajar al último super admin que queda.
 */
export async function cambiarRol(
  adminId: string,
  rol: RolAdmin,
  quienLoPide: string,
): Promise<void> {
  if (adminId === quienLoPide) throw new NoAutorizadoError()

  const admin = await prisma.administrador.findUnique({ where: { id: adminId } })
  if (!admin) throw new AdministradorNoEncontradoError()

  if (admin.rol === 'super_admin' && rol !== 'super_admin') {
    const cuantos = await prisma.administrador.count({
      where: { rol: 'super_admin' },
    })
    if (cuantos <= 1) throw new NoAutorizadoError()
  }

  await prisma.administrador.update({ where: { id: adminId }, data: { rol } })
}
