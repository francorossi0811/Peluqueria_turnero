import { apiClient } from './client'
import type { NuevoTurno, Reprogramacion, Turno } from '../types/api'

export async function crearTurno(datos: NuevoTurno): Promise<Turno> {
  const { data } = await apiClient.post<Turno>('/turnos', datos)
  return data
}

export async function obtenerTurno(id: string): Promise<Turno> {
  const { data } = await apiClient.get<Turno>(`/turnos/${id}`)
  return data
}

export async function cancelarTurno(id: string): Promise<Turno> {
  const { data } = await apiClient.post<Turno>(`/turnos/${id}/cancelar`)
  return data
}

export async function reprogramarTurno(
  id: string,
  datos: Reprogramacion,
): Promise<Turno> {
  const { data } = await apiClient.post<Turno>(
    `/turnos/${id}/reprogramar`,
    datos,
  )
  return data
}
