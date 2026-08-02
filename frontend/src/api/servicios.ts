import { apiClient } from './client'
import type { Servicio } from '../types/api'

export async function obtenerServicios(): Promise<Servicio[]> {
  const { data } = await apiClient.get<{ servicios: Servicio[] }>('/servicios')
  return data.servicios
}
