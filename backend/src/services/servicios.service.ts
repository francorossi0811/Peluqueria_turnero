import { prisma } from '../config/prisma'
import { ServicioNoEncontradoError } from './errores'
import type { Servicio } from '../../generated/prisma/client.ts'

/** Orden en que se muestran: el que Ariel definió (del más pedido al menos), y el nombre
 * como desempate para que dos servicios con el mismo `orden` —los nuevos nacen en 0— no
 * queden en un orden arbitrario que cambie entre consultas. */
const ORDEN_EXHIBICION = [
  { orden: 'asc' },
  { nombre: 'asc' },
] satisfies { orden?: 'asc'; nombre?: 'asc' }[]

/** HU-01 — Servicios activos, para elegir en el flujo de reserva. */
export async function listarServiciosActivos(): Promise<Servicio[]> {
  return prisma.servicio.findMany({
    where: { activo: true },
    orderBy: ORDEN_EXHIBICION,
  })
}

/** HU-13 — Todos los servicios, incluidos los inactivos (panel de Ariel). */
export async function listarTodosLosServicios(): Promise<Servicio[]> {
  return prisma.servicio.findMany({ orderBy: ORDEN_EXHIBICION })
}

/** Un servicio nuevo va al final de la lista, no al principio: dejarlo en `orden` 0 lo
 * pondría delante de los que Ariel ya ordenó. */
async function proximoOrden(): Promise<number> {
  const ultimo = await prisma.servicio.findFirst({
    orderBy: { orden: 'desc' },
    select: { orden: true },
  })
  return (ultimo?.orden ?? 0) + 1
}

export async function obtenerServicioPorId(id: string): Promise<Servicio> {
  const servicio = await prisma.servicio.findUnique({ where: { id } })
  if (!servicio) throw new ServicioNoEncontradoError()
  return servicio
}

export async function crearServicio(datos: {
  nombre: string
  duracionMinutos: number
  precio?: number | null
}): Promise<Servicio> {
  return prisma.servicio.create({
    data: { ...datos, orden: await proximoOrden() },
  })
}

export async function actualizarServicio(
  id: string,
  datos: {
    nombre?: string
    duracionMinutos?: number
    activo?: boolean
    // HU-27 — `null` es un valor válido y no "no lo mandes": es cómo Ariel le saca el
    // precio a un servicio que había cargado.
    precio?: number | null
  },
): Promise<Servicio> {
  await obtenerServicioPorId(id)
  return prisma.servicio.update({ where: { id }, data: datos })
}
