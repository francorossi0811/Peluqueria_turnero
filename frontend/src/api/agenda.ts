import { apiClient } from './client'
import type { EditarTurno, NuevoTurnoManual, TurnoAdmin } from '../types/api'

export interface Agenda {
  turnos: TurnoAdmin[]
  /** HU-17 — Turnos sin ver que caen después del rango que está en pantalla. */
  nuevosMasAdelante: number
}

export async function obtenerAgenda(
  desde: string,
  hasta: string,
): Promise<Agenda> {
  const { data } = await apiClient.get<Agenda>('/admin/turnos', {
    params: { desde, hasta },
  })
  return { turnos: data.turnos, nuevosMasAdelante: data.nuevosMasAdelante ?? 0 }
}

export async function cargarTurnoManual(
  datos: NuevoTurnoManual,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.post<TurnoAdmin>('/admin/turnos', datos)
  return data
}

export async function editarTurno(
  id: string,
  datos: EditarTurno,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}`,
    datos,
  )
  return data
}

export async function cancelarTurnoAdmin(id: string): Promise<TurnoAdmin> {
  const { data } = await apiClient.post<TurnoAdmin>(
    `/admin/turnos/${id}/cancelar`,
  )
  return data
}

export async function marcarEstadoTurno(
  id: string,
  estado: 'realizado' | 'ausente',
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}/estado`,
    { estado },
  )
  return data
}

/** HU-17 — Saca el resaltado de "nuevo" a los turnos que Ariel ya miró. */
export async function marcarTurnosVistos(ids: string[]): Promise<number> {
  const { data } = await apiClient.post<{ marcados: number }>(
    '/admin/turnos/marcar-vistos',
    { ids },
  )
  return data.marcados
}

export async function buscarTurnos(params: {
  nombre?: string
  telefono?: string
}): Promise<TurnoAdmin[]> {
  const { data } = await apiClient.get<{ turnos: TurnoAdmin[] }>(
    '/admin/turnos/buscar',
    { params },
  )
  return data.turnos
}
