import { apiClient } from './client'
import type { Etiqueta } from '../types/api'

export async function obtenerEtiquetas(): Promise<Etiqueta[]> {
  const { data } = await apiClient.get<{ etiquetas: Etiqueta[] }>(
    '/admin/etiquetas',
  )
  return data.etiquetas
}

export async function crearEtiqueta(datos: {
  nombre: string
  color: string
}): Promise<Etiqueta> {
  const { data } = await apiClient.post<Etiqueta>('/admin/etiquetas', datos)
  return data
}

export async function actualizarEtiqueta(
  id: string,
  datos: { nombre?: string; color?: string },
): Promise<Etiqueta> {
  const { data } = await apiClient.patch<Etiqueta>(
    `/admin/etiquetas/${id}`,
    datos,
  )
  return data
}

export async function eliminarEtiqueta(id: string): Promise<void> {
  await apiClient.delete(`/admin/etiquetas/${id}`)
}
