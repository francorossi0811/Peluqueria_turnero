import { createHash } from 'node:crypto'
import webpush from 'web-push'
import { configVapid } from '../config/env'
import { prisma } from '../config/prisma'

// HU-18 — Web Push al celular de Ariel.
//
// Se usa la librería `web-push` y no `fetch` a mano porque el protocolo no es un POST
// común: exige un JWT VAPID firmado con ES256 y el payload cifrado con AES128GCM sobre
// ECDH + HKDF. Implementar esa criptografía a mano sería un error. Es la primera
// dependencia de red saliente del backend (ver Docs/arquitectura.md).

// Códigos con los que el servicio de push avisa que la suscripción ya no existe (el
// usuario desinstaló la PWA, revocó el permiso, o el navegador la rotó). La spec dice
// que ante esto hay que borrarla, si no se acumulan suscripciones muertas para siempre.
const CODIGOS_SUSCRIPCION_MUERTA = [404, 410]

let configurado = false

/** Configura las claves VAPID la primera vez que se usa. Devuelve false si el push no
 * está configurado, para que los llamadores puedan seguir sin romper. */
function asegurarConfiguracion(): boolean {
  const vapid = configVapid()
  if (!vapid) return false
  if (!configurado) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
    configurado = true
  }
  return true
}

export function pushEstaConfigurado(): boolean {
  return configVapid() !== null
}

export function clavePublicaVapid(): string | null {
  return configVapid()?.publicKey ?? null
}

export interface DatosSuscripcion {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

/** Alta idempotente: si el mismo dispositivo se vuelve a suscribir, se actualizan las
 * claves en vez de duplicar la fila. */
export async function guardarSuscripcion(
  datos: DatosSuscripcion,
): Promise<void> {
  const { endpoint, ...resto } = datos
  await prisma.pushSuscripcion.upsert({
    where: { endpoint },
    // Se limpia el diagnóstico viejo: una suscripción recién creada todavía no falló.
    update: { ...resto, ultimoEstado: null, ultimoError: null },
    create: { endpoint, ...resto },
  })
}

export async function borrarSuscripcion(endpoint: string): Promise<void> {
  await prisma.pushSuscripcion.deleteMany({ where: { endpoint } })
}

/** Reemplaza una suscripción por la que el navegador generó al rotarla.
 *
 * Lo llama el service worker desde `pushsubscriptionchange`, **sin autenticación**: ese
 * evento corre sin el JWT de Ariel y puede dispararse con el panel cerrado. Conocer el
 * endpoint viejo es la prueba de posesión — es una URL larga que asigna el servicio de
 * push y no se puede adivinar. Devuelve false si no lo conocemos, y en ese caso el
 * llamador responde 404 sin crear nada: sin este chequeo sería un alta abierta. */
export async function renovarSuscripcion(
  endpointViejo: string,
  nueva: DatosSuscripcion,
): Promise<boolean> {
  const existente = await prisma.pushSuscripcion.findUnique({
    where: { endpoint: endpointViejo },
  })
  if (!existente) return false

  if (endpointViejo !== nueva.endpoint) {
    await prisma.pushSuscripcion.deleteMany({ where: { endpoint: endpointViejo } })
  }
  await guardarSuscripcion({
    ...nueva,
    userAgent: nueva.userAgent ?? existente.userAgent ?? undefined,
  })
  return true
}

export interface Notificacion {
  title: string
  body: string
  url: string
  /** Agrupa notificaciones en el dispositivo. Uno por turno, para que no se pisen. */
  tag?: string
}

/** Lo que se sabe de un intento de envío. `estado` es el código HTTP del servicio de
 * push: 201 significa **aceptado**, no entregado — el servicio lo toma y después decide
 * si el dispositivo lo recibe. Es el techo de lo que el servidor puede saber. */
export interface ResultadoEnvio {
  /** Host del endpoint: dice qué transporte usa el dispositivo (`fcm.googleapis.com`
   * para Chrome/Android, `push.services.mozilla.com` para Firefox, etc.). */
  servicio: string
  userAgent: string | null
  estado: number | null
  ok: boolean
  error: string | null
}

function hostDe(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'desconocido'
  }
}

