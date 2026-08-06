import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { buscarTurnos } from '../../api/agenda'
import { fechaLegible } from '../../utils/fecha'
import type { EstadoTurno, TurnoAdmin } from '../../types/api'

// Caso borde de Docs/historias-de-usuario-casos-de-uso.md §4: el cliente perdió su link
// único y Ariel se lo tiene que reenviar. Antes era una página propia en el nav; es una
// acción puntual sobre la agenda, no una sección donde uno se queda, así que vive acá
// junto a "Cargar turno" y "Bloquear horario".

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

const INPUT =
  'border-borde bg-superficie text-tinta focus:border-miel w-full rounded-md border px-3 py-2 outline-none'

export function ModalBuscarTurno({ onClose }: { onClose: () => void }) {
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
    <Modal titulo="Buscar turno" onClose={onClose}>
      <p className="text-tinta-suave mb-4 text-sm">
        Para cuando un cliente perdió su link y necesitás reenviárselo.
      </p>

      <form onSubmit={buscar} className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-[8rem] flex-1 flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Nombre
            </span>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="flex min-w-[8rem] flex-1 flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Teléfono
            </span>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={INPUT}
            />
          </label>
        </div>
        <Button
          type="submit"
          variant="primaryVino"
          disabled={!puedeBuscar || mutation.isPending}
        >
          {mutation.isPending ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {mutation.isError && (
        <p className="text-vino text-sm">
          No pudimos buscar. Probá de nuevo.
        </p>
      )}
      {mutation.isSuccess && mutation.data.length === 0 && (
        <p className="text-tinta-suave text-sm">No encontramos turnos.</p>
      )}
      {mutation.isSuccess && mutation.data.length > 0 && (
        <div className="flex flex-col gap-2">
          {mutation.data.map((t) => (
            <FilaResultado key={t.id} turno={t} />
          ))}
        </div>
      )}
    </Modal>
  )
}

function FilaResultado({ turno }: { turno: TurnoAdmin }) {
  const [copiado, setCopiado] = useState(false)
  const link = `${window.location.origin}/turno/${turno.id}`

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {/* Ver FilaTurno: el teléfono puede faltar en los turnos que carga Ariel. */}
        <p className="text-tinta font-medium">
          {turno.clienteNombre}
          {turno.clienteTelefono && ` · ${turno.clienteTelefono}`}
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
