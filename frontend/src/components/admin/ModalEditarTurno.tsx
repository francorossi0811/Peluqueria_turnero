import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { GrillaHorarios } from '../GrillaHorarios'
import { editarTurno } from '../../api/agenda'
import { obtenerDisponibilidad } from '../../api/disponibilidad'
import { hoyIso, sumarDias, fechaLegible } from '../../utils/fecha'
import type { ErrorApi, TurnoAdmin } from '../../types/api'

const DIAS_A_MOSTRAR = 14

interface ModalEditarTurnoProps {
  turno: TurnoAdmin
  onClose: () => void
}

export function ModalEditarTurno({ turno, onClose }: ModalEditarTurnoProps) {
  const queryClient = useQueryClient()
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const desde = hoyIso()
  const hasta = sumarDias(desde, DIAS_A_MOSTRAR - 1)

  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad', turno.servicio.id, desde, hasta],
    queryFn: () => obtenerDisponibilidad(turno.servicio.id, desde, hasta),
  })

  const editarMutation = useMutation({
    mutationFn: () => editarTurno(turno.id, { fecha: fecha!, hora: hora! }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      onClose()
    },
    onError: (err) => {
      const codigo = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.codigo
        : null

      if (codigo === 'HORARIO_NO_DISPONIBLE') {
        setError('Ese horario se acaba de ocupar. Elegí otro.')
        setHora(null)
        void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
        return
      }
      if (codigo === 'TURNO_NO_MODIFICABLE') {
        setError('Este turno ya no está activo.')
        void queryClient.invalidateQueries({ queryKey: ['agenda'] })
        return
      }
      setError('No pudimos mover el turno. Probá de nuevo.')
    },
  })

  return (
    <Modal titulo="Editar turno" onClose={onClose}>
      <p className="text-tinta-suave mb-1 text-sm">
        {turno.servicio.nombre} · {turno.clienteNombre}
      </p>
      <p className="text-tinta-tenue mb-4 text-sm">
        Actualmente: {fechaLegible(turno.fecha)} · {turno.hora}
      </p>

      {error && (
        <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {disponibilidadQuery.isPending && (
        <p className="text-tinta-suave">Cargando disponibilidad…</p>
      )}
      {disponibilidadQuery.isError && (
        <p className="text-vino">No pudimos cargar la disponibilidad.</p>
      )}
      {disponibilidadQuery.data && (
        <GrillaHorarios
          dias={disponibilidadQuery.data}
          fecha={fecha}
          hora={hora}
          onElegirFecha={(f) => {
            setFecha(f)
            setHora(null)
          }}
          onElegirHora={setHora}
        />
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primaryVino"
          className="flex-1"
          disabled={!fecha || !hora || editarMutation.isPending}
          onClick={() => editarMutation.mutate()}
        >
          {editarMutation.isPending ? 'Guardando…' : 'Guardar nuevo horario'}
        </Button>
      </div>
    </Modal>
  )
}
