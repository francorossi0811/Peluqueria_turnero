import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kicker } from '../../components/ui/Kicker'
import {
  obtenerHorarioLaboral,
  guardarHorarioLaboral,
} from '../../api/horarioLaboral'
import { obtenerFeriados, actualizarFeriado } from '../../api/feriados'
import { FilaServicio } from '../../components/admin/FilaServicio'
import { ModalServicio } from '../../components/admin/ModalServicio'
import {
  actualizarServicio,
  obtenerServiciosAdmin,
} from '../../api/servicios'
import { fechaLegible } from '../../utils/fecha'
import type {
  ErrorApi,
  Feriado,
  FranjaHorario,
  ServicioAdmin,
} from '../../types/api'

const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

// Las tres secciones de acá son lo mismo desde el punto de vista de Ariel: definen
// *cuándo* atiende y *qué* ofrece. Ninguna se toca seguido — se configuran una vez y se
// ajustan cada tanto — así que no justificaban una entrada cada una en el nav.
export function HorariosServiciosPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <Kicker>Panel de Ariel</Kicker>
        <h1 className="font-hero text-tinta mb-1 text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
          Horarios y servicios
        </h1>
        <p className="text-tinta-suave text-sm">
          Todo lo de esta pantalla cambia los horarios que ven los clientes al
          reservar.
        </p>
      </div>

      <div>
        <h2 className="font-display text-tinta mb-4 text-xl font-semibold">
          Horario laboral
        </h2>
        <SeccionHorarioLaboral />
      </div>

      <div>
        <h2 className="font-display text-tinta mb-4 text-xl font-semibold">
          Feriados
        </h2>
        <SeccionFeriados />
      </div>

      <SeccionServicios />
    </div>
  )
}

