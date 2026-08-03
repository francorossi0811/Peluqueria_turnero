import { apiClient } from './client'
import type { Feriado } from '../types/api'

export async function obtenerFeriados(anio?: number): Promise<Feriado[]> {
  const { data } = await apiClient.get<{ feriados: Feriado[] }>(
    '/admin/feriados',
    { params: anio ? { anio } : undefined },
  )
  return data.feriados
}

export async function actualizarFeriado(
  id: number,
  bloquea: boolean,
): Promise<Feriado> {
  const { data } = await apiClient.patch<Feriado>(`/admin/feriados/${id}`, {
    bloquea,
  })
  return data
}
