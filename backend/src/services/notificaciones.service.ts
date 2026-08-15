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

/** Qué le pasó al turno. Decide la plantilla de WhatsApp, el texto del mail y si va el
 * adjunto de calendario. Es un tipo y no un booleano porque ya son tres casos: el
 * `esReprogramacion` de la v3 se quedó corto apenas apareció la cancelación. */
export type TipoAviso = 'confirmado' | 'reprogramado' | 'cancelado'

/** Quién · qué · cuándo, la línea con la que Ariel reconoce un turno de un vistazo. */
function resumenDelTurno(turno: Turno): string {
  return `${turno.clienteNombre} · ${turno.servicioNombreSnapshot} · ${formatearFechaLegible(turno.fecha)} ${formatearHora(turno.horaInicio)}`
}

/** Función pura — separada para poder testearla sin tocar red ni base. */
export function construirNotificacionTurnoNuevo(turno: Turno): {
  title: string
  body: string
  url: string
  tag: string
} {
  return {
    title: 'Nuevo turno reservado',
    body: resumenDelTurno(turno),
    url: '/admin',
    // Un tag por turno: el service worker agrupa por este valor, y con uno fijo dos
    // reservas seguidas colapsaban en una sola notificación.
    tag: `turno-${turno.id}`,
  }
}

