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
    const renovado = response.headers['x-token-renovado']
    if (typeof renovado === 'string' && renovado) setToken(renovado)
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
