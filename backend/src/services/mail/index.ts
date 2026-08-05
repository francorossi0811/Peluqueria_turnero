import { crearBrevoMailer } from './brevo.mailer'
import { consolaMailer } from './consola.mailer'
import type { Mailer } from './mailer'

export type { Adjunto, Mailer, Mensaje } from './mailer'

let cacheado: Mailer | null = null

/** Elige el mailer según la configuración: Brevo si hay API key, y si no, el de consola.
 *
 * Que el fallback sea funcional (y no un error) es a propósito: el mail es un extra
 * sobre la reserva, no un requisito para reservar. Sin cuenta configurada la app
 * funciona igual y el mail queda registrado en el log del servidor. */
export function obtenerMailer(): Mailer {
  if (cacheado) return cacheado

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    cacheado = consolaMailer
    return cacheado
  }

  cacheado = crearBrevoMailer({
    apiKey,
    from: process.env.MAIL_FROM ?? 'turnos@peluqueriaariel.com',
    fromNombre: process.env.MAIL_FROM_NOMBRE ?? 'La Peluquería de Ariel Enrique',
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  })
  return cacheado
}

/** Solo para tests: obliga a recalcular el mailer en la próxima llamada. */
export function resetearMailer(): void {
  cacheado = null
}
