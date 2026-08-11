// HU-26 — El mail de "me olvidé la contraseña".
//
// Vive acá y no en `notificaciones.service.ts` a propósito: aquel es el punto de salida de
// los avisos **del turno** (push a Ariel, WhatsApp y mail al cliente) y todo lo que hay
// ahí gira alrededor de un `Turno`. Esto es un mail de cuenta, no de agenda; meterlo ahí
// habría obligado a ese archivo a importar auth para nada.

import { frontendUrl } from '../config/env'
import { obtenerMailer } from './mail'

/** Función pura — el contenido del mail, sin tocar red. */
export function construirMailDeReset(
  usuario: string,
  link: string,
  minutosDeVida: number,
): { asunto: string; html: string; texto: string } {
  const texto = [
    `Hola ${usuario},`,
    '',
    'Pediste restablecer la contraseña del panel de La Peluquería de Ariel Enrique.',
    '',
    'Entrá acá para elegir una nueva:',
    link,
    '',
    `El link vale ${minutosDeVida} minutos y se puede usar una sola vez.`,
    '',
    'Si no lo pediste vos, ignorá este mail: tu contraseña sigue siendo la misma.',
  ].join('\n')

  const html = `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;background:#f7efe3;color:#201f1d">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4f4d49">
    La Peluquería de Ariel Enrique
  </p>
  <h1 style="margin:0 0 16px;font-size:26px;font-weight:800">Restablecer tu contraseña</h1>
  <p style="margin:0 0 16px;font-size:15px">
    Hola ${escaparHtml(usuario)}, pediste restablecer la contraseña del panel.
  </p>
  <p style="margin:0 0 16px">
    <a href="${link}" style="display:inline-block;padding:10px 18px;border:1px solid #b68235;border-radius:6px;color:#b68235;text-decoration:none;font-weight:600">
      Elegir una contraseña nueva
    </a>
  </p>
  <p style="margin:0 0 16px;font-size:13px;color:#4f4d49;word-break:break-all">${link}</p>
  <p style="margin:0;font-size:13px;color:#4f4d49">
    El link vale ${minutosDeVida} minutos y se puede usar una sola vez. Si no lo pediste
    vos, ignorá este mail: tu contraseña sigue siendo la misma.
  </p>
</div>`.trim()

  return { asunto: 'Restablecer tu contraseña del panel', html, texto }
}

/** Mismo escapado que usa el mail de confirmación: el nombre lo escribe una persona y
 * termina dentro de HTML. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function linkDeReset(token: string): string {
  return `${frontendUrl()}/admin/restablecer/${token}`
}

/** Manda el mail. Los errores se loguean y no se propagan: el endpoint que llama a esto
 * responde lo mismo exista o no la cuenta, así que tampoco puede delatar un fallo. */
export async function enviarMailDeReset(
  para: string,
  usuario: string,
  token: string,
  minutosDeVida: number,
): Promise<void> {
  try {
    const { asunto, html, texto } = construirMailDeReset(
      usuario,
      linkDeReset(token),
      minutosDeVida,
    )
    await obtenerMailer().enviar({ para, asunto, html, texto })
  } catch (err) {
    console.error('[recuperacion] no se pudo mandar el mail de reset:', err)
  }
}
