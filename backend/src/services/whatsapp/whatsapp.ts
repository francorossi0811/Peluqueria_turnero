// Contrato de envío por WhatsApp (HU-21). Igual que `mail/mailer.ts`: deliberadamente
// mínimo y sin nada propio de Meta, así cambiar de proveedor es agregar un archivo que
// implemente `Whatsapp` y tocar una línea en `index.ts`.

/** Un mensaje de plantilla: el único tipo que se puede mandar cuando **el negocio inicia**
 * la conversación, que es siempre nuestro caso (el cliente reservó por la web, no nos
 * escribió). El texto vive aprobado del lado de Meta; nosotros solo mandamos el nombre de
 * la plantilla y los valores de las variables. */
export interface MensajePlantilla {
  /** Destino en E.164 **sin** el `+` (ver `utils/telefono.ts`). */
  para: string
  /** Nombre de la plantilla aprobada, ej. `turno_confirmado`. */
  plantilla: string
  /** Código de idioma con el que se aprobó la plantilla, ej. `es_AR`. */
  idioma: string
  /** Valores de `{{1}}`, `{{2}}`, … del cuerpo, en orden. */
  variablesCuerpo: string[]
  /** Sufijo dinámico del botón de URL. La base (`https://…/turno/`) es parte de la
   * plantilla aprobada y no viaja acá: Meta solo acepta **una** variable, y al final. */
  variableBotonUrl?: string
}

export interface Whatsapp {
  enviarPlantilla(mensaje: MensajePlantilla): Promise<void>
}
