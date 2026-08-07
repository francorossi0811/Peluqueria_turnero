import type { MensajePlantilla, Whatsapp } from './whatsapp'

/** Adaptador de desarrollo: imprime el mensaje en la consola en vez de enviarlo.
 *
 * Es el que se usa cuando no hay `WHATSAPP_TOKEN`, igual que el mailer de consola cuando
 * falta `BREVO_API_KEY`. Sirve para dos cosas: que el proyecto se pueda clonar y correr
 * sin cuenta de Meta, y —lo importante mientras se construye esta etapa— poder verificar
 * el flujo entero en local, sobre todo que el número haya salido normalizado con el `9`
 * de celular, que es donde falla en silencio si sale mal. */
export const consolaWhatsapp: Whatsapp = {
  async enviarPlantilla(mensaje: MensajePlantilla): Promise<void> {
    const variables = mensaje.variablesCuerpo
      .map((valor, i) => `  {{${i + 1}}} = ${valor}`)
      .join('\n')

    console.log(
      [
        '',
        '─── WHATSAPP (simulado — no se envió) ' + '─'.repeat(36),
        `Para:      +${mensaje.para}`,
        `Plantilla: ${mensaje.plantilla} (${mensaje.idioma})`,
        variables,
        `  botón   = …/turno/${mensaje.variableBotonUrl ?? '—'}`,
        '─'.repeat(74),
        '',
      ].join('\n'),
    )
  },
}
