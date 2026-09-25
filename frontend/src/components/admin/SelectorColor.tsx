import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../ui/Button'
import { obtenerColoresRecientes } from '../../api/agenda'
import { tintaSobre } from '../../utils/color'
import type { ErrorApi } from '../../types/api'

/** HU-34 — El color que trae el selector cuando todavía no hay ninguno. Es el ámbar de la
 * marca y no el negro con el que arranca `<input type="color">`, por lo mismo que en las
 * etiquetas: el negro sobre el panel oscuro es un bloque invisible. */
const COLOR_INICIAL = '#b68235'

/**
 * HU-34 — Elegir un color: la rueda, "Sin color" y los últimos que usó Ariel.
 *
 * Lo usan el turno y la nota del día (24/9/2026). Es **un** componente y no dos copias
 * porque la parte delicada es la misma en los dos, y una copia que se olvide de ella vuelve
 * a traer el bug de las etiquetas:
 *
 * ⚠️ **El color se elige en estado local y se guarda con un botón, nunca en el `onChange`
 * del selector.** El `<input type="color">` dispara `onChange` **continuo mientras se
 * arrastra el cursor por la rueda**; atado al servidor mandó 31 PATCH por un solo cambio de
 * color (4/9/2026), y los que volvían pisaban lo que Ariel estaba eligiendo.
 *
 * Los colores recientes se tocan de a uno y guardan en el acto: ahí no hay arrastre, es un
 * click, un color, un PATCH. La paleta es una sola para turnos y notas —la lleva el
 * backend—, así que el rojo que usa para "urgente" lo tiene a mano en los dos lados.
 */
export function SelectorColor({
  actual,
  guardar,
  alGuardar,
  ariaLabel,
}: {
  /** El color guardado hoy, o `null` si no tiene. */
  actual: string | null
  guardar: (color: string | null) => Promise<unknown>
  /** Para refrescar lo que dibuja el color (la agenda, las notas). */
  alGuardar: () => void
  ariaLabel: string
}) {
  const queryClient = useQueryClient()
  const [color, setColor] = useState(actual ?? COLOR_INICIAL)
  const [error, setError] = useState<string | null>(null)

  const recientesQuery = useQuery({
    queryKey: ['colores-recientes'],
    queryFn: obtenerColoresRecientes,
  })

  const mutation = useMutation({
    mutationFn: guardar,
    onMutate: () => setError(null),
    onSuccess: () => {
      alGuardar()
      void queryClient.invalidateQueries({ queryKey: ['colores-recientes'] })
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null
      setError(mensaje ?? 'No pudimos guardar el color.')
    },
  })

  const recientes = recientesQuery.data ?? []
  const guardando = mutation.isPending

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label={ariaLabel}
          className="border-borde h-11 w-14 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Button
          variant="outline"
          disabled={guardando}
          onClick={() => mutation.mutate(color)}
        >
          {guardando ? 'Guardando…' : 'Poner este color'}
        </Button>
        {/* Solo si hay algo que sacar: un botón que no hace nada es ruido. */}
        {actual && (
          <Button
            variant="ghost"
            disabled={guardando}
            onClick={() => mutation.mutate(null)}
          >
            Sin color
          </Button>
        )}
      </div>

      {recientes.length > 0 && (
        <div className="mt-3">
          <p className="text-tinta-tenue mb-1 text-xs">
            Los últimos que usaste
          </p>
          <div className="flex flex-wrap gap-2">
            {recientes.map((c) => (
              <button
                key={c}
                type="button"
                disabled={guardando}
                onClick={() => {
                  setColor(c)
                  mutation.mutate(c)
                }}
                aria-label={`Usar el color ${c}`}
                title={c}
                // El tilde encima y no un anillo alrededor: sobre un color elegido por
                // Ariel, un anillo de color fijo puede desaparecer (es lo que ya pasó con
                // las insignias de HU-25), y `tintaSobre` contrasta contra cualquiera.
                className={`border-borde h-8 w-8 rounded-md border text-sm leading-none font-bold ${
                  actual === c ? '' : 'opacity-90'
                }`}
                style={{ backgroundColor: c, color: tintaSobre(c) }}
              >
                {actual === c ? '✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-vino mt-2 text-sm">{error}</p>}
    </div>
  )
}
