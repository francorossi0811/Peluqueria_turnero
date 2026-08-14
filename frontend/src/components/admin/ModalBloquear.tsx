import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { InputHora } from '../ui/InputHora'
import {
  actualizarBloqueo,
  crearBloqueo,
  eliminarBloqueo,
} from '../../api/bloqueos'
import type {
  Bloqueo,
  ErrorBloqueoAfectaTurnos,
  TurnoAfectado,
} from '../../types/api'

// Crear y editar un bloqueo son **el mismo formulario**, así que son el mismo componente y
// no dos. Lo único que cambia es de dónde salen los valores iniciales, a qué endpoint va y
// que editando aparece "Borrar". Duplicarlo habría dejado dos formularios que hay que
// acordarse de cambiar juntos — el mismo error que ya había pasado con los colores de
// estado copiados en cuatro archivos.
interface ModalBloquearProps {
  /** El día que se toma como valor inicial al **crear**. Se ignora si viene `bloqueo`. */
  fechaInicial: string
  /** Si viene, el modal edita ese bloqueo en vez de crear uno nuevo. */
  bloqueo?: Bloqueo
  onClose: () => void
}

export function ModalBloquear({
  fechaInicial,
  bloqueo,
  onClose,
}: ModalBloquearProps) {
  const editando = bloqueo != null
  const queryClient = useQueryClient()
  const [fechaInicio, setFechaInicio] = useState(
    bloqueo?.fechaInicio ?? fechaInicial,
  )
  const [fechaFin, setFechaFin] = useState(bloqueo?.fechaFin ?? fechaInicial)
  // Un bloqueo sin horas es "todo el día" — es la misma convención que ya usa el backend
  // (`horaInicio: null` = desde el inicio del día), leída al revés para prender el check.
  const [todoElDia, setTodoElDia] = useState(
    bloqueo ? bloqueo.horaInicio === null && bloqueo.horaFin === null : true,
  )
  const [horaInicio, setHoraInicio] = useState(bloqueo?.horaInicio ?? '09:00')
  const [horaFin, setHoraFin] = useState(bloqueo?.horaFin ?? '18:00')
  const [motivo, setMotivo] = useState(bloqueo?.motivo ?? '')
  const [turnosAfectados, setTurnosAfectados] = useState<
    TurnoAfectado[] | null
  >(null)
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['bloqueos'] })
    void queryClient.invalidateQueries({ queryKey: ['agenda'] })
  }

  const verbo = editando ? 'guardar los cambios' : 'crear el bloqueo'

  const mutation = useMutation({
    mutationFn: (confirmarCancelaciones: boolean) => {
      const datos = {
        fechaInicio,
        fechaFin,
        horaInicio: todoElDia ? undefined : horaInicio,
        horaFin: todoElDia ? undefined : horaFin,
        motivo: motivo.trim() || undefined,
        confirmarCancelaciones,
      }
      return bloqueo
        ? actualizarBloqueo(bloqueo.id, datos)
        : crearBloqueo(datos)
    },
    onSuccess: () => {
      invalidar()
      onClose()
    },
    onError: (err) => {
      if (isAxiosError<ErrorBloqueoAfectaTurnos>(err)) {
        if (err.response?.data.error.codigo === 'BLOQUEO_AFECTA_TURNOS') {
          setTurnosAfectados(err.response.data.turnosAfectados)
          return
        }
        setError(
          err.response?.data.error.mensaje ?? `No pudimos ${verbo}. Probá de nuevo.`,
        )
        return
      }
      setError(`No pudimos ${verbo}. Probá de nuevo.`)
    },
  })

  const borrarMutation = useMutation({
    mutationFn: () => eliminarBloqueo(bloqueo!.id),
    onSuccess: () => {
      invalidar()
      onClose()
    },
    onError: () => setError('No pudimos borrar el bloqueo. Probá de nuevo.'),
  })

  return (
    <Modal
      titulo={editando ? 'Editar bloqueo' : 'Bloquear horario'}
      onClose={onClose}
    >
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
                ? 'Guardando…'
                : `Confirmar (cancela ${turnosAfectados.length})`}
            </Button>
          ) : (
            <Button
              variant="primaryVino"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              {mutation.isPending
                ? 'Guardando…'
                : editando
                  ? 'Guardar cambios'
                  : 'Bloquear'}
            </Button>
          )}
        </div>

        {/* Borrar va abajo y separado, no al lado de "Guardar": levantar el bloqueo es la
            acción destructiva y no tiene que estar pegada a la que Ariel viene a hacer.
            Mismo criterio que "Cancelar turno" en `ModalTurno`, con la misma confirmación
            en dos pasos — un toque de más contra un bloqueo borrado sin querer. */}
        {editando && (
          <div className="border-borde border-t pt-4">
            {confirmandoBorrar ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-tinta-suave flex-1">
                  ¿Levantar este bloqueo? Los turnos que ya canceló no vuelven.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmandoBorrar(false)}
                >
                  No
                </Button>
                <Button
                  variant="danger"
                  disabled={borrarMutation.isPending}
                  onClick={() => borrarMutation.mutate()}
                >
                  {borrarMutation.isPending ? 'Borrando…' : 'Sí, levantar'}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmandoBorrar(true)}>
                Borrar bloqueo
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
