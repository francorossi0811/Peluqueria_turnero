// Tema del panel de Ariel (claro / oscuro). Solo aplica a `/admin/*` — el lado del
// cliente mantiene siempre el crema del diseño original.
//
// Es un store propio de tres funciones en vez de un contexto de React porque el tema lo
// lee el layout (para pintarlo) y lo escribe "Mi cuenta" (para cambiarlo), que están en
// ramas distintas del árbol. Un contexto obligaría a envolver toda la app para dos
// componentes; esto se consume con `useSyncExternalStore` y no agrega un provider.

export type Tema = 'claro' | 'oscuro'

const CLAVE = 'turnero_tema_panel'

/** Claro por defecto desde el 13/8/2026, por pedido de Ariel.
 *
 * Antes era oscuro, y el motivo era el mismo de siempre: usa lentes y el crema le cansaba
 * la vista. Lo que cambió es que la agenda ahora se lee por colores planos de alto
 * contraste (naranja / verde claro / verde fuerte / rojo), que son fijos en los dos temas,
 * y sobre esos colores el resto del panel le cierra en claro. El interruptor de "Mi
 * cuenta" sigue estando: lo que cambia es con cuál arranca un dispositivo nuevo. */
const POR_DEFECTO: Tema = 'claro'

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
