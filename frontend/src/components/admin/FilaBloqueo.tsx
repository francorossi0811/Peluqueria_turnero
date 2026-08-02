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

  return (
    <div className="border-alerta bg-alerta-suave rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-alerta font-medium">🚫 {rango}</p>
          {bloqueo.motivo && (
            <p className="text-tinta-suave text-sm">{bloqueo.motivo}</p>
          )}
        </div>
        {!confirmando && (
          <Button variant="ghost" onClick={() => setConfirmando(true)}>
            Levantar
          </Button>
        )}
      </div>

      {confirmando && (
        <div className="border-alerta/30 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <p className="text-tinta text-sm">¿Levantar este bloqueo?</p>
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
          <Button variant="ghost" onClick={() => setConfirmando(false)}>
            No, volver
          </Button>
        </div>
      )}
    </div>
  )
}
