import { prisma } from '../config/prisma'
import { FeriadoNoEncontradoError } from './errores'
import type { Feriado } from '../../generated/prisma/client.ts'

/**
 * La sincronización con una fuente externa de feriados (mencionada en
 * Docs/especificacion-api.md) queda pendiente: requiere elegir un proveedor concreto,
 * una decisión de producto que no me corresponde tomar solo. Esta capa solo lee/edita
 * lo que ya esté cargado en la tabla `feriados` (hoy vacía).
 */
export async function listarFeriados(anio?: number): Promise<Feriado[]> {
  if (!anio) {
    return prisma.feriado.findMany({ orderBy: { fecha: 'asc' } })
  }
  return prisma.feriado.findMany({
    where: {
      fecha: {
        gte: new Date(Date.UTC(anio, 0, 1)),
        lte: new Date(Date.UTC(anio, 11, 31)),
      },
    },
    orderBy: { fecha: 'asc' },
  })
}

export async function actualizarFeriado(
  id: number,
  bloquea: boolean,
): Promise<Feriado> {
  const feriado = await prisma.feriado.findUnique({ where: { id } })
  if (!feriado) throw new FeriadoNoEncontradoError()

  return prisma.feriado.update({ where: { id }, data: { bloquea } })
}
