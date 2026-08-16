import { Router, json } from 'express'
import {
  deleteFotoDeCliente,
  deleteFotoDeServicio,
  getFotosDeCliente,
  getImagen,
  getUsoDeAlmacenamiento,
  postFotoDeCliente,
  putFotoDeServicio,
} from '../controllers/imagenes.controller'
import { requireAuth } from '../middlewares/auth.middleware'
import { MAX_BYTES } from '../utils/dataUrl'

export const imagenesRouter = Router()

/** El parser de las subidas, con su propio límite.
 *
 * ⚠️ Va **por ruta** y no subiendo el `express.json()` global de `app.ts`, que tiene el default
 * de 100 KB. Es la diferencia entre "hay dos endpoints que aceptan un cuerpo grande" y "toda la
 * API acepta cuerpos grandes": reservar un turno no tiene por qué poder recibir 2 MB.
 *
 * El ×2 sobre `MAX_BYTES` es el ~33% que infla base64 más aire para el resto del JSON. Que sea
 * más flojo que el tope real está bien: el que rechaza de verdad es `decodificarDataUrl`, y ahí
 * el error explica qué pasó, en vez del 413 pelado que tira el parser. */
const jsonDeSubida = json({ limit: MAX_BYTES * 2 })

/** Pública y sin auth: ver el comentario largo en `getImagen`. La sirve la landing y también la
 * galería del panel, y en los dos casos entra por un `<img src>`, que no puede mandar headers. */
imagenesRouter.get('/imagenes/:id', getImagen)

imagenesRouter.get('/admin/clientes/:id/fotos', requireAuth, getFotosDeCliente)
imagenesRouter.post(
  '/admin/clientes/:id/fotos',
  requireAuth,
  jsonDeSubida,
  postFotoDeCliente,
)
imagenesRouter.delete(
  '/admin/clientes/:id/fotos/:fotoId',
  requireAuth,
  deleteFotoDeCliente,
)

imagenesRouter.put(
  '/admin/servicios/:id/foto',
  requireAuth,
  jsonDeSubida,
  putFotoDeServicio,
)
imagenesRouter.delete('/admin/servicios/:id/foto', requireAuth, deleteFotoDeServicio)

imagenesRouter.get('/admin/almacenamiento', requireAuth, getUsoDeAlmacenamiento)
