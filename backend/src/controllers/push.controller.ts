import { Request, Response } from 'express'
import { z } from 'zod'
import {
  borrarSuscripcion,
  clavePublicaVapid,
  enviarATodos,
  guardarSuscripcion,
} from '../services/push.service'

// Forma que devuelve `PushSubscription.toJSON()` en el navegador.
const suscripcionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

const bajaSchema = z.object({ endpoint: z.url() })

/** La clave pública se sirve desde acá en vez de exponerla como `VITE_...` en el build
 * del frontend: una copia de build-time se desincroniza de la del server sin que nadie
 * lo note, y genera suscripciones a las que después no se les puede pushear. */
export function getClavePublica(_req: Request, res: Response) {
  const clave = clavePublicaVapid()
  if (!clave) {
    res.status(503).json({
      error: {
        codigo: 'PUSH_NO_CONFIGURADO',
        mensaje: 'Las notificaciones push no están configuradas en el servidor.',
      },
    })
    return
  }
  res.json({ clavePublica: clave })
}

export async function postSuscripcion(req: Request, res: Response) {
  const parsed = suscripcionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: 'La suscripción push no tiene el formato esperado.',
      },
    })
    return
  }

  await guardarSuscripcion({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  })
  res.status(201).json({ ok: true })
}

export async function deleteSuscripcion(req: Request, res: Response) {
  const parsed = bajaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: 'Falta el endpoint de la suscripción.',
      },
    })
    return
  }

  await borrarSuscripcion(parsed.data.endpoint)
  res.json({ ok: true })
}

/** Notificación de prueba: es lo que le permite a Ariel confirmar que el permiso quedó
 * bien dado sin tener que esperar a que entre una reserva real. */
export async function postPrueba(_req: Request, res: Response) {
  const enviadas = await enviarATodos({
    title: 'Probando las notificaciones',
    body: 'Si ves esto, los avisos de turnos nuevos van a llegarte bien.',
    url: '/admin',
  })
  res.json({ enviadas })
}
