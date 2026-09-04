import { describe, expect, it } from 'vitest'
import { debeCerrarSesion, debeGuardarRenovacion } from './client'

const VIEJO = 'token.viejo.abc'
const NUEVO = 'token.nuevo.xyz'

describe('debeCerrarSesion', () => {
  it('cierra la sesión con un 401 del token que está guardado', () => {
    expect(debeCerrarSesion(401, NUEVO, NUEVO)).toBe(true)
  })

  // ⚠️ El que fija el bug de producción (3/9/2026): "me logueo y a los segundos me
  // desloguea". El panel arranca con la sesión vencida y dispara sus requests; Ariel entra
  // y se guarda un token nuevo; los 401 de aquellos requests llegan **después** y, sin esta
  // guarda, borran la sesión recién abierta.
  it('NO cierra la sesión nueva por un 401 que traía el token viejo', () => {
    expect(debeCerrarSesion(401, VIEJO, NUEVO)).toBe(false)
  })

  it('no hace nada si ya no hay token guardado', () => {
    expect(debeCerrarSesion(401, VIEJO, null)).toBe(false)
  })

  it('solo mira los 401: un 403 no cierra la sesión', () => {
    // `requireSuperAdmin` responde 403 (HU-26). Ariel entrando a una sección que no le
    // corresponde no puede quedar afuera del panel entero.
    expect(debeCerrarSesion(403, NUEVO, NUEVO)).toBe(false)
  })

  it('tampoco un 409, que es el error más común de la app', () => {
    expect(debeCerrarSesion(409, NUEVO, NUEVO)).toBe(false)
  })

  it('un request sin Authorization no cierra una sesión válida', () => {
    expect(debeCerrarSesion(401, '', NUEVO)).toBe(false)
  })
})

// --- La renovación deslizante ---------------------------------------------------------

const ARIEL = '4e463e42-4e22-4de9-9e9a-69a4fd7e76f4'
const FRANCO = '60a3c41c-e29c-4c2c-9cdd-03625e1e8f5f'
const AHORA = Math.floor(Date.now() / 1000)

/** Un token con la forma real (tres partes, payload en base64url), que es lo que
 * `leerPayload` sabe leer. La firma no importa: del lado del cliente nunca se verifica. */
function token(sub: string, iat: number, exp: number): string {
  // `btoa` y no `Buffer`: este paquete compila con los tipos del navegador, y el payload
  // es JSON ASCII, así que no hay multibyte que lo rompa.
  const payload = btoa(JSON.stringify({ sub, usuario: 'x', iat, exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `cabecera.${payload}.firma`
}

const ACTUAL = token(FRANCO, AHORA - 4 * 86400, AHORA + 3 * 86400)
const RENOVADO = token(FRANCO, AHORA, AHORA + 7 * 86400)

describe('debeGuardarRenovacion', () => {
  it('guarda una renovación legítima: misma cuenta, más nueva y sin vencer', () => {
    expect(debeGuardarRenovacion(RENOVADO, ACTUAL, ACTUAL)).toBe(true)
  })

  it('no acepta una renovación de un request que salió con otro token', () => {
    // La guarda original: una respuesta en vuelo de una sesión ya cerrada no puede
    // revivirla pisando la nueva.
    expect(debeGuardarRenovacion(RENOVADO, VIEJO, ACTUAL)).toBe(false)
  })

  // ⚠️ Los tres que fijan el bug del 4/9/2026: un `X-Token-Renovado` viejo, replayed desde
  // la caché HTTP del navegador sobre un `304`, pisaba el token recién emitido.
  it('NO guarda un token ya vencido', () => {
    const vencido = token(FRANCO, AHORA - 16 * 86400, AHORA - 9 * 86400)
    expect(debeGuardarRenovacion(vencido, ACTUAL, ACTUAL)).toBe(false)
  })

  it('NO guarda un token de otra cuenta', () => {
    const deOtro = token(ARIEL, AHORA, AHORA + 7 * 86400)
    expect(debeGuardarRenovacion(deOtro, ACTUAL, ACTUAL)).toBe(false)
  })

  it('NO guarda un token más viejo que el actual, aunque todavía no haya vencido', () => {
    // El caso que las otras dos condiciones dejan pasar: se ve sano y solo acorta la
    // sesión, así que sin este chequeo nada lo delataría.
    const masViejo = token(FRANCO, AHORA - 5 * 86400, AHORA + 2 * 86400)
    expect(debeGuardarRenovacion(masViejo, ACTUAL, ACTUAL)).toBe(false)
  })

  it('no guarda el mismo token de nuevo (iat igual no es más nuevo)', () => {
    expect(debeGuardarRenovacion(ACTUAL, ACTUAL, ACTUAL)).toBe(false)
  })

  it('ignora un header ausente, vacío o que no es texto', () => {
    expect(debeGuardarRenovacion(undefined, ACTUAL, ACTUAL)).toBe(false)
    expect(debeGuardarRenovacion('', ACTUAL, ACTUAL)).toBe(false)
    expect(debeGuardarRenovacion(['a', 'b'], ACTUAL, ACTUAL)).toBe(false)
  })

  it('ignora un token que no se puede leer', () => {
    expect(debeGuardarRenovacion('no.es.un.jwt', ACTUAL, ACTUAL)).toBe(false)
  })

  it('no guarda nada si ya no hay sesión abierta', () => {
    expect(debeGuardarRenovacion(RENOVADO, ACTUAL, null)).toBe(false)
  })
})
