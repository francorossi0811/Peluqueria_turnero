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

/** Cambia el rango o el motivo de un bloqueo que ya existe.
 *
 * Manda el cuerpo entero, igual que `crearBloqueo`, y devuelve el mismo 409
 * `BLOQUEO_AFECTA_TURNOS` cuando el rango nuevo se lleva turnos por delante — por eso el
 * modal puede usar las dos con el mismo manejo de error. */
export async function actualizarBloqueo(
  id: string,
  datos: NuevoBloqueo,
): Promise<Bloqueo> {
  const { data } = await apiClient.patch<Bloqueo>(
    `/admin/bloqueos/${id}`,
    datos,
  )
  return data
}

export async function eliminarBloqueo(id: string): Promise<void> {
  await apiClient.delete(`/admin/bloqueos/${id}`)
}
