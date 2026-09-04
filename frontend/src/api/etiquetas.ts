import { apiClient } from './client'
import type { EtiquetaConUso } from '../types/api'

export async function obtenerEtiquetas(): Promise<EtiquetaConUso[]> {
  const { data } = await apiClient.get<{ etiquetas: EtiquetaConUso[] }>(
    '/admin/etiquetas',
  )
  return data.etiquetas
}

export async function crearEtiqueta(datos: {
  nombre: string
  color: string
}): Promise<EtiquetaConUso> {
  const { data } = await apiClient.post<EtiquetaConUso>('/admin/etiquetas', datos)
  return data
}

export async function actualizarEtiqueta(
  id: string,
  datos: { nombre?: string; color?: string },
): Promise<EtiquetaConUso> {
  const { data } = await apiClient.patch<EtiquetaConUso>(
    `/admin/etiquetas/${id}`,
    datos,
  )
  return data
}

export async function eliminarEtiqueta(id: string): Promise<void> {
  await apiClient.delete(`/admin/etiquetas/${id}`)
}
