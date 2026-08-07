import type { Turno } from '../../generated/prisma/client.ts'
import { configWhatsapp, frontendUrl, type ConfigWhatsapp } from '../config/env'
import {
  combinarFechaHora,
  formatearFechaLegible,
  formatearHora,
} from '../utils/fechaHora'
import { generarIcs, type EventoIcs } from '../utils/ics'
import { aE164 } from '../utils/telefono'
import { obtenerMailer } from './mail'
import { enviarATodos } from './push.service'
import {
  obtenerWhatsapp,
  whatsappEstaConfigurado,
  type MensajePlantilla,
} from './whatsapp'

// Punto único de salida de avisos: push a Ariel (HU-18), y al cliente la confirmación por
// WhatsApp (HU-21) con el mail (HU-19) como respaldo.
// Todo lo de acá es "fire and forget": se llama con `void` desde los controllers,
// después de haber respondido. Un servicio de push, de WhatsApp o de mail caído no puede
// hacer fallar una reserva que ya quedó guardada en la base.

/** Función pura — separada para poder testearla sin tocar red ni base. */
export function construirNotificacionTurnoNuevo(turno: Turno): {
  title: string
  body: string
  url: string
  tag: string
} {
  return {
    title: 'Nuevo turno reservado',
    body: `${turno.clienteNombre} · ${turno.servicioNombreSnapshot} · ${formatearFechaLegible(turno.fecha)} ${formatearHora(turno.horaInicio)}`,
    url: '/admin',
    // Un tag por turno: el service worker agrupa por este valor, y con uno fijo dos
    // reservas seguidas colapsaban en una sola notificación.
    tag: `turno-${turno.id}`,
  }
}

/** HU-18 — Le avisa a Ariel que entró un turno nuevo. Solo se llama desde el flujo
 * público: los turnos que carga él mismo no generan aviso. */
export async function notificarNuevoTurno(turno: Turno): Promise<void> {
  try {
    await enviarATodos(construirNotificacionTurnoNuevo(turno))
  } catch (err) {
    console.error('[notificaciones] no se pudo avisar del turno nuevo:', err)
  }
}

/** Link único con el que el cliente gestiona su turno (el id del turno ES el token). */
export function linkDeGestion(turnoId: string): string {
  return `${frontendUrl()}/turno/${turnoId}`
}

const DIRECCION = 'Pastor Taboada 10, X5016 Córdoba'

/** Cuánto antes avisa el calendario. Dos horas: suficiente para reacomodarse, y todavía
 * dentro de la ventana de 60 minutos para poder cancelar o reprogramar online. */
const MINUTOS_DE_AVISO = 120

/** HU-19 — Arma el evento de calendario de un turno.
 *
 * El UID se basa en el turno *original* de la cadena de reprogramaciones
 * (`turnoOrigenId ?? id`) con la secuencia incrementada: así, cuando un cliente
 * reprograma, el calendario le **actualiza** el evento que ya tenía en vez de dejarle
 * dos. La auto-relación que hace esto posible ya existía para el rastro de estados. */
export function construirEventoIcs(turno: Turno): EventoIcs {
  const link = linkDeGestion(turno.id)
  return {
    uid: `${turno.turnoOrigenId ?? turno.id}@peluqueria-ariel`,
    secuencia: turno.turnoOrigenId ? 1 : 0,
    inicio: combinarFechaHora(turno.fecha, turno.horaInicio),
    fin: combinarFechaHora(turno.fecha, turno.horaFin),
    titulo: `${turno.servicioNombreSnapshot} — Peluquería de Ariel Enrique`,
    descripcion:
      `Tu turno para ${turno.servicioNombreSnapshot}.\n\n` +
      `Para cancelar o reprogramar, entrá acá: ${link}\n\n` +
      `Podés cancelar o reprogramar hasta 60 minutos antes del turno.`,
    ubicacion: DIRECCION,
    creadoEn: turno.createdAt,
    minutosDeAviso: MINUTOS_DE_AVISO,
  }
}

