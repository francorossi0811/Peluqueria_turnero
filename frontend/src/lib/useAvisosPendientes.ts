import { useEffect } from 'react'

// Aviso de turnos nuevos que NO depende del push (HU-18).
//
// Es el canal que sí funciona siempre: el push depende del servicio del sistema, del
// ahorro de batería y de qué navegador use el dispositivo — justamente lo que nos hizo
// perder tiempo con el celular de Ariel. Esto es el título de la pestaña, un punto en el
// favicon, y el badge sobre el ícono de la PWA instalada.

const TITULO_BASE = 'La Peluquería de Ariel Enrique — Turnero'

/** El favicon original, para poder volver a él cuando no hay pendientes. Los dos son
 * SVG, así que el `type` del <link> sigue siendo correcto en los dos casos. */
let faviconLimpio: string | null = null

function elementoFavicon(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel="icon"]')
}

/** El ícono con un punto rojo encima, como data URL.
 *
 * Se arma como SVG y no dibujando el PNG en un canvas. El canvas parecía lo obvio, pero
 * `imagen.decode()` sobre una imagen que no está en el documento **se cuelga sin
 * resolver ni rechazar** cuando el archivo todavía no está en caché — o sea que andaba
 * en la segunda visita y no en la primera, que es el peor modo de falla posible. Esto es
 * sincrónico y no puede colgarse.
 *
 * La tijera está copiada de `public/icono.svg`. Si se cambia el ícono, cambiar acá
 * también; es la contra de no cargar el archivo, y a diez líneas de markup es un precio
 * más barato que una carga asincrónica que a veces no vuelve. */
function faviconConPunto(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#201f1d"/>
<g transform="translate(256 256) scale(.86) translate(-256 -256)">
<g fill="none" stroke="#f7efe3" stroke-width="28" stroke-linecap="round">
<path d="M150 108 340 355"/><path d="M362 108 172 355"/>
<circle cx="157" cy="400" r="48"/><circle cx="355" cy="400" r="48"/>
</g><circle cx="256" cy="246" r="17" fill="#b68235"/></g>
<circle cx="378" cy="378" r="150" fill="#f7efe3"/>
<circle cx="378" cy="378" r="118" fill="#d3372b"/>
</svg>`
  // `encodeURIComponent` y no base64: el SVG queda legible en las herramientas del
  // navegador y evita el problema de los caracteres no ASCII con `btoa`.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Pone el contador de turnos sin ver en la pestaña, el favicon y el ícono de la app.
 *
 * `pendientes` es la suma de lo que Ariel todavía no miró. Con 0 vuelve todo a su estado
 * normal. */
export function useAvisosPendientes(pendientes: number): void {
  useEffect(() => {
    document.title = pendientes > 0 ? `(${pendientes}) ${TITULO_BASE}` : TITULO_BASE
  }, [pendientes])

  useEffect(() => {
    const link = elementoFavicon()
    if (!link) return
    faviconLimpio ??= link.href
    link.href = pendientes > 0 ? faviconConPunto() : faviconLimpio
  }, [pendientes])

  useEffect(() => {
    // Badging API: el puntito sobre el ícono de la PWA instalada, que es donde más le
    // sirve a Ariel en el celular. No existe en iPhone ni en Firefox, de ahí el `?.`.
    // Los errores se tragan: falla si la app no está instalada, y eso no es un problema.
    if (pendientes > 0) void navigator.setAppBadge?.(pendientes).catch(() => {})
    else void navigator.clearAppBadge?.().catch(() => {})
  }, [pendientes])
}
