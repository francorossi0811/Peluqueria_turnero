import { apiClient } from './client'
import type { DisponibilidadDia } from '../types/api'

export async function obtenerDisponibilidad(
  servicioId: string,
  desde: string,
  hasta: string,
): Promise<DisponibilidadDia[]> {
  const { data } = await apiClient.get<{ disponibilidad: DisponibilidadDia[] }>(
    '/disponibilidad',
    {
      params: { servicioId, desde, hasta },
    },
  )
  return data.disponibilidad
}