export function icsDeTurno(turno: Turno): string {
  return generarIcs(construirEventoIcs(turno))
}

/** Función pura — el contenido del mail de confirmación, sin tocar red. */
export function construirMailConfirmacion(
  turno: Turno,
  esReprogramacion: boolean,
): { asunto: string; html: string; texto: string } {
  const link = linkDeGestion(turno.id)
  const cuando = `${formatearFechaLegible(turno.fecha)} a las ${formatearHora(turno.horaInicio)}`
  const titulo = esReprogramacion
    ? 'Tu turno quedó reprogramado'
    : 'Tu turno quedó confirmado'

  const texto = [
    `${titulo}, ${turno.clienteNombre}.`,
    '',
    `${turno.servicioNombreSnapshot}`,
    `${cuando}`,
    `${DIRECCION}`,
    '',
    'Para cancelar o reprogramar, entrá acá:',
    link,
    '',
    'Podés hacerlo hasta 60 minutos antes del turno. Después de esa hora,',
    'escribile directamente a Ariel.',
    '',
    'Guardá este mail: el link de arriba es la única forma de gestionar tu turno.',
  ].join('\n')

  const html = `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;background:#f7efe3;color:#201f1d">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4f4d49">
    La Peluquería de Ariel Enrique
  </p>
  <h1 style="margin:0 0 16px;font-size:26px;font-weight:800">${escaparHtml(titulo)}, ${escaparHtml(turno.clienteNombre)}</h1>
  <table style="width:100%;border-collapse:collapse;background:#fdf9f0;border:1px solid #d5cec3;border-radius:8px">
    <tr><td style="padding:16px">
      <p style="margin:0 0 6px;font-size:18px"><strong>${escaparHtml(turno.servicioNombreSnapshot)}</strong></p>
      <p style="margin:0 0 6px;font-size:16px">${escaparHtml(cuando)}</p>
      <p style="margin:0;font-size:14px;color:#4f4d49">${escaparHtml(DIRECCION)}</p>
    </td></tr>
  </table>
  <p style="margin:20px 0 8px;font-size:14px">Para cancelar o reprogramar, entrá acá:</p>
  <p style="margin:0 0 16px">
    <a href="${link}" style="display:inline-block;padding:10px 18px;border:1px solid #b68235;border-radius:6px;color:#b68235;text-decoration:none;font-weight:600">
      Gestionar mi turno
    </a>
  </p>
  <p style="margin:0 0 16px;font-size:13px;color:#4f4d49;word-break:break-all">${link}</p>
  <p style="margin:0;font-size:13px;color:#4f4d49">
    Podés cancelar o reprogramar hasta 60 minutos antes. Pasada esa hora, escribile
    directamente a Ariel. Te adjuntamos el turno para que lo agregues a tu calendario.
  </p>
</div>`.trim()

  return {
    asunto: `${titulo} — ${turno.servicioNombreSnapshot}, ${cuando}`,
    html,
    texto,
  }
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HU-21 — Función pura: las variables de la plantilla de WhatsApp, sin tocar red.
 *
 * El cuerpo del mensaje no está acá — vive aprobado del lado de Meta, y lo único que
 * viaja son estos tres valores y el id del turno para el botón. La dirección y el texto
 * de "hasta 60 minutos antes" son parte de la plantilla, por eso no se repiten.
 *
 * La config entra por parámetro (en vez de leerla adentro) para que la función siga
 * siendo pura y testeable, igual que `construirMailConfirmacion`. */
export function construirMensajeWhatsappConfirmacion(
  turno: Turno,
  esReprogramacion: boolean,
  destino: string,
  config: Pick<
    ConfigWhatsapp,
    'plantillaConfirmado' | 'plantillaReprogramado' | 'idioma'
  >,
): MensajePlantilla {
  return {
    para: destino,
    plantilla: esReprogramacion
      ? config.plantillaReprogramado
      : config.plantillaConfirmado,
    idioma: config.idioma,
    variablesCuerpo: [
      turno.clienteNombre,
      turno.servicioNombreSnapshot,
      `${formatearFechaLegible(turno.fecha)} a las ${formatearHora(turno.horaInicio)}`,
    ],
    // Solo el id: la base del link (`https://…/turno/`) es parte de la plantilla aprobada.
    variableBotonUrl: turno.id,
  }
}

/** HU-21 — Intenta la confirmación por WhatsApp. Devuelve si quedó **realmente** enviada,
 * que es lo que decide si hace falta el mail de respaldo.
 *
 * Devuelve `false` sin drama en los cuatro casos en que no hay canal: el turno no tiene
 * teléfono (carga manual de Ariel, HU-08), el teléfono no se puede interpretar, no hay
 * credenciales de Meta, o el envío falló.
 *
 * ⚠️ El `return whatsappEstaConfigurado()` del final no es un detalle. Sin credenciales el
 * adaptador es el de consola: dejó el mensaje en el log —que es justo lo que hace
 * verificable esto en desarrollo— pero no lo mandó nadie. Si eso contara como enviado,
 * desplegar esta etapa antes de terminar los trámites con Meta apagaría el mail de
 * confirmación en silencio. */
async function intentarConfirmacionPorWhatsapp(
  turno: Turno,
  esReprogramacion: boolean,
): Promise<boolean> {
  if (!turno.clienteTelefono) return false

  const destino = aE164(turno.clienteTelefono)
  if (!destino) {
    console.warn(
      `[notificaciones] el teléfono del turno ${turno.id} no se pudo pasar a E.164; ` +
        'se intenta por mail.',
    )
    return false
  }

  try {
    await obtenerWhatsapp().enviarPlantilla(
      construirMensajeWhatsappConfirmacion(
        turno,
        esReprogramacion,
        destino,
        configWhatsapp(),
      ),
    )
  } catch (err) {
    console.error(
      '[notificaciones] no se pudo enviar la confirmación por WhatsApp:',
      err,
    )
    return false
  }

  return whatsappEstaConfigurado()
}

/** Le manda al cliente la confirmación con el link de gestión.
 *
 * Primero WhatsApp (HU-21), que es el canal que Ariel pidió y el que sus clientes usan de
 * verdad; el mail (HU-19) queda como respaldo para cuando no hay a dónde mandar el
 * WhatsApp o el envío falla. Si el cliente no dejó ninguno de los dos datos, no pasa nada:
 * los dos campos son opcionales a propósito.
 *
 * Lo que **no** cubre el respaldo es el rebote posterior: Meta responde aceptando el
 * mensaje, no entregándolo, así que un número que existe pero no tiene WhatsApp se ve
 * igual que un envío exitoso. Distinguirlos necesita los webhooks de estado, que quedan
 * fuera de esta etapa.
 *
 * Nunca lanza: se llama con `void` después de responder, y un proveedor caído no puede
 * hacer fallar una reserva ya guardada. */
export async function enviarConfirmacionDeTurno(
  turno: Turno,
  opciones: { esReprogramacion?: boolean } = {},
): Promise<void> {
  const esReprogramacion = Boolean(opciones.esReprogramacion)

  if (await intentarConfirmacionPorWhatsapp(turno, esReprogramacion)) return

  await enviarConfirmacionPorMail(turno, esReprogramacion)
}

/** HU-19 — El mail de confirmación con el link de gestión y el .ics adjunto. */
async function enviarConfirmacionPorMail(
  turno: Turno,
  esReprogramacion: boolean,
): Promise<void> {
  if (!turno.clienteEmail) return

  try {
    const { asunto, html, texto } = construirMailConfirmacion(
      turno,
      esReprogramacion,
    )

    await obtenerMailer().enviar({
      para: turno.clienteEmail,
      asunto,
      html,
      texto,
      adjuntos: [
        {
          nombre: 'turno.ics',
          contenidoBase64: Buffer.from(icsDeTurno(turno), 'utf8').toString(
            'base64',
          ),
          tipoMime: 'text/calendar',
        },
      ],
    })
  } catch (err) {
    console.error('[notificaciones] no se pudo enviar la confirmación:', err)
  }
}
