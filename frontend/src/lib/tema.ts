// Tema del panel de Ariel (claro / oscuro). Solo aplica a `/admin/*` — el lado del
// cliente mantiene siempre el crema del diseño original.
//
// Es un store propio de tres funciones en vez de un contexto de React porque el tema lo
// lee el layout (para pintarlo) y lo escribe "Mi cuenta" (para cambiarlo), que están en
// ramas distintas del árbol. Un contexto obligaría a envolver toda la app para dos
// componentes; esto se consume con `useSyncExternalStore` y no agrega un provider.

export type Tema = 'claro' | 'oscuro'

const CLAVE = 'turnero_tema_panel'

/** Oscuro por defecto: es lo que pidió Ariel, que usa lentes y el fondo crema le cansa
 * la vista. Que el default sea el que él quiere significa que no tiene que tocar el
 * interruptor en ninguno de sus tres dispositivos — solo Franco, si quiere el claro. */
const POR_DEFECTO: Tema = 'oscuro'

const oyentes = new Set<() => void>()
let cacheado: Tema | null = null

function leerDelStorage(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : POR_DEFECTO
  } catch {
    // Safari en navegación privada puede tirar al tocar localStorage. El tema es una
    // comodidad, no algo por lo que valga la pena romper el panel.
    return POR_DEFECTO
  }
}

/** La preferencia se guarda **por dispositivo**, no en la cuenta: Ariel usa dos celulares
 * y una computadora, pero como el default ya es el que él quiere, no necesita
 * sincronización. Una columna en base y un endpoint para ahorrar un clic que
 * probablemente nunca haga no se justifican. */
export function temaActual(): Tema {
  cacheado ??= leerDelStorage()
  return cacheado
}

export function cambiarTema(tema: Tema): void {
  cacheado = tema
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // Sin persistencia, pero el cambio vale para esta sesión.
  }
  for (const avisar of oyentes) avisar()
}

export function suscribirseAlTema(avisar: () => void): () => void {
  oyentes.add(avisar)
  return () => {
    oyentes.delete(avisar)
  }
}
