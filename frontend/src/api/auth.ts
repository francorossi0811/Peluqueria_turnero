import { apiClient } from './client'
import type { Me } from '../types/api'

export async function login(
  usuario: string,
  password: string,
): Promise<string> {
  const { data } = await apiClient.post<{ token: string }>('/auth/login', {
    usuario,
    password,
  })
  return data.token
}

export async function obtenerMe(): Promise<Me> {
  const { data } = await apiClient.get<Me>('/admin/me')
  return data
}

/** HU-16 — Devuelve un token nuevo: el cambio invalida los emitidos antes, así que hay
 * que reemplazar el guardado o la sesión actual queda muerta. */
export async function cambiarPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<string> {
  const { data } = await apiClient.patch<{ token: string }>('/admin/password', {
    passwordActual,
    passwordNueva,
  })
  return data.token
}
