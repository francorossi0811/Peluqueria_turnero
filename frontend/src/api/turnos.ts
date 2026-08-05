import { apiClient } from './client'
import type { NuevoTurno, Reprogramacion, Turno } from '../types/api'

/** HU-19 — URL de descarga del turno como evento de calendario.
 *
 * Es un link directo y no una llamada de axios: el navegador tiene que recibirlo como
 * archivo para que el sistema operativo lo abra con la app de calendario. */
export function urlCalendario(turnoId: string): string {
  return `${import.meta.env.VITE_API_URL}/turnos/${turnoId}/calendario.ics`
}

export async function crearTurno(datos: NuevoTurno): Promise<Turno> {
  const { data } = await apiClient.post<Turno>('/turnos', datos)
  return data
}

export async function obtenerTurno(id: string): Promise<Turno> {
  const { data } = await apiClient.get<Turno>(`/turnos/${id}`)
  return data
}

export async function cancelarTurno(id: string): Promise<Turno> {
  const { data } = await apiClient.post<Turno>(`/turnos/${id}/cancelar`)
  return data
}

export async function reprogramarTurno(
  id: string,
  datos: Reprogramacion,
): Promise<Turno> {
  const { data } = await apiClient.post<Turno>(
    `/turnos/${id}/reprogramar`,
    datos,
  )
  return data
}
