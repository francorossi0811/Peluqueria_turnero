import type { Mailer, Mensaje } from './mailer'

// Envío por Brevo (ex Sendinblue). Se eligió sobre Resend porque Resend, sin un dominio
// propio verificado, solo entrega a la casilla del dueño de la cuenta — inservible para
// escribirle a clientes. Brevo permite validar una dirección individual.
//
// Es un POST común con la API key en un header, así que lo cubre el `fetch` nativo de
// Node: no hace falta agregar ninguna dependencia HTTP al backend.
const URL_BREVO = 'https://api.brevo.com/v3/smtp/email'

export function crearBrevoMailer(config: {
  apiKey: string
  from: string
  fromNombre: string
  replyTo?: string
}): Mailer {
  return {
    async enviar(mensaje: Mensaje): Promise<void> {
      const cuerpo: Record<string, unknown> = {
        sender: { email: config.from, name: config.fromNombre },
        to: [{ email: mensaje.para }],
        subject: mensaje.asunto,
        htmlContent: mensaje.html,
        textContent: mensaje.texto,
      }

      if (config.replyTo) cuerpo.replyTo = { email: config.replyTo }
      if (mensaje.adjuntos?.length) {
        cuerpo.attachment = mensaje.adjuntos.map((a) => ({
          name: a.nombre,
          content: a.contenidoBase64,
        }))
      }

      const res = await fetch(URL_BREVO, {
        method: 'POST',
        headers: {
          'api-key': config.apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(cuerpo),
      })

      if (!res.ok) {
        const detalle = await res.text().catch(() => '')
        throw new Error(
          `Brevo respondió ${res.status}: ${detalle.slice(0, 300)}`,
        )
      }
    },
  }
}
