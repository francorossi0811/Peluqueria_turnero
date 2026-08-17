import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'

// HU-30 — El primer menú desplegable del proyecto.
//
// Existe porque la barra de la agenda tenía tres botones sueltos con el mismo peso visual,
// aunque Ariel use "Cargar turno" todos los días y los otros dos casi nunca. Con la
// exportación serían cuatro y a 375 px envolvían de a uno.
//
// ⚠️ Es también el **primer listener a nivel `document`** del proyecto. Hasta ahora lo único
// que cerraba "al tocar afuera" era el burbujeo de `onClick` de `Modal.tsx`, que alcanza
// para un overlay a pantalla completa pero no para un panel flotante: acá no hay nada que
// cubra el resto de la pantalla, así que el click hay que escucharlo arriba de todo.

interface MenuDesplegableProps {
  etiqueta: string
  children: (cerrar: () => void) => ReactNode
  className?: string
}

export function MenuDesplegable({
  etiqueta,
  children,
  className = '',
}: MenuDesplegableProps) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return

    function alTocar(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false)
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAbierto(false)
    }

    // `pointerdown` y no `click`: en un celular el `click` llega ~300 ms después del toque
    // y con un `<select>` o un botón debajo el menú quedaba abierto encima de lo que se
    // acababa de tocar.
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    // ⚠️ Sin esta limpieza queda un listener vivo por cada apertura, y encima apuntando a un
    // `setAbierto` de un render viejo. El `if (!abierto) return` de arriba es lo que hace
    // que solo esté suscripto mientras el menú se ve.
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  return (
    <div ref={contenedor} className={`relative ${className}`}>
      <Button
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((previo) => !previo)}
      >
        {etiqueta} <span aria-hidden="true">▾</span>
      </Button>

      {abierto && (
        // `min-w-full` y no un ancho fijo: los ítems son frases ("Bloquear horario") y un
        // panel más angosto que el botón se ve como un error de layout.
        //
        // ⚠️ **De qué lado se ancla cambia con el ancho**, y esto se encontró midiendo el
        // DOM y no mirando la pantalla: el panel es más ancho que el botón, así que con
        // `right-0` crece hacia la izquierda. A 375 px el botón queda pegado al margen
        // izquierdo (la fila envuelve) y el panel terminaba en **x = -4 px**, con la
        // primera letra de "Bloquear horario" cortada contra el borde de la pantalla. De
        // `sm:` para arriba la fila no envuelve y el botón queda a la derecha, donde el que
        // se sale es el otro extremo — por eso ahí sí manda `right-0`.
        <div
          role="menu"
          className="border-borde bg-superficie absolute top-full left-0 z-40 mt-1 min-w-full overflow-hidden rounded-lg border shadow-lg sm:right-0 sm:left-auto"
        >
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  )
}

/** Un ítem del menú. Recibe el `cerrar` que le pasa el menú a sus hijos, así que elegir una
 * opción siempre lo cierra: dejarlo abierto arriba del modal que se acaba de abrir era la
 * forma más fácil de que esto se sintiera roto. */
export function ItemDeMenu({
  onSelect,
  children,
}: {
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="text-tinta hover:bg-superficie-2 block w-full px-4 py-3 text-left text-sm font-medium whitespace-nowrap transition"
    >
      {children}
    </button>
  )
}
