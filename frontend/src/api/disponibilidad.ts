import { apiClient } from './client'
import type { DisponibilidadDia } from '../types/api'

export async function obtenerDisponibilidad(
  servicioId: string,
  desde: string,
  hasta: string,
): Promise<DisponibilidadDia[]> {
  const { data } = await apiClient.get<{ disponibilidad: DisponibilidadDia[] }>(
    '/disponibilidad',
    {
      params: { servicioId, desde, hasta },
    },
  )
  return data.disponibilidad
}

/** HU-08 — La disponibilidad con las reglas de Ariel: sin la antelación de 30 minutos que
 * se le exige al cliente, y con `incluirPasado` los últimos días, para registrar a los
 * clientes de vidriera que atendió y todavía no cargó.
 *
 * Es una función aparte y no un parámetro de `obtenerDisponibilidad` porque son dos rutas
 * distintas: la pública no cambia. */
export async function obtenerDisponibilidadAdmin(
  servicioId: string,
  desde: string,
  hasta: string,
  opciones: { incluirPasado?: boolean } = {},
): Promise<DisponibilidadDia[]> {
  const { data } = await apiClient.get<{ disponibilidad: DisponibilidadDia[] }>(
    '/admin/disponibilidad',
    {
      params: {
        servicioId,
        desde,
        hasta,
        ...(opciones.incluirPasado ? { incluirPasado: 'true' } : {}),
      },
    },
  )
  return data.disponibilidad
}
