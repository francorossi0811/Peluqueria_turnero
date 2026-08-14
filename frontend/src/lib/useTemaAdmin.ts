import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { suscribirseAlTema, temaActual, type Tema } from './tema'

/** Lee el tema elegido y re-renderiza cuando cambia. */
export function useTema(): Tema {
  return useSyncExternalStore(suscribirseAlTema, temaActual)
}

/** Pinta el panel de oscuro y el resto del sitio de claro. Se monta una sola vez, en
 * `App`.
 *
 * El atributo va en `<html>` y no en `AdminLayout` por tres motivos concretos:
 *
 * 1. `/admin/login` cuelga **fuera** de `AdminLayout` (ver el árbol de rutas en
 *    `App.tsx`), así que un atributo en el layout lo dejaría en claro.
 * 2. La regla de `body` de `index.css` es global: sin tocar la raíz, el fondo crema
 *    asoma por debajo del panel en el rebote de scroll de iOS y macOS.
 * 3. `color-scheme` solo sirve en la raíz, y es lo que hace que los `<input type="date">`
 *    nativos dibujen su ícono en claro sobre el fondo oscuro en vez de negro sobre negro.
 */
export function useTemaAdmin(): void {
  const tema = useTema()
  const { pathname } = useLocation()
  const enPanel = pathname.startsWith('/admin')

  useEffect(() => {
    const raiz = document.documentElement
    if (enPanel && tema === 'oscuro') raiz.dataset.tema = 'oscuro'
    else delete raiz.dataset.tema

    // "Estoy en el panel", que no es lo mismo que "estoy en oscuro": de esto cuelgan las
    // mayúsculas y el piso de 16 px de `index.css`, que valen en los dos temas. Va en la
    // misma raíz y por los mismos motivos que `data-tema` (`/admin/login` cuelga fuera
    // de `AdminLayout`), y es lo que garantiza que nada de esto se filtre al lado del
    // cliente.
    if (enPanel) raiz.dataset.panel = 'admin'
    else delete raiz.dataset.panel

    // El color de la barra del navegador se lee del propio token ya aplicado, en vez de
    // repetir el hex acá: si mañana cambia la paleta, esto la sigue solo.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const fondo = getComputedStyle(raiz).getPropertyValue('--color-fondo')
      if (fondo.trim()) meta.setAttribute('content', fondo.trim())
    }
  }, [enPanel, tema])
}
