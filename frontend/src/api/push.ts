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

/** Manda una notificación de prueba a los dispositivos suscriptos. Devuelve a cuántos. */
export async function enviarPrueba(): Promise<number> {
  const { data } = await apiClient.post<{ enviadas: number }>(
    '/admin/push/prueba',
  )
  return data.enviadas
}