function SeccionHorarioLaboral() {
  const queryClient = useQueryClient()
  const [franjas, setFranjas] = useState<FranjaHorario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const query = useQuery({
    queryKey: ['horario-laboral'],
    queryFn: obtenerHorarioLaboral,
  })

  useEffect(() => {
    if (query.data && franjas === null) {
      setFranjas(query.data)
    }
  }, [query.data, franjas])

  const mutation = useMutation({
    mutationFn: () => guardarHorarioLaboral(franjas!),
    onSuccess: (data) => {
      setFranjas(data)
      void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null
      setError(mensaje ?? 'No pudimos guardar el horario. Probá de nuevo.')
    },
  })

  function actualizarFranja(
    index: number,
    campo: 'horaInicio' | 'horaFin',
    valor: string,
  ) {
    setFranjas((prev) =>
      prev!.map((f, i) => (i === index ? { ...f, [campo]: valor } : f)),
    )
  }

  function eliminarFranja(index: number) {
    setFranjas((prev) => prev!.filter((_, i) => i !== index))
  }

  function agregarFranja(diaSemana: number) {
    setFranjas((prev) => [
      ...(prev ?? []),
      { diaSemana, horaInicio: '09:00', horaFin: '13:00' },
    ])
  }

  if (query.isPending || franjas === null) {
    return <p className="text-tinta-suave">Cargando horario…</p>
  }
  if (query.isError) {
    return <p className="text-vino">No pudimos cargar el horario laboral.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {DIAS.map((nombreDia, dia) => {
        const franjasConIndice = franjas
          .map((f, i) => ({ ...f, indice: i }))
          .filter((f) => f.diaSemana === dia)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))

        return (
          <Card key={dia}>
            <div className="flex items-center justify-between">
              <p className="text-tinta font-medium">{nombreDia}</p>
              <Button variant="ghost" onClick={() => agregarFranja(dia)}>
                + Franja
              </Button>
            </div>
            {franjasConIndice.length === 0 && (
              <p className="text-tinta-tenue mt-2 text-sm">Cerrado</p>
            )}
            <div className="mt-2 flex flex-col gap-2">
              {franjasConIndice.map((f) => (
                <div
                  key={f.indice}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="time"
                    value={f.horaInicio}
                    onChange={(e) =>
                      actualizarFranja(f.indice, 'horaInicio', e.target.value)
                    }
                    className="border-borde bg-superficie text-tinta focus:border-miel min-w-0 rounded-md border px-2 py-1 text-sm outline-none"
                  />
                  <span className="text-tinta-tenue">a</span>
                  <input
                    type="time"
                    value={f.horaFin}
                    onChange={(e) =>
                      actualizarFranja(f.indice, 'horaFin', e.target.value)
                    }
                    className="border-borde bg-superficie text-tinta focus:border-miel min-w-0 rounded-md border px-2 py-1 text-sm outline-none"
                  />
                  <button
                    onClick={() => eliminarFranja(f.indice)}
                    className="text-vino text-sm hover:opacity-80"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      {error && (
        <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="primaryVino"
          disabled={mutation.isPending}
          onClick={() => {
            setError(null)
            mutation.mutate()
          }}
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {guardado && <span className="text-bien text-sm">Guardado ✓</span>}
      </div>
    </div>
  )
}

function SeccionFeriados() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['feriados'],
    queryFn: () => obtenerFeriados(),
  })

  const mutation = useMutation({
    mutationFn: ({ id, bloquea }: { id: number; bloquea: boolean }) =>
      actualizarFeriado(id, bloquea),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feriados'] })
      void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
    },
  })

  if (query.isPending) return <p className="text-tinta-suave">Cargando…</p>
  if (query.isError) {
    return <p className="text-vino">No pudimos cargar los feriados.</p>
  }
  if (query.data.length === 0) {
    return <p className="text-tinta-suave">No hay feriados cargados.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {query.data.map((f: Feriado) => (
        <Card
          key={f.id}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p className="text-tinta font-medium">{f.nombre}</p>
            <p className="text-tinta-suave text-sm">{fechaLegible(f.fecha)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
                f.bloquea
                  ? 'bg-alerta-suave text-alerta'
                  : 'bg-bien-suave text-bien'
              }`}
            >
              {f.bloquea ? 'No atiende' : 'Atiende igual'}
            </span>
            <Button
              variant="outline"
              disabled={mutation.isPending && mutation.variables?.id === f.id}
              onClick={() => mutation.mutate({ id: f.id, bloquea: !f.bloquea })}
            >
              {f.bloquea ? 'Atender igual' : 'Volver a bloquear'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function SeccionServicios() {
  const queryClient = useQueryClient()
  const [modalNuevo, setModalNuevo] = useState(false)
  const [servicioEditar, setServicioEditar] = useState<ServicioAdmin | null>(
    null,
  )

  const serviciosQuery = useQuery({
    queryKey: ['servicios-admin'],
    queryFn: obtenerServiciosAdmin,
  })

  const cambiarActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      actualizarServicio(id, { activo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['servicios-admin'] })
    },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-tinta text-xl font-semibold">
          Servicios
        </h2>
        <Button variant="primaryVino" onClick={() => setModalNuevo(true)}>
          + Nuevo servicio
        </Button>
      </div>

      {serviciosQuery.isPending && (
        <p className="text-tinta-suave">Cargando servicios…</p>
      )}
      {serviciosQuery.isError && (
        <p className="text-vino">No pudimos cargar los servicios.</p>
      )}

      {serviciosQuery.data && (
        <div className="flex flex-col gap-2">
          {serviciosQuery.data.map((s) => (
            <FilaServicio
              key={s.id}
              servicio={s}
              onEditar={() => setServicioEditar(s)}
              onCambiarActivo={() =>
                cambiarActivoMutation.mutate({ id: s.id, activo: !s.activo })
              }
              cambiando={
                cambiarActivoMutation.isPending &&
                cambiarActivoMutation.variables?.id === s.id
              }
            />
          ))}
        </div>
      )}

      {modalNuevo && <ModalServicio onClose={() => setModalNuevo(false)} />}
      {servicioEditar && (
        <ModalServicio
          servicio={servicioEditar}
          onClose={() => setServicioEditar(null)}
        />
      )}
    </div>
  )
}
