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
  servicio: string
  userAgent: string | null
  ultimoEstado: number | null
  ultimoIntentoEn: string | null
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
