// HU-29 — Achicar una foto antes de subirla.
//
// Es la pieza que hace viable haber guardado los archivos en Postgres: una foto de un celular
// pesa entre 2 y 5 MB, y sin esto el plan gratuito de Neon (0,5 GB) se llena con un puñado de
// fichas. Comprimida queda en ~150 KB, o sea 20 a 30 veces menos.
//
// Sin dependencias: `<canvas>` y `toBlob` alcanzan. Meter una librería de imágenes al bundle
// público para algo que solo usa el panel de Ariel sería hacérselo pagar a todos los clientes.

/** El lado más largo de la foto guardada. 900 px es lo que hace falta para mirar un corte en el
 * panel o llenar la tarjeta de un servicio en la landing; guardar los 4032 px que saca el
 * celular es pagar 20 veces por píxeles que ninguna pantalla del sistema va a mostrar. */
const LADO_MAXIMO = 900

/** Calidad del JPEG. A 0,8 la diferencia no se ve en una foto de un corte y el archivo pesa la
 * mitad que a 0,95. */
const CALIDAD = 0.8

export class ImagenNoLegibleError extends Error {}

/** Cuánto puede medir el lado mayor sin pasarse, manteniendo la proporción.
 *
 * Pura y exportada para poder testearla: es donde se rompen las cuentas de escalado, y probar
 * un canvas de verdad pide un navegador. Una imagen que ya es más chica que el máximo **no se
 * agranda** — estirarla sumaría peso sin sumar un solo detalle.
 */
export function medidasDestino(
  ancho: number,
  alto: number,
  ladoMaximo = LADO_MAXIMO,
): { ancho: number; alto: number } {
  const lado = Math.max(ancho, alto)
  if (lado <= ladoMaximo) return { ancho, alto }

  const escala = ladoMaximo / lado
  return {
    ancho: Math.round(ancho * escala),
    alto: Math.round(alto * escala),
  }
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      // El object URL se libera en los dos caminos: si no, cada foto que Ariel mira antes de
      // decidirse queda ocupando memoria hasta que recargue la página.
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImagenNoLegibleError())
    }
    img.src = url
  })
}

/**
 * Achica y comprime una foto, y devuelve la data URL lista para mandar al backend.
 *
 * Sale siempre en **JPEG**, sea lo que sea que entró. Eso resuelve solo el caso del iPhone, que
 * entrega HEIC: el navegador lo decodifica para dibujarlo y lo que sale del canvas ya es un
 * formato que el backend acepta. Un PNG con transparencia queda con fondo negro, pero acá son
 * fotos sacadas con la cámara, no logos.
 *
 * ⚠️ La orientación la aplica el navegador solo: desde hace años `image-orientation: from-image`
 * es el default para `<img>`, así que la foto vertical del celular se dibuja derecha en el canvas
 * y no acostada, sin leer EXIF a mano.
 */
export async function comprimirImagen(archivo: File): Promise<string> {
  const img = await cargarImagen(archivo)
  const { ancho, alto } = medidasDestino(img.naturalWidth, img.naturalHeight)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImagenNoLegibleError()
  ctx.drawImage(img, 0, 0, ancho, alto)

  return canvas.toDataURL('image/jpeg', CALIDAD)
}

/** Para mostrar cuánto ocupa algo. Un número de bytes crudo no le dice nada a nadie. */
export function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  // Un decimal, salvo que sea redondo: el techo de 400 MB que se muestra en "Mi cuenta" es
  // un número elegido a mano y leerlo como "400.0 MB" lo hace parecer una medición.
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
}
