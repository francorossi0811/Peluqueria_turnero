import { prisma } from '../config/prisma'
import { ServicioNoEncontradoError } from './errores'
import type { Servicio } from '../../generated/prisma/client.ts'

/** HU-01 — Servicios activos, para elegir en el flujo de reserva. */
export async function listarServiciosActivos(): Promise<Servicio[]> {
  return prisma.servicio.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  })
}

/** HU-13 — Todos los servicios, incluidos los inactivos (panel de Ariel). */
export async function listarTodosLosServicios(): Promise<Servicio[]> {
  return prisma.servicio.findMany({ orderBy: { nombre: 'asc' } })
}

export async function obtenerServicioPorId(id: string): Promise<Servicio> {
  const servicio = await prisma.servicio.findUnique({ where: { id } })
  if (!servicio) throw new ServicioNoEncontradoError()
  return servicio
}

export async function crearServicio(datos: {
  nombre: string
  duracionMinutos: number
}): Promise<Servicio> {
  return prisma.servicio.create({ data: datos })
}

export async function actualizarServicio(
  id: string,
  datos: { nombre?: string; duracionMinutos?: number; activo?: boolean },
): Promise<Servicio> {
  await obtenerServicioPorId(id)
  return prisma.servicio.update({ where: { id }, data: datos })
}
