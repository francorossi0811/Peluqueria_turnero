// Contrato de envío de mail (HU-19). Deliberadamente mínimo y sin nada propio de un
// proveedor: cambiar de Brevo a otro es agregar un archivo que implemente `Mailer` y
// tocar una línea en `index.ts`.

export interface Adjunto {
  nombre: string
  contenidoBase64: string
  tipoMime: string
}

export interface Mensaje {
  para: string
  asunto: string
  html: string
  /** La versión en texto plano no es opcional: el link de gestión tiene que poder
   * leerse en clientes que bloquean HTML, y tener un `text/plain` mejora bastante la
   * entregabilidad cuando se manda desde una IP compartida. */
  texto: string
  adjuntos?: Adjunto[]
}

export interface Mailer {
  enviar(mensaje: Mensaje): Promise<void>
}
