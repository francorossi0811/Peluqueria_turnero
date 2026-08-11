import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { InputHora } from '../ui/InputHora'
import { crearBloqueo } from '../../api/bloqueos'
import type { ErrorBloqueoAfectaTurnos, TurnoAfectado } from '../../types/api'

interface ModalBloquearProps {
  fechaInicial: string
  onClose: () => void
}

export function ModalBloquear({ fechaInicial, onClose }: ModalBloquearProps) {
  const queryClient = useQueryClient()
  const [fechaInicio, setFechaInicio] = useState(fechaInicial)
  const [fechaFin, setFechaFin] = useState(fechaInicial)
  const [todoElDia, setTodoElDia] = useState(true)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFin, setHoraFin] = useState('18:00')
  const [motivo, setMotivo] = useState('')
  const [turnosAfectados, setTurnosAfectados] = useState<
    TurnoAfectado[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (confirmarCancelaciones: boolean) =>
      crearBloqueo({
        fechaInicio,
        fechaFin,
        horaInicio: todoElDia ? undefined : horaInicio,
        horaFin: todoElDia ? undefined : horaFin,
        motivo: motivo.trim() || undefined,
        confirmarCancelaciones,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bloqueos'] })
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      onClose()
    },
    onError: (err) => {
      if (isAxiosError<ErrorBloqueoAfectaTurnos>(err)) {
        if (err.response?.data.error.codigo === 'BLOQUEO_AFECTA_TURNOS') {
          setTurnosAfectados(err.response.data.turnosAfectados)
          return
        }
        setError(
          err.response?.data.error.mensaje ??
            'No pudimos crear el bloqueo. Probá de nuevo.',
        )
        return
      }
      setError('No pudimos crear el bloqueo. Probá de nuevo.')
    },
  })

  return (
    <Modal titulo="Bloquear horario" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Desde
            </span>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Hasta
            </span>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={todoElDia}
            onChange={(e) => setTodoElDia(e.target.checked)}
          />
          <span className="text-tinta">Todo el día</span>
        </label>

        {!todoElDia && (
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Desde las
              </span>
              <InputHora
                value={horaInicio}
                onChange={setHoraInicio}
                etiqueta="inicio del bloqueo"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Hasta las
              </span>
              <InputHora
                value={horaFin}
                onChange={setHoraFin}
                etiqueta="fin del bloqueo"
              />
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Motivo (opcional)
          </span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: turno médico"
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>

        {error && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {turnosAfectados && (
          <div className="border-alerta bg-alerta-suave rounded-md border px-3 py-2 text-sm">
            <p className="text-alerta mb-2 font-medium">
              Hay {turnosAfectados.length} turno(s) en ese rango. Si continuás,
              se cancelan automáticamente:
            </p>
            <ul className="text-tinta flex flex-col gap-1">
              {turnosAfectados.map((t) => (
                <li key={t.id}>
                  {t.fecha} {t.hora} · {t.clienteNombre}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {turnosAfectados ? (
            <Button
              variant="danger"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              {mutation.isPending
                ? 'Bloqueando…'
                : `Confirmar y bloquear (cancela ${turnosAfectados.length})`}
            </Button>
          ) : (
            <Button
              variant="primaryVino"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              {mutation.isPending ? 'Bloqueando…' : 'Bloquear'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
