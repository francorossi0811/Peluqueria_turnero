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

/** HU-29 — Lo que hace falta para resolver la foto: **solo el id**, nunca el binario. Traer
 * `datos` acá metería el archivo entero en cada listado de servicios, que es la consulta que
 * corre en cada visita a la landing. El navegador lo pide aparte por `/api/imagenes/:id`, y
 * cacheado. */
const INCLUDE_IMAGEN = { imagen: { select: { id: true } } } as const

/** Un servicio con su foto subida resuelta. Es lo que consumen los DTO. */
export type ServicioConImagen = Servicio & { imagen: { id: string } | null }

/** HU-01 — Servicios activos, para elegir en el flujo de reserva. */
export async function listarServiciosActivos(): Promise<ServicioConImagen[]> {
  return prisma.servicio.findMany({
    where: { activo: true },
    include: INCLUDE_IMAGEN,
    orderBy: ORDEN_EXHIBICION,
  })
}

/** HU-13 — Todos los servicios, incluidos los inactivos (panel de Ariel). */
export async function listarTodosLosServicios(): Promise<ServicioConImagen[]> {
  return prisma.servicio.findMany({
    include: INCLUDE_IMAGEN,
    orderBy: ORDEN_EXHIBICION,
  })
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
}): Promise<ServicioConImagen> {
  return prisma.servicio.create({
    data: { ...datos, orden: await proximoOrden() },
    include: INCLUDE_IMAGEN,
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
): Promise<ServicioConImagen> {
  await obtenerServicioPorId(id)
  return prisma.servicio.update({
    where: { id },
    data: datos,
    include: INCLUDE_IMAGEN,
  })
}
