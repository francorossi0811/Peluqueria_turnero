import { apiClient } from './client'
import type { Me } from '../types/api'

/** HU-26 — Se entra con el email, no con el usuario. */
export async function login(
  email: string,
  password: string,
): Promise<string> {
  const { data } = await apiClient.post<{ token: string }>('/auth/login', {
    email,
    password,
  })
  return data.token
}

/** HU-26 — ¿Mostrar el botón de "me olvidé la contraseña"?
 *
 * Depende de si el servidor tiene un mailer real. Sin cuenta de Brevo el mail se imprime
 * en el log del servidor, y un botón que promete un mail que no llega es peor que no
 * tener botón. */
export async function recuperacionDisponible(): Promise<boolean> {
  const { data } = await apiClient.get<{ disponible: boolean }>(
    '/auth/recuperacion-disponible',
  )
  return data.disponible
}

/** HU-26 — Pide el link de restablecimiento. Responde igual exista o no la cuenta: si
 * cambiara, sería una forma de averiguar qué direcciones tienen cuenta. */
export async function olvidePassword(email: string): Promise<string> {
  const { data } = await apiClient.post<{ mensaje: string }>(
    '/auth/olvide-password',
    { email },
  )
  return data.mensaje
}

/** HU-26 — Fija la contraseña con el token del mail. Devuelve un token de sesión: quien
 * probó tener acceso al mail y eligió una contraseña ya está autenticado. */
export async function restablecerPassword(
  token: string,
  passwordNueva: string,
): Promise<string> {
  const { data } = await apiClient.post<{ token: string }>(
    '/auth/restablecer-password',
    { token, passwordNueva },
  )
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
