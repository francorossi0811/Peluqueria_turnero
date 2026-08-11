import { configWhatsapp } from '../../config/env'
import { crearCloudWhatsapp } from './cloud.whatsapp'
import { consolaWhatsapp } from './consola.whatsapp'
import type { Whatsapp } from './whatsapp'

export type { MensajePlantilla, Whatsapp } from './whatsapp'

let cacheado: Whatsapp | null = null

/** Elige el adaptador según la configuración: la Cloud API si hay credenciales de Meta, y
 * si no, el de consola.
 *
 * Que el fallback sea funcional (y no un error) es lo mismo que se decidió para el mail:
 * el aviso es un extra sobre la reserva, no un requisito para reservar. Sin cuenta
 * configurada la app funciona igual y el mensaje queda en el log del servidor. */
export function obtenerWhatsapp(): Whatsapp {
  if (cacheado) return cacheado

  const config = configWhatsapp()
  cacheado =
    config.token && config.phoneNumberId
      ? crearCloudWhatsapp({
          token: config.token,
          phoneNumberId: config.phoneNumberId,
          version: config.version,
        })
      : consolaWhatsapp
  return cacheado
}

/** Si hay un canal de WhatsApp **real** detrás.
 *
 * Es la diferencia entre "el mensaje salió" y "el mensaje se imprimió en la consola", y
 * de eso depende que se mande o no el mail de respaldo: sin este chequeo, desplegar esta
 * etapa sin credenciales de Meta apagaría el mail de confirmación en silencio, que hoy es
 * el único canal que funciona. */
export function whatsappEstaConfigurado(): boolean {
  return configWhatsapp().token !== null
}

/** Solo para tests: obliga a recalcular el adaptador en la próxima llamada. */
export function resetearWhatsapp(): void {
  cacheado = null
}
