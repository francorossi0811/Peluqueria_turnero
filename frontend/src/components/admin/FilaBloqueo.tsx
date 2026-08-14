import { useState } from 'react'
import { Button } from '../ui/Button'
import type { Bloqueo } from '../../types/api'

interface FilaBloqueoProps {
  bloqueo: Bloqueo
  onLevantar: () => void
  levantando: boolean
}

export function FilaBloqueo({
  bloqueo,
  onLevantar,
  levantando,
}: FilaBloqueoProps) {
  const [confirmando, setConfirmando] = useState(false)

  const rango =
    bloqueo.fechaInicio === bloqueo.fechaFin
      ? bloqueo.horaInicio && bloqueo.horaFin
        ? `${bloqueo.horaInicio}–${bloqueo.horaFin}`
        : 'Todo el día'
      : bloqueo.horaInicio && bloqueo.horaFin
        ? `${bloqueo.fechaInicio} ${bloqueo.horaInicio} → ${bloqueo.fechaFin} ${bloqueo.horaFin}`
        : `${bloqueo.fechaInicio} → ${bloqueo.fechaFin} (todo el día)`

  // Violeta sólido, el mismo relleno con el que la grilla semanal dibuja un bloqueo: es la
  // misma cosa y tiene que verse igual se la mire donde se la mire. Era ámbar pastel, o sea
  // el color que en esta app ya significa otra cosa.
  //
  // Los botones pasan de `ghost` a `outline`: sobre el violeta, un botón sin caja con texto
  // tenue no se lee. `outline` es una pastilla clara que contrasta sola, sin tener que
  // pelearle por especificidad a las clases de la variante.
  return (
    <div className="border-agenda-linea bg-bloqueo rounded-lg border-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sobre-estado font-medium">🚫 {rango}</p>
          {bloqueo.motivo && (
            <p className="text-sobre-estado text-sm">{bloqueo.motivo}</p>
          )}
        </div>
        {!confirmando && (
          <Button variant="outline" onClick={() => setConfirmando(true)}>
            Levantar
          </Button>
        )}
      </div>

      {confirmando && (
        <div className="border-sobre-estado/40 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <p className="text-sobre-estado text-sm">¿Levantar este bloqueo?</p>
          <Button
            variant="danger"
            disabled={levantando}
            onClick={() => {
              onLevantar()
              setConfirmando(false)
            }}
          >
            {levantando ? 'Levantando…' : 'Sí, levantar'}
          </Button>
          <Button variant="outline" onClick={() => setConfirmando(false)}>
            No, volver
          </Button>
        </div>
      )}
    </div>
  )
}