/** Función pura — el aviso de que un cliente canceló solo (HU-03). */
export function construirNotificacionTurnoCancelado(turno: Turno): {
  title: string
  body: string
  url: string
  tag: string
} {
  return {
    title: 'Turno cancelado por el cliente',
    body: resumenDelTurno(turno),
    url: '/admin',
    // Distinto del tag del alta: si fuera el mismo, la cancelación **reemplazaría** en
    // pantalla al aviso de la reserva y el hueco liberado pasaría desapercibido.
    tag: `turno-cancelado-${turno.id}`,
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

/** Le avisa a Ariel que un cliente canceló. Igual que el alta, solo desde el flujo
 * público: la cancelación que hace él desde el panel no se la avisa a sí mismo.
 *
 * Sin esto, un hueco liberado desde el link del cliente solo se ve mirando la agenda —
 * que es justo lo que la v2 arregló para las reservas y quedó pendiente para las bajas. */
export async function notificarTurnoCancelado(turno: Turno): Promise<void> {
  try {
    await enviarATodos(construirNotificacionTurnoCancelado(turno))
  } catch (err) {
    console.error('[notificaciones] no se pudo avisar la cancelación:', err)
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

const TITULO_MAIL: Record<TipoAviso, string> = {
  confirmado: 'Tu turno quedó confirmado',
  reprogramado: 'Tu turno quedó reprogramado',
  cancelado: 'Cancelamos tu turno',
}

/** Función pura — el contenido del mail de confirmación, sin tocar red.
 *
 * En la cancelación el link de gestión no va: ese turno ya no se gestiona más, y ofrecer
 * "gestionar mi turno" sobre algo cancelado es prometer una acción que no existe. En su
 * lugar va el inicio del sitio, que es lo único que le sirve al que se arrepintió. */
export function construirMailConfirmacion(
  turno: Turno,
  tipo: TipoAviso,
): { asunto: string; html: string; texto: string } {
  const cancelado = tipo === 'cancelado'
  const link = cancelado ? frontendUrl() : linkDeGestion(turno.id)
  const textoDelBoton = cancelado ? 'Reservar otro turno' : 'Gestionar mi turno'
  const cuando = `${formatearFechaLegible(turno.fecha)} a las ${formatearHora(turno.horaInicio)}`
  const titulo = TITULO_MAIL[tipo]

  const cierre = cancelado
    ? ['Liberamos el horario. Cuando quieras sacás otro desde el sitio.']
    : [
        'Para cancelar o reprogramar, entrá acá:',
        link,
        '',
        'Podés hacerlo hasta 60 minutos antes del turno. Después de esa hora,',
        'escribile directamente a Ariel.',
        '',
        'Guardá este mail: el link de arriba es la única forma de gestionar tu turno.',
      ]

  const texto = [
    `${titulo}, ${turno.clienteNombre}.`,
    '',
    `${turno.servicioNombreSnapshot}`,
    `${cuando}`,
    `${DIRECCION}`,
    '',
    ...cierre,
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
  <p style="margin:20px 0 8px;font-size:14px">${
    cancelado
      ? 'Liberamos el horario. Cuando quieras sacás otro:'
      : 'Para cancelar o reprogramar, entrá acá:'
  }</p>
  <p style="margin:0 0 16px">
    <a href="${link}" style="display:inline-block;padding:10px 18px;border:1px solid #b68235;border-radius:6px;color:#b68235;text-decoration:none;font-weight:600">
      ${textoDelBoton}
    </a>
  </p>
  <p style="margin:0 0 16px;font-size:13px;color:#4f4d49;word-break:break-all">${link}</p>
  ${
    cancelado
      ? ''
      : `<p style="margin:0;font-size:13px;color:#4f4d49">
    Podés cancelar o reprogramar hasta 60 minutos antes. Pasada esa hora, escribile
    directamente a Ariel. Te adjuntamos el turno para que lo agregues a tu calendario.
  </p>`
  }
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
 * Las tres plantillas comparten las mismas variables **a propósito**: así este armador
 * sirve para las tres sin ramificar, y lo único que cambia es cuál se manda.
 *
 * ⚠️ La de cancelación **no lleva variable de botón**: su botón es una URL estática al
 * inicio del sitio ("Reservar otro turno"), porque el turno cancelado ya no se gestiona.
 * Mandar una variable a una plantilla que no la declara es un 400 de Meta.
 *
 * La config entra por parámetro (en vez de leerla adentro) para que la función siga
 * siendo pura y testeable, igual que `construirMailConfirmacion`. */
export function construirMensajeWhatsapp(
  turno: Turno,
  tipo: TipoAviso,
  destino: string,
  config: Pick<
    ConfigWhatsapp,
    | 'plantillaConfirmado'
    | 'plantillaReprogramado'
    | 'plantillaCancelado'
    | 'idioma'
  >,
): MensajePlantilla {
  const plantilla: Record<TipoAviso, string> = {
    confirmado: config.plantillaConfirmado,
    reprogramado: config.plantillaReprogramado,
    cancelado: config.plantillaCancelado,
  }

  return {
    para: destino,
    plantilla: plantilla[tipo],
    idioma: config.idioma,
    variablesCuerpo: [
      turno.clienteNombre,
      turno.servicioNombreSnapshot,
      `${formatearFechaLegible(turno.fecha)} a las ${formatearHora(turno.horaInicio)}`,
    ],
    // Solo el id: la base del link (`https://…/turno/`) es parte de la plantilla aprobada.
    variableBotonUrl: tipo === 'cancelado' ? undefined : turno.id,
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
async function intentarAvisoPorWhatsapp(
  turno: Turno,
  tipo: TipoAviso,
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
      construirMensajeWhatsapp(turno, tipo, destino, configWhatsapp()),
    )
  } catch (err) {
    console.error(
      `[notificaciones] no se pudo enviar el aviso de ${tipo} por WhatsApp:`,
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
  await enviarAvisoDeTurno(
    turno,
    opciones.esReprogramacion ? 'reprogramado' : 'confirmado',
  )
}

/** Le avisa al cliente que su turno quedó cancelado.
 *
 * Va por los dos caminos de baja, y por motivos distintos: cuando cancela él es el
 * comprobante de que la cancelación entró de verdad, y cuando cancela Ariel desde el
 * panel es la **única** forma de que se entere de que no lo esperan. Ese segundo caso es
 * el que hace que no alcance con la pantalla de confirmación del sitio. */
export async function enviarAvisoDeCancelacion(turno: Turno): Promise<void> {
  await enviarAvisoDeTurno(turno, 'cancelado')
}

/** CU-03 — Los avisos de una cancelación en masa: Ariel bloquea un rango y se lleva puestos
 * los turnos que había adentro.
 *
 * Existe porque este era el **único** camino de baja que no avisaba. Los otros dos —el
 * cliente que cancela desde su link y Ariel que cancela un turno desde el panel— mandan el
 * mensaje desde HU-22, y justamente acá es donde más falta hace: son varios clientes de una,
 * ninguno lo pidió, y sin aviso se enteran recién si abren su link.
 *
 * ⚠️ Va **secuencial** y no con `Promise.all`. Bloquear una semana entera puede cancelar
 * decenas de turnos, y disparar decenas de mensajes en paralelo contra la Cloud API es la
 * forma de comerse un rate limit de Meta justo cuando más importa que lleguen. Tardar más no
 * cuesta nada: esto corre después de responder y nadie lo está esperando.
 *
 * Cada envío se traga sus propios errores (`intentarAvisoPorWhatsapp` y `enviarAvisoPorMail`
 * loguean y siguen), así que un turno sin teléfono ni mail no corta la lista para el resto.
 *
 * ⚠️ El mensaje **no dice por qué** se canceló: la plantilla `turno_cancelado` está aprobada
 * con tres variables (nombre, servicio, cuándo) y no tiene lugar para el motivo. Agregárselo
 * es volver a pasar por la aprobación de Meta, así que queda para cuando haya otro cambio de
 * plantilla que lo justifique. */
export async function enviarAvisosDeCancelacionEnMasa(
  turnos: Turno[],
): Promise<void> {
  for (const turno of turnos) {
    await enviarAvisoDeCancelacion(turno)
  }
}

async function enviarAvisoDeTurno(
  turno: Turno,
  tipo: TipoAviso,
): Promise<void> {
  if (await intentarAvisoPorWhatsapp(turno, tipo)) return

  await enviarAvisoPorMail(turno, tipo)
}

/** HU-19 — El mail de respaldo, con el link de gestión y el .ics adjunto.
 *
 * El adjunto no va en la cancelación: un .ics con `METHOD:REQUEST` volvería a **crear**
 * el evento que el cliente quiere sacarse de encima. Borrarlo de su calendario necesita
 * un `METHOD:CANCEL`, que es otra cosa y queda fuera de esta etapa; el mail lo dice con
 * palabras y el cliente lo borra a mano. */
async function enviarAvisoPorMail(
  turno: Turno,
  tipo: TipoAviso,
): Promise<void> {
  if (!turno.clienteEmail) return

  try {
    const { asunto, html, texto } = construirMailConfirmacion(turno, tipo)

    await obtenerMailer().enviar({
      para: turno.clienteEmail,
      asunto,
      html,
      texto,
      adjuntos:
        tipo === 'cancelado'
          ? []
          : [
              {
                nombre: 'turno.ics',
                contenidoBase64: Buffer.from(
                  icsDeTurno(turno),
                  'utf8',
                ).toString('base64'),
                tipoMime: 'text/calendar',
              },
            ],
    })
  } catch (err) {
    console.error(
      `[notificaciones] no se pudo enviar el aviso de ${tipo}:`,
      err,
    )
  }
}
