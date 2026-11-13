import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { obtenerClientes } from '../../api/clientes'
import type { ClienteResumen } from '../../types/api'

/** Cuántos resultados se muestran. Con más, lo que hace falta es escribir un poco más. */
const MAX_SUGERENCIAS = 8

/**
 * HU-38 — Buscar una ficha que ya existe, para elegirla.
 *
 * Lo usan dos lugares: el detalle de un turno sin ficha (para **asignársela**) y la carga
 * de un turno nuevo (para **completar el nombre y el teléfono** con los de la ficha). Pega
 * contra la misma búsqueda que la sección Clientes —apodo, nombre o teléfono—, así que
 * encuentra lo mismo que Ariel encontraría allá. Qué pasa al elegir lo decide cada uno.
 */
export function BuscadorDeClientes({
  etiquetaBoton,
  onElegir,
  ocupadoId = null,
}: {
  /** El texto del botón de cada resultado: "Asignar", "Elegir". */
  etiquetaBoton: string
  onElegir: (cliente: ClienteResumen) => void
  /** El cliente que se está procesando, para mostrar "…" y no dejar tocar otro. */
  ocupadoId?: string | null
}) {
  const [buscar, setBuscar] = useState('')
  const termino = buscar.trim()

  // Desde dos letras: con una sola la lista es casi toda la base y no ayuda a elegir.
  const clientesQuery = useQuery({
    queryKey: ['clientes', termino, ''],
    queryFn: () => obtenerClientes({ buscar: termino }),
    enabled: termino.length >= 2,
  })
  const resultados = clientesQuery.data ?? []

  return (
    <div className="flex flex-col gap-2">
      <input
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        placeholder="Nombre, apodo o teléfono"
        aria-label="Buscar cliente"
        autoFocus
        className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2.5 text-base outline-none"
      />

      {termino.length < 2 ? (
        <p className="text-tinta-tenue text-sm">
          Escribí al menos dos letras o números.
        </p>
      ) : clientesQuery.isPending ? (
        <p className="text-tinta-tenue text-sm">Buscando…</p>
      ) : clientesQuery.isError ? (
        <p className="text-vino text-sm">No pudimos buscar. Probá de nuevo.</p>
      ) : resultados.length === 0 ? (
        <p className="text-tinta-suave text-sm">
          No hay ningún cliente con «{termino}». Si es nuevo, cargale el
          teléfono y se crea la ficha.
        </p>
      ) : (
        <ul className="border-borde divide-borde flex flex-col divide-y rounded-md border">
          {resultados.slice(0, MAX_SUGERENCIAS).map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-tinta truncate font-medium">
                  {c.apodo || c.nombre}
                </p>
                <p className="text-tinta-suave truncate text-sm">
                  {c.apodo ? `${c.nombre} · ` : ''}
                  {c.telefono}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={ocupadoId !== null}
                onClick={() => onElegir(c)}
              >
                {ocupadoId === c.id ? '…' : etiquetaBoton}
              </Button>
            </li>
          ))}
          {resultados.length > MAX_SUGERENCIAS && (
            <li className="text-tinta-tenue px-3 py-2 text-sm">
              Hay {resultados.length - MAX_SUGERENCIAS} más. Escribí un poco más
              para encontrarlo.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
