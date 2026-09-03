import { apiClient } from './client'
import type {
  NuevoGrupoDeTurnos,
  NuevoTurno,
  Reprogramacion,
  Turno,
} from '../types/api'

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

/** HU-31 — Reservar varios de una. Endpoint aparte del de arriba a propósito: reservar un
 * turno solo no pasa por una sola línea de código nueva, ni acá ni en el backend. */
export async function crearTurnosEnGrupo(
  datos: NuevoGrupoDeTurnos,
): Promise<Turno[]> {
  const { data } = await apiClient.post<Turno[]>('/turnos/grupo', datos)
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

/** HU-19 — Cargar el mail después de haber reservado sin dejarlo, para recibir el link.
 * El backend lo acepta una sola vez por turno (ver especificacion-api.md). */
export async function enviarConfirmacion(
  id: string,
  email: string,
): Promise<{ email: string }> {
  const { data } = await apiClient.post<{ email: string }>(
    `/turnos/${id}/enviar-confirmacion`,
    { email },
  )
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
