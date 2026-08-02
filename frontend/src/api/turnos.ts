import { apiClient } from './client'
import type { NuevoTurno, Turno } from '../types/api'

export async function crearTurno(datos: NuevoTurno): Promise<Turno> {
  const { data } = await apiClient.post<Turno>('/turnos', datos)
  return data
}
