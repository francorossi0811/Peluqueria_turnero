import { Router } from 'express'
import { postRenovacion } from '../controllers/push.controller'

// Rutas de push **sin autenticación**. Las que sí la llevan (alta, baja, clave pública,
// prueba) viven en `admin.routes.ts`.
//
// Acá hay una sola y es a propósito: la renovación la dispara el service worker desde el
// evento `pushsubscriptionchange`, que corre sin el JWT de Ariel y puede pasar con el
// panel cerrado. La autorización es conocer el endpoint viejo — una URL larga que asigna
// el servicio de push. Ver el comentario de `postRenovacion`.
export const pushRouter = Router()

pushRouter.post('/push/renovar', postRenovacion)
