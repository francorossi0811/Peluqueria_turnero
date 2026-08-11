import { apiClient } from './client'
import type { Feriado, ModalidadFeriado } from '../types/api'

export async function obtenerFeriados(anio?: number): Promise<Feriado[]> {
  const { data } = await apiClient.get<{ feriados: Feriado[] }>(
    '/admin/feriados',
    { params: anio ? { anio } : undefined },
  )
  return data.feriados
}

export async function actualizarFeriado(
  id: number,
  modalidad: ModalidadFeriado,
): Promise<Feriado> {
  const { data } = await apiClient.patch<Feriado>(`/admin/feriados/${id}`, {
    modalidad,
  })
  return data
}

/** Vuelve a traer los feriados de la fuente externa (HU-24).
 *
 * El backend solo sincroniza solo los años que están vacíos, así que esto es lo único que
 * hace entrar un feriado decretado a mitad de año. */
export async function sincronizarFeriados(
  anio?: number,
): Promise<{ anio: number; importados: number }> {
  const { data } = await apiClient.post<{ anio: number; importados: number }>(
    '/admin/feriados/sincronizar',
    null,
    { params: anio ? { anio } : undefined },
  )
  return data
}
