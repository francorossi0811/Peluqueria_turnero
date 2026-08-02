import { apiClient } from './client'
import type { Bloqueo, NuevoBloqueo } from '../types/api'

export async function obtenerBloqueos(
  desde: string,
  hasta: string,
): Promise<Bloqueo[]> {
  const { data } = await apiClient.get<{ bloqueos: Bloqueo[] }>(
    '/admin/bloqueos',
    { params: { desde, hasta } },
  )
  return data.bloqueos
}

export async function crearBloqueo(datos: NuevoBloqueo): Promise<Bloqueo> {
  const { data } = await apiClient.post<Bloqueo>('/admin/bloqueos', datos)
  return data
}

export async function eliminarBloqueo(id: string): Promise<void> {
  await apiClient.delete(`/admin/bloqueos/${id}`)
}
