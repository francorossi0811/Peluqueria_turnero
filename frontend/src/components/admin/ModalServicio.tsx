import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { actualizarServicio, crearServicio } from '../../api/servicios'
import type { ErrorApi, ServicioAdmin } from '../../types/api'

interface ModalServicioProps {
  servicio?: ServicioAdmin
  onClose: () => void
}

export function ModalServicio({ servicio, onClose }: ModalServicioProps) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState(servicio?.nombre ?? '')
  const [duracionMinutos, setDuracionMinutos] = useState(
    servicio?.duracionMinutos ?? 30,
  )
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      servicio
        ? actualizarServicio(servicio.id, { nombre, duracionMinutos })
        : crearServicio({ nombre, duracionMinutos }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['servicios-admin'] })
      onClose()
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null
      setError(mensaje ?? 'No pudimos guardar el servicio. Probá de nuevo.')
    },
  })

  return (
    <Modal
      titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Nombre
          </span>
          <input
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Duración (minutos)
          </span>
          <input
            required
            type="number"
            min={1}
            max={480}
            step={5}
            value={duracionMinutos}
            onChange={(e) => setDuracionMinutos(Number(e.target.value))}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>

        {error && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primaryVino"
            className="flex-1"
            disabled={
              !nombre.trim() || duracionMinutos < 1 || mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
