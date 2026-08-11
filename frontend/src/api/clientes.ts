import { apiClient } from './client'
import type {
  ClienteDeTurno,
  ClienteFicha,
  ClienteResumen,
  DatosCliente,
} from '../types/api'

export interface FiltrosClientes {
  buscar?: string
  etiquetaId?: string
}

/** Los filtros vacíos no viajan: `?buscar=` con string vacío ensucia la queryKey de
 * react-query y hace que dos estados idénticos se traten como consultas distintas. */
function params(filtros: FiltrosClientes) {
  return {
    ...(filtros.buscar ? { buscar: filtros.buscar } : {}),
    ...(filtros.etiquetaId ? { etiquetaId: filtros.etiquetaId } : {}),
  }
}

export async function obtenerClientes(
  filtros: FiltrosClientes = {},
): Promise<ClienteResumen[]> {
  const { data } = await apiClient.get<{ clientes: ClienteResumen[] }>(
    '/admin/clientes',
    { params: params(filtros) },
  )
  return data.clientes
}

export async function obtenerCliente(id: string): Promise<ClienteFicha> {
  const { data } = await apiClient.get<ClienteFicha>(`/admin/clientes/${id}`)
  return data
}

export async function actualizarCliente(
  id: string,
  datos: DatosCliente,
): Promise<ClienteDeTurno> {
  const { data } = await apiClient.patch<ClienteDeTurno>(
    `/admin/clientes/${id}`,
    datos,
  )
  return data
}
