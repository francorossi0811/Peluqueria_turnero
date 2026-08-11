import { apiClient } from './client'
import type { ResumenCobros } from '../types/api'

/** HU-27 — Lo cobrado entre dos fechas, inclusive en los dos extremos. */
export async function obtenerCobros(
  desde: string,
  hasta: string,
): Promise<ResumenCobros> {
  const { data } = await apiClient.get<ResumenCobros>('/admin/cobros', {
    params: { desde, hasta },
  })
  return data
}
