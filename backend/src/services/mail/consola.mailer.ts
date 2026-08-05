import type { Mailer, Mensaje } from './mailer'

/** Mailer de desarrollo: imprime el mensaje en la consola en vez de enviarlo.
 *
 * Es el que se usa cuando no hay `BREVO_API_KEY`, así el proyecto se puede clonar y
 * correr sin tener que crear una cuenta en ningún proveedor. También deja el flujo
 * completo verificable en local: se ve el asunto, el link y que el .ics se generó. */
export const consolaMailer: Mailer = {
  async enviar(mensaje: Mensaje): Promise<void> {
    const adjuntos = mensaje.adjuntos?.map((a) => a.nombre).join(', ') ?? '—'
    console.log(
      [
        '',
        '─── MAIL (simulado — no se envió) ' + '─'.repeat(40),
        `Para:     ${mensaje.para}`,
        `Asunto:   ${mensaje.asunto}`,
        `Adjuntos: ${adjuntos}`,
        '',
        mensaje.texto,
        '─'.repeat(74),
        '',
      ].join('\n'),
    )
  },
}
