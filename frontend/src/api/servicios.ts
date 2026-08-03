import { apiClient } from './client'
import type { DatosServicio, Servicio, ServicioAdmin } from '../types/api'

export async function obtenerServicios(): Promise<Servicio[]> {
  const { data } = await apiClient.get<{ servicios: Servicio[] }>('/servicios')
  return data.servicios
}

export async function obtenerServiciosAdmin(): Promise<ServicioAdmin[]> {
  const { data } = await apiClient.get<{ servicios: ServicioAdmin[] }>(
    '/admin/servicios',
  )
  return data.servicios
}

export async function crearServicio(
  datos: DatosServicio,
): Promise<ServicioAdmin> {
  const { data } = await apiClient.post<ServicioAdmin>(
    '/admin/servicios',
    datos,
  )
  return data
}

export async function actualizarServicio(
  id: string,
  datos: Partial<DatosServicio & { activo: boolean }>,
): Promise<ServicioAdmin> {
  const { data } = await apiClient.patch<ServicioAdmin>(
    `/admin/servicios/${id}`,
    datos,
  )
  return data
}
