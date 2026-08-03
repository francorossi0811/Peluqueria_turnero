import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { buscarTurnos } from '../../api/agenda'
import { fechaLegible } from '../../utils/fecha'
import type { EstadoTurno, TurnoAdmin } from '../../types/api'

const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  reservado: 'Reservado',
  cancelado: 'Cancelado',
  reprogramado: 'Reprogramado',
  realizado: 'Realizado',
  ausente: 'Ausente',
}

const ESTILO_ESTADO: Record<EstadoTurno, string> = {
  reservado: 'bg-miel-suave text-miel',
  cancelado: 'bg-borde-suave text-tinta-tenue',
  reprogramado: 'bg-borde-suave text-tinta-tenue',
  realizado: 'bg-bien-suave text-bien',
  ausente: 'bg-alerta-suave text-alerta',
}

// Caso borde: cliente perdió su link único — Ariel lo busca acá para reenviárselo.
export function BuscarTurnoPage() {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      buscarTurnos({
        nombre: nombre.trim() || undefined,
        telefono: telefono.trim() || undefined,
      }),
  })

  const puedeBuscar = nombre.trim().length > 0 || telefono.trim().length > 0

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeBuscar) return
    mutation.mutate()
  }

  return (
    <div>
      <h1 className="font-display text-tinta mb-4 text-2xl font-semibold">
        Buscar turno
      </h1>
      <p className="text-tinta-suave mb-4 text-sm">
        Para cuando un cliente perdió su link y necesitás reenviárselo.
      </p>

      <form onSubmit={buscar} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Nombre
          </span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border-borde bg-superficie text-tinta focus:border-vino rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Teléfono
          </span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="border-borde bg-superficie text-tinta focus:border-vino rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <Button
          type="submit"
          variant="primaryVino"
          disabled={!puedeBuscar || mutation.isPending}
        >
          {mutation.isPending ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {mutation.isSuccess && mutation.data.length === 0 && (
        <p className="text-tinta-suave">No encontramos turnos.</p>
      )}

      {mutation.isSuccess && mutation.data.length > 0 && (
        <div className="flex flex-col gap-2">
          {mutation.data.map((t) => (
            <FilaResultado key={t.id} turno={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilaResultado({ turno }: { turno: TurnoAdmin }) {
  const [copiado, setCopiado] = useState(false)
  const link = `${window.location.origin}/turno/${turno.id}`

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-tinta font-medium">
          {turno.clienteNombre} · {turno.clienteTelefono}
        </p>
        <p className="text-tinta-suave text-sm">
          {turno.servicio.nombre} · {fechaLegible(turno.fecha)} · {turno.hora}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${ESTILO_ESTADO[turno.estado]}`}
        >
          {ETIQUETA_ESTADO[turno.estado]}
        </span>
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(link)
            setCopiado(true)
          }}
        >
          {copiado ? 'Copiado ✓' : 'Copiar link'}
        </Button>
      </div>
    </Card>
  )
}
