// HU-29 — Las fotos de las fichas y la de cada servicio.
//
// En un archivo propio y no repartido entre `clientes.ts` y `servicios.ts` porque es un recurso
// con reglas propias (topes, formatos, peso) que los dos dueños comparten: tenerlo junto es lo
// que evita que la ficha y el servicio terminen tratando distinto a la misma cosa.

import { apiClient } from './client'

export interface Foto {
  id: string
  /** Ruta relativa (`/api/imagenes/<id>`). Ver `urlDeFoto` para armar el `src`. */
  url: string
  bytes: number
}

export interface GaleriaDeFicha {
  fotos: Foto[]
}

/** El `src` que va en un `<img>`, a partir de lo que devuelve la API.
 *
 * ⚠️ **Hay dos clases de ruta y viven en servidores distintos**, así que esto no es opcional:
 *
 * - `/imagenes/servicio-corte.jpg` — archivo estático del repo, lo sirve Vercel junto con el
 *   sitio. Relativa está bien y además va por CDN.
 * - `/api/imagenes/<id>` — una foto subida, la sirve la API. En producción eso es Render, otro
 *   dominio; en desarrollo es otro puerto. Relativa pegaría contra el frontend y daría 404.
 *
 * `VITE_API_URL` termina en `/api` y la url del backend también lo trae, así que se le saca el
 * sufijo a la base para no armar `/api/api/imagenes/...`. */
export function urlDeFoto(url: string): string {
  if (!url.startsWith('/api/')) return url

  const base = import.meta.env.VITE_API_URL as string
  return base.replace(/\/api$/, '') + url
}

export async function obtenerFotosDeFicha(
  clienteId: string,
): Promise<GaleriaDeFicha> {
  const { data } = await apiClient.get<GaleriaDeFicha>(
    `/admin/clientes/${clienteId}/fotos`,
  )
  return data
}

export async function subirFotoDeFicha(
  clienteId: string,
  datos: string,
): Promise<Foto> {
  const { data } = await apiClient.post<Foto>(
    `/admin/clientes/${clienteId}/fotos`,
    { datos },
  )
  return data
}

export async function borrarFotoDeFicha(
  clienteId: string,
  fotoId: string,
): Promise<void> {
  await apiClient.delete(`/admin/clientes/${clienteId}/fotos/${fotoId}`)
}

export async function subirFotoDeServicio(
  servicioId: string,
  datos: string,
): Promise<Foto> {
  const { data } = await apiClient.put<Foto>(
    `/admin/servicios/${servicioId}/foto`,
    { datos },
  )
  return data
}

export async function borrarFotoDeServicio(servicioId: string): Promise<void> {
  await apiClient.delete(`/admin/servicios/${servicioId}/foto`)
}

export interface UsoDeAlmacenamiento {
  fotos: number
  bytes: number
  /** El techo, que lo fija el backend. No se copia acá: sería un segundo número capaz de
   * divergir del que el sistema aplica de verdad. */
  presupuestoBytes: number
}

export async function obtenerUsoDeAlmacenamiento(): Promise<UsoDeAlmacenamiento> {
  const { data } = await apiClient.get<UsoDeAlmacenamiento>(
    '/admin/almacenamiento',
  )
  return data
}
