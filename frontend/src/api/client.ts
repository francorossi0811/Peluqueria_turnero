import axios from 'axios'
import {
  clearToken,
  getToken,
  marcarSesionVencida,
  setToken,
} from '../lib/authStorage'
import { estaVencido, leerPayload } from '../lib/jwt'

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

/**
 * ¿Este `X-Token-Renovado` se puede guardar? (HU-15, renovación deslizante.)
 *
 * ⚠️ **El header no alcanza como prueba de que la renovación es de ahora.** Se descubrió
 * en producción el 4/9/2026, y el síntoma era "entro con cualquier cuenta, toco cualquier
 * cosa y me echa" — pero solo en una computadora, nunca en incógnito ni en el celular. El
 * rastro, capturado en el navegador, fue este: el login guardaba un token válido y 7
 * segundos después **otro `setToken` lo pisaba con un token de otra cuenta emitido 16 días
 * antes y vencido hacía 9**. `RequireAuth` leía ese y mandaba al login.
 *
 * El header venía de la **caché HTTP del navegador**, no del servidor:
 *
 * 1. Las respuestas del panel viajaban con `ETag` y sin `Cache-Control`, así que el
 *    navegador las guardaba en disco — con el `X-Token-Renovado` adentro, que es una
 *    credencial.
 * 2. Sin `Vary: Authorization`, esa entrada no estaba atada a la sesión: la misma URL con
 *    otra cuenta la reusaba.
 * 3. Al revalidar, el backend contestaba `304` sin el header, y por las reglas de HTTP el
 *    navegador entrega la respuesta guardada fusionándole los headers del `304`: los que
 *    el `304` no trae **se conservan de la copia vieja**.
 *
 * La causa raíz se tapó en el backend (`Cache-Control: no-store` en `requireAuth`), pero
 * esta guarda se queda igual, por dos motivos: las copias ya cacheadas siguen vivas en los
 * navegadores hasta que caduquen, y **un token es lo único que decide quién sos** — no
 * puede depender de que ningún intermediario se porte bien.
 *
 * Las cuatro condiciones, y por qué cada una:
 *
 * - El request salió con el token que hoy está guardado. Es la guarda original: una
 *   respuesta en vuelo de una sesión ya cerrada no puede revivirla pisando la nueva.
 * - El token renovado se puede leer y **no está vencido**. Cambiar un token bueno por uno
 *   vencido es exactamente el bug de arriba.
 * - Es de la **misma cuenta** (`sub`). Sin esto, una respuesta cacheada de la sesión de
 *   Ariel te cambia de identidad en silencio mientras estás logueado como Franco.
 * - Su `iat` es **estrictamente mayor**. Una renovación de verdad siempre es más nueva;
 *   una copia vieja replayed desde la caché nunca lo es. Es la condición que ataja el caso
 *   feo que las otras dejan pasar: un token viejo que todavía **no** venció, que se vería
 *   sano y solo acortaría la sesión sin que nada lo delate.
 *
 * Ante la duda no se guarda nada: el peor caso es que la sesión no se extienda en este
 * request, y el siguiente la renueva bien.
 */
export function debeGuardarRenovacion(
  renovado: unknown,
  tokenEnviado: string,
  tokenActual: string | null,
): boolean {
  if (typeof renovado !== 'string' || !renovado) return false
  if (!tokenActual) return false
  if (tokenEnviado !== tokenActual) return false

  const nuevo = leerPayload(renovado)
  const actual = leerPayload(tokenActual)
  if (!nuevo?.iat || !actual?.iat) return false
  if (!nuevo.sub || nuevo.sub !== actual.sub) return false
  if (estaVencido(renovado)) return false

  return nuevo.iat > actual.iat
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

/** El token con el que salió el request, tal como lo dejó el interceptor de arriba. */
function tokenDelRequest(headers: unknown): string {
  const autorizacion = (headers as { Authorization?: unknown } | undefined)
    ?.Authorization
  return String(autorizacion ?? '').replace(/^Bearer /, '')
}

// Sesión vencida o token inválido: lo borramos y mandamos a Ariel a loguearse de nuevo.
apiClient.interceptors.response.use(
  (response) => {
    // Renovación deslizante (HU-15): cuando el token pasó la mitad de su vida, el
    // backend manda uno nuevo en este header y acá lo guardamos. Mientras Ariel use el
    // panel, la sesión no vence nunca — sin timers ni requests extra.
    //
    // ⚠️ Quién decide si se guarda es `debeGuardarRenovacion`, no este `if`: el header
    // solo, sin mirar qué trae adentro, alcanzó para deslogear a Franco en un loop. Ver
    // el comentario largo de esa función.
    if (
      debeGuardarRenovacion(
        response.headers['x-token-renovado'],
        tokenDelRequest(response.config.headers),
        getToken(),
      )
    ) {
      setToken(response.headers['x-token-renovado'] as string)
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
    if (
      !debeCerrarSesion(
        error.response?.status,
        tokenDelRequest(error.config?.headers),
        getToken(),
      )
    ) {
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
