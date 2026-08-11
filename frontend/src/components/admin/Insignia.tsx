import type { Etiqueta } from '../../types/api'

// HU-25 — La insignia del cliente: un círculo del color que eligió Ariel.
//
// Dos formas de la misma cosa, y la diferencia es deliberada:
//
// - En la grilla de la semana va **solo el círculo**. Ahí el espacio es el que dura el
//   turno —un turno de 20 minutos son 34 píxeles de alto— y el nombre del cliente ya se
//   está peleando por él. El color se lee sin leer, que es justamente para lo que Ariel
//   usaba el color en la planilla.
// - Al abrir el turno va el círculo **con su nombre al lado**, que es donde el color deja
//   de ser un código y pasa a decir qué significa.
//
// El anillo alrededor usa `tinta`, o sea el color del texto: por definición contrasta
// contra el fondo de la superficie en los dos temas. Sin él, una insignia negra
// desaparece sobre el panel oscuro y una blanca sobre el claro — y Ariel elige el color
// libremente, así que los dos casos van a pasar.
const ANILLO = 'ring-1 ring-tinta/25'

export function Insignia({ etiqueta }: { etiqueta: Etiqueta }) {
  return (
    <span
      title={etiqueta.nombre}
      aria-label={etiqueta.nombre}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ANILLO}`}
      style={{ backgroundColor: etiqueta.color }}
    />
  )
}

export function InsigniaConNombre({ etiqueta }: { etiqueta: Etiqueta }) {
  return (
    <span className="border-borde bg-superficie-2 text-tinta inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs">
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ANILLO}`}
        style={{ backgroundColor: etiqueta.color }}
      />
      {etiqueta.nombre}
    </span>
  )
}

/** Las insignias de un cliente, en fila. Devuelve `null` si no tiene ninguna, así el
 * llamador no tiene que acordarse de esconder un contenedor vacío. */
export function Insignias({
  etiquetas,
  conNombre = false,
}: {
  etiquetas: Etiqueta[]
  conNombre?: boolean
}) {
  if (etiquetas.length === 0) return null

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {etiquetas.map((e) =>
        conNombre ? (
          <InsigniaConNombre key={e.id} etiqueta={e} />
        ) : (
          <Insignia key={e.id} etiqueta={e} />
        ),
      )}
    </span>
  )
}
