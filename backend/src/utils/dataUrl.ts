// HU-29 — Decodificar la foto que manda el panel.
//
// La subida viaja como data URL dentro de un JSON (`data:image/jpeg;base64,…`) y no como
// multipart. Es una decisión, no una comodidad: multipart pedía `multer`, y este proyecto ya
// eligió no sumar dependencias cuando la plataforma alcanza (el adaptador de WhatsApp usa el
// `fetch` nativo por el mismo motivo). El costo asumido es el ~33% que infla base64, que sobre
// una foto de 150 KB no se nota.
//
// Vive acá y no en el service para poder testearlo como función pura: lo que hay que fijar son
// los casos de entrada rota, y ninguno necesita base de datos.

/** Los formatos que se aceptan. Cerrado a propósito: `image/*` dejaría entrar SVG, que es un
 * documento ejecutable y no una foto — un SVG con `<script>` servido desde nuestro dominio es
 * XSS, y estas imágenes se sirven desde la misma API que todo lo demás. */
const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

/** Tope duro del lado del servidor. El navegador apunta a ~150 KB, así que esto es margen y no
 * el límite real: existe para que una subida armada a mano no pueda meter cualquier cosa. */
export const MAX_BYTES = 600 * 1024

export interface ImagenDecodificada {
  /** `Uint8Array<ArrayBuffer>` y no `Buffer`: es exactamente lo que pide el tipo `Bytes` de
   * Prisma 7. Un `Buffer` *es* un `Uint8Array`, pero el suyo está parametrizado con
   * `ArrayBufferLike` —que incluye `SharedArrayBuffer`— y el tipo generado exige un
   * `ArrayBuffer` común. De ahí la copia explícita en la función. */
  datos: Uint8Array<ArrayBuffer>
  mimeType: string
  bytes: number
}

export type ErrorDeImagen = 'formato' | 'peso'

export type ResultadoDecodificar =
  | { ok: true; imagen: ImagenDecodificada }
  | { ok: false; motivo: ErrorDeImagen }

/**
 * Convierte una data URL en el binario a guardar, o dice por qué no se puede.
 *
 * Devuelve el motivo y no un `null` porque los dos casos piden mensajes distintos: "ese
 * formato no lo aceptamos" y "esa foto pesa demasiado" mandan a la persona a hacer cosas
 * diferentes, y un único "imagen inválida" la deja adivinando.
 *
 * ⚠️ El mime se toma **del encabezado que manda el cliente**, así que no es una prueba de que
 * el contenido sea esa imagen: alguien puede mandar un PDF diciendo que es un JPEG. Lo que sí
 * garantiza es que nunca vamos a devolver un `Content-Type` fuera de la lista de arriba, que es
 * lo que importa para no servir algo ejecutable. Validar los bytes de verdad pediría leer los
 * magic numbers de cada formato, y el único que puede subir acá es Ariel, autenticado.
 */
export function decodificarDataUrl(valor: string): ResultadoDecodificar {
  const match = /^data:([a-z-]+\/[a-z+.-]+);base64,(.+)$/i.exec(valor.trim())
  if (!match) return { ok: false, motivo: 'formato' }

  const mimeType = match[1].toLowerCase()
  if (!MIMES_PERMITIDOS.includes(mimeType)) return { ok: false, motivo: 'formato' }

  const decodificado = Buffer.from(match[2], 'base64')
  // `Buffer.from` no falla con base64 roto: descarta lo que no entiende y puede devolver algo
  // vacío o mucho más corto. Un largo de cero es la única señal barata de que no había imagen.
  if (decodificado.length === 0) return { ok: false, motivo: 'formato' }
  if (decodificado.length > MAX_BYTES) return { ok: false, motivo: 'peso' }

  const datos = new Uint8Array(decodificado.byteLength)
  datos.set(decodificado)
  return { ok: true, imagen: { datos, mimeType, bytes: datos.length } }
}
