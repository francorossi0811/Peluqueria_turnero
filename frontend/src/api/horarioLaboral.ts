import { apiClient } from './client'
import type { FranjaHorario } from '../types/api'

export async function obtenerHorarioLaboral(): Promise<FranjaHorario[]> {
  const { data } = await apiClient.get<{ franjas: FranjaHorario[] }>(
    '/admin/horario-laboral',
  )
  return data.franjas
}

export async function guardarHorarioLaboral(
  franjas: FranjaHorario[],
): Promise<FranjaHorario[]> {
  const { data } = await apiClient.put<{ franjas: FranjaHorario[] }>(
    '/admin/horario-laboral',
    { franjas },
  )
  return data.franjas
}
