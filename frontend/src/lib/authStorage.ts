const CLAVE_TOKEN = 'turnero_admin_token'

export function getToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN)
}

export function setToken(token: string): void {
  localStorage.setItem(CLAVE_TOKEN, token)
}

export function clearToken(): void {
  localStorage.removeItem(CLAVE_TOKEN)
}
