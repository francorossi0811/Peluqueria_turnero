import axios from 'axios'
import { clearToken, getToken, setToken } from '../lib/authStorage'

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
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      getToken()
    ) {
      clearToken()
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  },
)
