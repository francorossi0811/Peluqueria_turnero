import { apiClient } from './client'

// HU-30 — La agenda de un período como planilla de Excel.

/**
 * Trae el `.xlsx` del backend.
 *
 * ⚠️ **No sirve un `<a href>` apuntando al endpoint.** La ruta pide JWT y un link normal no
 * manda el header `Authorization`, así que el navegador se traería un 401 en vez del
 * archivo. Con axios el interceptor de `client.ts` lo pone solo, igual que en cualquier
 * otra llamada del panel.
 */
export async function descargarAgendaExcel(
  desde: string,
  hasta: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/admin/agenda/exportar', {
    params: { desde, hasta },
    responseType: 'blob',
  })
  return data
}

/**
 * Le da el archivo al navegador.
 *
 * ⚠️ El `revokeObjectURL` no es opcional: sin él, cada exportación deja el archivo entero
 * retenido en memoria hasta que se recargue la pestaña, y Ariel usa el panel en el celular
 * sin cerrarlo en todo el día.
 */
export function guardarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

/**
 * El mensaje real de un error que vino como `Blob`.
 *
 * ⚠️ Con `responseType: 'blob'` el cuerpo de **error** también llega como blob, así que el
 * `err.response.data.error.mensaje` de siempre da `undefined` y cualquier fallo se vería
 * como "algo salió mal" sin decir qué. Hay que leer el blob como texto y recién ahí
 * parsearlo.
 */
export async function mensajeDeErrorEnBlob(datos: unknown): Promise<string | null> {
  if (!(datos instanceof Blob)) return null
  try {
    const cuerpo = JSON.parse(await datos.text())
    return typeof cuerpo?.error?.mensaje === 'string' ? cuerpo.error.mensaje : null
  } catch {
    return null
  }
}
