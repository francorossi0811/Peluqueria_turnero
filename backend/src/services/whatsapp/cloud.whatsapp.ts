import type { MensajePlantilla, Whatsapp } from './whatsapp'

// Envío por la Cloud API de Meta. Es un POST común con el token en el header
// `Authorization`, así que lo cubre el `fetch` nativo de Node: igual que con Brevo, no
// hace falta agregar ninguna dependencia HTTP.
//
// Se usa la Cloud API (y no un intermediario tipo Twilio) porque desde mayo de 2026
// Coexistence permite tener el **mismo número** en la app de WhatsApp Business que Ariel
// ya usa y en la API a la vez, sin perder chats. Ese era el bloqueante histórico.
const HOST_GRAPH = 'https://graph.facebook.com'

export function crearCloudWhatsapp(config: {
  token: string
  phoneNumberId: string
  version: string
}): Whatsapp {
  return {
    async enviarPlantilla(mensaje: MensajePlantilla): Promise<void> {
      const componentes: unknown[] = [
        {
          type: 'body',
          parameters: mensaje.variablesCuerpo.map((texto) => ({
            type: 'text',
            text: texto,
          })),
        },
      ]

      if (mensaje.variableBotonUrl !== undefined) {
        componentes.push({
          type: 'button',
          sub_type: 'url',
          // El índice es el del botón dentro de la plantilla, no el de la variable.
          // Nuestra plantilla tiene uno solo.
          index: '0',
          parameters: [{ type: 'text', text: mensaje.variableBotonUrl }],
        })
      }

      const res = await fetch(
        `${HOST_GRAPH}/${config.version}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: mensaje.para,
            type: 'template',
            template: {
              name: mensaje.plantilla,
              language: { code: mensaje.idioma },
              components: componentes,
            },
          }),
        },
      )

      if (!res.ok) {
        const detalle = await res.text().catch(() => '')
        throw new Error(
          `WhatsApp respondió ${res.status}: ${detalle.slice(0, 300)}`,
        )
      }

      // OJO: un 200 acá significa "Meta lo aceptó", **no** "le llegó al cliente". El
      // estado real de entrega viaja por webhook, que está fuera del alcance de esta
      // etapa. Por eso el respaldo por mail cubre el envío que falla, no el que rebota.
    },
  }
}
