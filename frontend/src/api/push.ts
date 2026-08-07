import { apiClient } from './client'

export async function obtenerClavePublica(): Promise<string> {
  const { data } = await apiClient.get<{ clavePublica: string }>(
    '/admin/push/clave-publica',
  )
  return data.clavePublica
}

export async function registrarSuscripcion(
  suscripcion: PushSubscriptionJSON,
): Promise<void> {
  await apiClient.post('/admin/push/suscripciones', suscripcion)
}

export async function eliminarSuscripcion(endpoint: string): Promise<void> {
  await apiClient.delete('/admin/push/suscripciones', { data: { endpoint } })
}

/** Resultado del envío a un dispositivo.
 *
 * ⚠️ `ok` significa que el servicio de push **aceptó** el mensaje (HTTP 201), no que el
 * celular lo haya mostrado. Es todo lo que el servidor puede saber: de ahí en más
 * decide el sistema operativo del dispositivo. */
export interface ResultadoEnvio {
  /** Host del endpoint, o sea qué transporte usa: `fcm.googleapis.com` es Chrome. */
  servicio: string
  userAgent: string | null
  estado: number | null
  ok: boolean
  error: string | null
}

export interface DispositivoPush {
  /** Hash del endpoint, para reconocer cuál de todos es este dispositivo. */
  huella: string
  servicio: string
  userAgent: string | null
  ultimoEstado: number | null
  ultimoIntentoEn: string | null
}

/** La misma huella que calcula el backend (`huellaDeEndpoint` en `push.service.ts`), para
 * poder cruzar la suscripción de este navegador contra la lista que conoce el servidor. */
export async function huellaDeEndpoint(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(endpoint),
  )
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

/** Manda una notificación de prueba y devuelve qué pasó con cada dispositivo. */
export async function enviarPrueba(): Promise<ResultadoEnvio[]> {
  const { data } = await apiClient.post<{ dispositivos: ResultadoEnvio[] }>(
    '/admin/push/prueba',
  )
  return data.dispositivos
}

/** Los dispositivos que el backend tiene registrados, para el bloque de diagnóstico. */
export async function obtenerDispositivos(): Promise<DispositivoPush[]> {
  const { data } = await apiClient.get<{ dispositivos: DispositivoPush[] }>(
    '/admin/push/dispositivos',
  )
  return data.dispositivos
}
