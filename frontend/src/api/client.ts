import axios from 'axios'
import {
  clearToken,
  getToken,
  marcarSesionVencida,
  setToken,
} from '../lib/authStorage'

/**
 * ¿Este 401 tiene que cerrar la sesión?
 *
 * Pura y exportada para poder fijarla con tests: es una decisión de tres líneas que ya se
 * equivocó una vez en producción, y el costo del error es echar a Ariel del panel.
 *
 * ⚠️ **Solo si el 401 corresponde al token que HOY está guardado.** Un request que salió
 * con un token viejo y llegó tarde no puede cerrar la sesión nueva. Es el espejo exacto de
 * la guarda que ya tenía la renovación deslizante — aquella evita que una respuesta vieja
 * **reviva** una sesión cerrada; esta, que **mate** una recién abierta.
 */
export function debeCerrarSesion(
  status: number | undefined,
  tokenEnviado: string,
  tokenActual: string | null,
): boolean {
  if (status !== 401) return false
  if (!tokenActual) return false
  return tokenEnviado === tokenActual
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Sesión vencida o token inválido: lo borramos y mandamos a Ariel a loguearse de nuevo.
apiClient.interceptors.response.use(
  (response) => {
    // Renovación deslizante (HU-15): cuando el token pasó la mitad de su vida, el
    // backend manda uno nuevo en este header y acá lo guardamos. Mientras Ariel use el
    // panel, la sesión no vence nunca — sin timers ni requests extra.
    //
    // ⚠️ Solo se acepta la renovación si el request salió con el token que HOY está
    // guardado. Sin esta comparación, una respuesta que quedó en vuelo de una sesión ya
    // cerrada revive esa sesión pisando la nueva: pasó en producción al cambiar de
    // cuenta: el token viejo (pasada la mitad de su vida, así que el backend lo renovaba
    // en cada respuesta) volvía a escribirse encima del recién emitido, y el panel
    // quedaba pegado a la cuenta anterior sin que nada lo delatara.
    const renovado = response.headers['x-token-renovado']
    const enviado = String(response.config.headers?.Authorization ?? '').replace(
      /^Bearer /,
      '',
    )
    if (typeof renovado === 'string' && renovado && enviado === getToken()) {
      setToken(renovado)
    }
    return response
  },
  (error) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    // ⚠️ **La misma guarda que la renovación de acá arriba, y por el mismo motivo.** Solo
    // se cierra la sesión si el 401 corresponde al token que HOY está guardado.
    //
    // Sin esta comparación, un request que salió con un token viejo y llegó tarde cierra
    // la sesión **nueva**: pasó en producción y se veía como "me logueo y a los segundos
    // me desloguea". La secuencia es esta, y no tiene nada de raro —basta con abrir el
    // panel con la sesión vencida—:
    //   1. El panel arranca con un token ya vencido y dispara sus requests.
    //   2. `RequireAuth` manda al login.
    //   3. Ariel entra y se guarda un token nuevo.
    //   4. Los 401 del paso 1 llegan **después** y borran el token del paso 3.
    //
    // El arreglo del camino de éxito se hizo en su momento sin mirar este, que es su
    // espejo exacto: los dos deciden sobre la sesión a partir de una respuesta que puede
    // venir de otra.
    const enviado = String(error.config?.headers?.Authorization ?? '').replace(
      /^Bearer /,
      '',
    )
    if (!debeCerrarSesion(error.response?.status, enviado, getToken())) {
      return Promise.reject(error)
    }

    clearToken()
    marcarSesionVencida()
    if (!window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  },
)