/** Manda la notificación a todos los dispositivos suscriptos.
 *
 * Nunca lanza: los llamadores son flujos de reserva y un push caído no puede tumbar una
 * reserva. Devuelve un resultado por dispositivo — antes devolvía solo un contador, y
 * "enviado a 1 dispositivo" no distinguía entre las tres razones por las que un aviso no
 * aparece (push apagado, ninguna suscripción, o el dispositivo que no lo muestra). */
export async function enviarATodos(
  notificacion: Notificacion,
): Promise<ResultadoEnvio[]> {
  if (!asegurarConfiguracion()) {
    console.warn('[push] no hay claves VAPID configuradas: no se envía nada')
    return []
  }

  const suscripciones = await prisma.pushSuscripcion.findMany()
  if (suscripciones.length === 0) return []

  const payload = JSON.stringify(notificacion)

  return Promise.all(
    suscripciones.map(async (s): Promise<ResultadoEnvio> => {
      const servicio = hostDe(s.endpoint)
      const base = { servicio, userAgent: s.userAgent }

      try {
        const res = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          {
            // Un día: si el celular está apagado o sin señal, el servicio guarda el
            // aviso en vez de descartarlo al instante.
            TTL: 24 * 60 * 60,
            // Pide que el mensaje despierte al dispositivo. Sin esto, el modo de ahorro
            // de batería de Android puede retenerlo hasta la próxima vez que se
            // desbloquea el teléfono.
            urgency: 'high',
          },
        )
        await registrarIntento(s.endpoint, res.statusCode, null)
        console.log(`[push] ${servicio} → ${res.statusCode}`)
        return { ...base, estado: res.statusCode, ok: true, error: null }
      } catch (err) {
        const estado = (err as { statusCode?: number }).statusCode ?? null
        const detalle = err instanceof Error ? err.message : String(err)

        if (estado && CODIGOS_SUSCRIPCION_MUERTA.includes(estado)) {
          console.log(`[push] ${servicio} → ${estado}, suscripción muerta: se borra`)
          await borrarSuscripcion(s.endpoint)
          return { ...base, estado, ok: false, error: 'La suscripción ya no existe.' }
        }

        // 401/403 casi siempre significan que las claves VAPID del servidor no son las
        // que firmaron esta suscripción (típico después de rotarlas). Vale la pena
        // decirlo en el log, porque el mensaje crudo de la librería no lo aclara.
        if (estado === 401 || estado === 403) {
          console.error(
            `[push] ${servicio} → ${estado}: las claves VAPID no coinciden con las de esta suscripción. Hay que volver a activar los avisos en ese dispositivo.`,
          )
        } else {
          console.error(`[push] ${servicio} → ${estado ?? 'sin status'}: ${detalle}`)
        }

        await registrarIntento(s.endpoint, estado, detalle)
        return { ...base, estado, ok: false, error: detalle }
      }
    }),
  )
}

/** Guarda el resultado del último intento. No puede hacer fallar el envío: si la base
 * está caída, el aviso ya salió igual y perder el diagnóstico es lo de menos. */
async function registrarIntento(
  endpoint: string,
  estado: number | null,
  error: string | null,
): Promise<void> {
  try {
    await prisma.pushSuscripcion.updateMany({
      where: { endpoint },
      data: { ultimoIntentoEn: new Date(), ultimoEstado: estado, ultimoError: error },
    })
  } catch (err) {
    console.error('[push] no se pudo guardar el diagnóstico:', err)
  }
}

/** Identificador estable de una suscripción, para que el panel pueda reconocer **la suya**
 * dentro de la lista de dispositivos.
 *
 * Es un hash y no el endpoint entero a propósito: la URL del endpoint funciona como
 * credencial —conocerla es lo que autoriza `POST /api/push/renovar`, ver `sw.js`— así que
 * no hay motivo para mandarla de vuelta al navegador solo para comparar. */
export function huellaDeEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
}

/** Los dispositivos suscriptos, para el bloque de diagnóstico del panel. */
export async function listarSuscripciones(): Promise<
  {
    huella: string
    servicio: string
    userAgent: string | null
    ultimoEstado: number | null
    ultimoIntentoEn: Date | null
  }[]
> {
  const filas = await prisma.pushSuscripcion.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return filas.map((s) => ({
    huella: huellaDeEndpoint(s.endpoint),
    servicio: hostDe(s.endpoint),
    userAgent: s.userAgent,
    ultimoEstado: s.ultimoEstado,
    ultimoIntentoEn: s.ultimoIntentoEn,
  }))
}
