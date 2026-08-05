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
}

/** Alta idempotente: si el mismo dispositivo se vuelve a suscribir, se actualizan las
 * claves en vez de duplicar la fila. */
export async function guardarSuscripcion(
  datos: DatosSuscripcion,
): Promise<void> {
  await prisma.pushSuscripcion.upsert({
    where: { endpoint: datos.endpoint },
    update: { p256dh: datos.p256dh, auth: datos.auth },
    create: datos,
  })
}

export async function borrarSuscripcion(endpoint: string): Promise<void> {
  await prisma.pushSuscripcion.deleteMany({ where: { endpoint } })
}

export interface Notificacion {
  title: string
  body: string
  url: string
}

/** Manda la notificación a todos los dispositivos suscriptos.
 *
 * Nunca lanza: los llamadores son flujos de reserva y un push caído no puede tumbar una
 * reserva. Devuelve a cuántos dispositivos se envió. */
export async function enviarATodos(
  notificacion: Notificacion,
): Promise<number> {
  if (!asegurarConfiguracion()) return 0

  const suscripciones = await prisma.pushSuscripcion.findMany()
  if (suscripciones.length === 0) return 0

  const payload = JSON.stringify(notificacion)
  let enviadas = 0

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        enviadas++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status && CODIGOS_SUSCRIPCION_MUERTA.includes(status)) {
          await borrarSuscripcion(s.endpoint)
          return
        }
        console.error('[push] fallo el envío a un dispositivo:', err)
      }
    }),
  )

  return enviadas
}
