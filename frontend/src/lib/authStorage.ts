import { estaVencido } from './jwt'

const CLAVE_TOKEN = 'turnero_admin_token'

export function getToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN)
}

/** Como `getToken`, pero descarta (y borra) un token ya vencido. Lo usa `RequireAuth`
 * para mandar a Ariel al login sin mostrarle el panel un instante primero. */
export function getTokenValido(): string | null {
  const token = getToken()
  if (!token) return null
  if (estaVencido(token)) {
    clearToken()
    return null
  }
  return token
}

export function setToken(token: string): void {
  localStorage.setItem(CLAVE_TOKEN, token)
}

export function clearToken(): void {
  localStorage.removeItem(CLAVE_TOKEN)
}
