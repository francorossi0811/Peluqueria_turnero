import { Request, Response } from 'express'
import { z } from 'zod'
import {
  borrarSuscripcion,
  clavePublicaVapid,
  enviarATodos,
  guardarSuscripcion,
  listarSuscripciones,
  renovarSuscripcion,
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

const renovacionSchema = z.object({
  endpointViejo: z.url(),
  suscripcion: suscripcionSchema,
})

/** El user agent identifica cuál de los dispositivos de Ariel es cada suscripción. Se
 * recorta porque son cadenas largas y solo se usa para mostrarlo en el panel. */
function userAgentDe(req: Request): string | undefined {
  return req.get('user-agent')?.slice(0, 255)
}

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
    userAgent: userAgentDe(req),
  })
  res.status(201).json({ ok: true })
}

/** Reemplaza una suscripción que el navegador rotó por su cuenta.
 *
 * **Sin `requireAuth` a propósito.** Lo llama el service worker desde el evento
 * `pushsubscriptionchange`, que corre sin el JWT de Ariel y puede dispararse con el
 * panel cerrado. La autorización es conocer `endpointViejo`: si no está en la base
 * responde 404 y no crea nada, así que no sirve para dar de alta un endpoint arbitrario.
 * Ver la nota en `renovarSuscripcion`. */
export async function postRenovacion(req: Request, res: Response) {
  const parsed = renovacionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: 'La renovación no tiene el formato esperado.',
      },
    })
    return
  }

  const { endpointViejo, suscripcion } = parsed.data
  const renovada = await renovarSuscripcion(endpointViejo, {
    endpoint: suscripcion.endpoint,
    p256dh: suscripcion.keys.p256dh,
    auth: suscripcion.keys.auth,
    userAgent: userAgentDe(req),
  })

  if (!renovada) {
    res.status(404).json({
      error: {
        codigo: 'SUSCRIPCION_NO_ENCONTRADA',
        mensaje: 'No conocemos esa suscripción.',
      },
    })
    return
  }
  res.json({ ok: true })
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
 * bien dado sin tener que esperar a que entre una reserva real.
 *
 * Devuelve el detalle por dispositivo y no un contador. El contador anterior decía
 * "enviado a 1 dispositivo" tanto cuando el aviso llegaba como cuando el servicio de
 * push lo aceptaba y el celular no lo mostraba nunca — que es exactamente el caso que
 * nos hizo perder tiempo con el teléfono de Ariel. */
export async function postPrueba(_req: Request, res: Response) {
  const dispositivos = await enviarATodos({
    title: 'Probando las notificaciones',
    body: 'Si ves esto, los avisos de turnos nuevos van a llegarte bien.',
    url: '/admin',
    tag: `prueba-${Date.now()}`,
  })
  res.json({ dispositivos })
}

/** Qué dispositivos tienen los avisos activados, para el bloque de diagnóstico. */
export async function getDispositivos(_req: Request, res: Response) {
  res.json({ dispositivos: await listarSuscripciones() })
}
