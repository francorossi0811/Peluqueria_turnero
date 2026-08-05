// Lectura del payload del JWT del lado del cliente, solo para saber si ya venció y
// evitar mostrar el panel un instante antes de rebotar al login. NO es una validación
// de seguridad: la firma la verifica el backend en cada request. Por eso alcanza con
// leer el payload y no hace falta traer una dependencia como `jwt-decode`.

interface PayloadJwt {
  exp?: number
  sub?: string
}

/** Margen contra desfasaje de reloj del cliente: damos el token por vencido 30 segundos
 * antes. Es más barato mandarlo a loguearse de más que renderizar el panel y comerse
 * un 401. */
const MARGEN_SEGUNDOS = 30

export function leerPayload(token: string): PayloadJwt | null {
  try {
    const segmento = token.split('.')[1]
    if (!segmento) return null

    // El JWT usa base64url, que no es lo que espera `atob`: hay que traducir los
    // caracteres propios de la variante URL y reponer el padding. Saltear este paso es
    // el motivo típico de que `atob` explote con tokens perfectamente válidos.
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
    const conPadding = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    )

    return JSON.parse(atob(conPadding)) as PayloadJwt
  } catch {
    return null
  }
}

export function estaVencido(token: string, ahoraMs = Date.now()): boolean {
  const payload = leerPayload(token)
  // Un token que no se puede leer no sirve para nada: lo tratamos como vencido.
  if (!payload?.exp) return true
  return payload.exp - MARGEN_SEGUNDOS <= ahoraMs / 1000
}
