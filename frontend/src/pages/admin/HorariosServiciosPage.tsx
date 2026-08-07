import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kicker } from '../../components/ui/Kicker'
import { InputHora } from '../../components/ui/InputHora'
import {
  obtenerHorarioLaboral,
  guardarHorarioLaboral,
} from '../../api/horarioLaboral'
import {
  obtenerFeriados,
  actualizarFeriado,
  sincronizarFeriados,
} from '../../api/feriados'
import { FilaServicio } from '../../components/admin/FilaServicio'
import { ModalServicio } from '../../components/admin/ModalServicio'
import {
  actualizarServicio,
  obtenerServiciosAdmin,
} from '../../api/servicios'
import { diaSemana, fechaLegible } from '../../utils/fecha'
import type {
  ErrorApi,
  Feriado,
  FranjaHorario,
  ModalidadFeriado,
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
                  <InputHora
                    compacto
                    value={f.horaInicio}
                    onChange={(valor) =>
                      actualizarFranja(f.indice, 'horaInicio', valor)
                    }
                    etiqueta={`apertura del ${nombreDia.toLowerCase()}`}
                  />
                  <span className="text-tinta-tenue">a</span>
                  <InputHora
                    compacto
                    value={f.horaFin}
                    onChange={(valor) =>
                      actualizarFranja(f.indice, 'horaFin', valor)
                    }
                    etiqueta={`cierre del ${nombreDia.toLowerCase()}`}
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

// HU-24 — Las tres cosas que Ariel puede hacer en un feriado. El orden va de menos a más
// trabajo, que es como lo piensa: cierro, abro medio día, abro todo el día.
const MODALIDADES: { valor: ModalidadFeriado; etiqueta: string }[] = [
  { valor: 'cerrado', etiqueta: 'No atiendo' },
  { valor: 'medio_dia', etiqueta: 'Medio día' },
  { valor: 'dia_completo', etiqueta: 'Día completo' },
]

function SeccionFeriados() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['feriados'],
    queryFn: () => obtenerFeriados(),
  })

  // Para saber qué feriados le cambian algo a Ariel hace falta saber qué días trabaja.
  // Mismo `staleTime` largo que en la agenda: esto cambia una vez cada muchos meses.
  const horarioQuery = useQuery({
    queryKey: ['horario-laboral'],
    queryFn: obtenerHorarioLaboral,
    staleTime: 60 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: ({
      id,
      modalidad,
    }: {
      id: number
      modalidad: ModalidadFeriado
    }) => actualizarFeriado(id, modalidad),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feriados'] })
      void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
    },
  })

  const sincronizarMutation = useMutation({
    mutationFn: () => sincronizarFeriados(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feriados'] })
      void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
    },
  })

  const botonActualizar = (
    <Button
      variant="outline"
      disabled={sincronizarMutation.isPending}
      onClick={() => sincronizarMutation.mutate()}
    >
      {sincronizarMutation.isPending ? 'Buscando…' : 'Actualizar feriados'}
    </Button>
  )

  if (query.isPending || horarioQuery.isPending) {
    return <p className="text-tinta-suave">Cargando…</p>
  }
  if (query.isError || horarioQuery.isError) {
    return <p className="text-vino">No pudimos cargar los feriados.</p>
  }

  // Los feriados que caen en días que Ariel no trabaja no cambian nada —esos días ya
  // están cerrados— así que no se muestran: son 6 de los 16 del año, y pedirle una
  // decisión sobre ellos es pedirle que decida sobre nada.
  const diasLaborales = new Set(horarioQuery.data.map((f) => f.diaSemana))
  const feriados = query.data.filter((f: Feriado) =>
    diasLaborales.has(diaSemana(f.fecha)),
  )

  // Se cargan dos años (el actual y el siguiente, porque en diciembre ya se reserva para
  // enero) y `fechaLegible` no incluye el año: sin agrupar, quedan dos "1 de enero"
  // idénticos y no hay forma de saber cuál es cuál.
  const porAnio = feriados.reduce<Record<string, Feriado[]>>((acc, f) => {
    const anio = f.fecha.slice(0, 4)
    ;(acc[anio] ??= []).push(f)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-tinta-suave text-sm">
          En los feriados atendés <strong>medio día</strong> salvo que digas otra
          cosa. Solo aparecen los que caen en días que trabajás.
        </p>
        {botonActualizar}
      </div>

      {sincronizarMutation.isError && (
        <p className="text-vino text-sm">
          No pudimos consultar el calendario de feriados. Probá de nuevo en un
          rato.
        </p>
      )}

      {feriados.length === 0 ? (
        <p className="text-tinta-suave">
          No hay feriados cargados en los días que trabajás.
        </p>
      ) : (
        Object.entries(porAnio).map(([anio, delAnio]) => (
          <div key={anio} className="flex flex-col gap-2">
            <p className="text-tinta-tenue mt-2 text-xs font-semibold tracking-wide uppercase">
              {anio}
            </p>
            {delAnio.map((f) => (
              <Card
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-tinta font-medium">{f.nombre}</p>
                  <p className="text-tinta-suave text-sm">
                    {fechaLegible(f.fecha)}
                  </p>
                </div>
                {/* Mismo pill que la agenda y "Apariencia": tres opciones a la vista
                    es más claro que un botón que va rotando entre estados. */}
                <div className="border-borde flex rounded-md border p-1">
                  {MODALIDADES.map((m) => (
                    <button
                      key={m.valor}
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({ id: f.id, modalidad: m.valor })
                      }
                      className={`rounded px-3 py-1 text-sm font-medium transition ${
                        f.modalidad === m.valor
                          ? 'bg-miel-suave text-miel'
                          : 'text-tinta-suave hover:text-tinta'
                      }`}
                    >
                      {m.etiqueta}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ))
      )}
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
