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

/** Que el login pueda decir **por qué** está pidiendo entrar de nuevo.
 *
 * Sin esto, una sesión que vence deja a Ariel frente al formulario sin ninguna explicación,
 * y eso se lee como "la app me echó" o "se rompió" — que es exactamente lo que ya había
 * pasado con la flechita de atrás de Chrome. El dato vive en `sessionStorage` y no en la
 * URL a propósito: no tiene por qué quedar en el historial ni sobrevivir a cerrar la
 * pestaña, y así el interceptor (que redirige con `location.href`) y `RequireAuth` (que
 * navega del lado del cliente) pueden usar el mismo camino. */
const CLAVE_VENCIDA = 'turnero_sesion_vencida'

export function marcarSesionVencida(): void {
  try {
    sessionStorage.setItem(CLAVE_VENCIDA, '1')
  } catch {
    // Safari en navegación privada puede tirar acá. El aviso es una cortesía: si no se
    // puede guardar, el login se muestra igual, solo que sin explicación.
  }
}

/** ¿Hay un aviso pendiente? **Solo lee**, no consume.
 *
 * ⚠️ Leer y consumir están separados a propósito. Juntos, en el inicializador de un
 * `useState`, el aviso no se ve nunca: con `StrictMode` React llama ese inicializador
 * **dos veces**, la primera se lleva el flag y la segunda —cuyo valor es el que queda— ve
 * que ya no está. Es un bug que no aparece compilando, solo mirando la pantalla. */
export function haySesionVencida(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_VENCIDA) === '1'
  } catch {
    return false
  }
}

/** Borra el aviso, para que se muestre una sola vez. Va en un efecto, no en el render.
 * Idempotente: llamarla de más no molesta. */
export function limpiarSesionVencida(): void {
  try {
    sessionStorage.removeItem(CLAVE_VENCIDA)
  } catch {
    // Ver `marcarSesionVencida`.
  }
}
