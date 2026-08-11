import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Kicker } from '../../components/ui/Kicker'
import { FilaTurno } from '../../components/admin/FilaTurno'
import { FilaBloqueo } from '../../components/admin/FilaBloqueo'
import { ModalEditarTurno } from '../../components/admin/ModalEditarTurno'
import { ModalTurno } from '../../components/admin/ModalTurno'
import { ModalCobro } from '../../components/admin/ModalCobro'
import { ModalCargarTurno } from '../../components/admin/ModalCargarTurno'
import { ModalBloquear } from '../../components/admin/ModalBloquear'
import { ModalBuscarTurno } from '../../components/admin/ModalBuscarTurno'
import { GrillaSemana } from '../../components/admin/GrillaSemana'
import {
  cancelarTurnoAdmin,
  marcarEstadoTurno,
  marcarTurnosVistos,
  obtenerAgenda,
} from '../../api/agenda'
import { eliminarBloqueo, obtenerBloqueos } from '../../api/bloqueos'
import { obtenerHorarioLaboral } from '../../api/horarioLaboral'
import { obtenerFeriados } from '../../api/feriados'
import { useAvisosPendientes } from '../../lib/useAvisosPendientes'
import { useMinutosAhora } from '../../lib/useMinutosAhora'
import {
  hoyIso,
  sumarDias,
  fechaLegible,
  domingoDeLaSemana,
  turnoEnCurso,
} from '../../utils/fecha'
import type { TurnoAdmin } from '../../types/api'

type Vista = 'dia' | 'semana'

function diasEnRango(desde: string, hasta: string): string[] {
  const dias: string[] = []
  let actual = desde
  while (actual <= hasta) {
    dias.push(actual)
    actual = sumarDias(actual, 1)
  }
  return dias
}

/** El rango de la vista "Semana": del primer al último día que Ariel efectivamente
 * trabaja, dentro de la semana calendario donde esté parado.
 *
 * Hoy eso da martes a sábado, pero **no está escrito en ningún lado del código**: sale
 * de qué días tienen franjas cargadas en "Horarios y servicios". Si Ariel mañana abre
 * los lunes, la agenda lo sigue sola, sin tocar nada acá.
 *
 * Antes la semana eran 7 días corridos desde donde estuviera parado: parado un jueves
 * veía jueves→miércoles, y siempre le entraban dos días en los que no trabaja. */
function rangoDeLaSemana(
  fecha: string,
  diasLaborales: number[],
): { desde: string; hasta: string } {
  // Sin horario cargado no hay de dónde deducir la semana laboral: se cae a los 7 días
  // corridos de siempre en vez de mostrar un rango vacío.
  if (diasLaborales.length === 0) {
    return { desde: fecha, hasta: sumarDias(fecha, 6) }
  }

  const domingo = domingoDeLaSemana(fecha)
  return {
    desde: sumarDias(domingo, Math.min(...diasLaborales)),
    hasta: sumarDias(domingo, Math.max(...diasLaborales)),
  }
}

export function AgendaPage() {
  const queryClient = useQueryClient()
  const [vista, setVista] = useState<Vista>('dia')
  const [fecha, setFecha] = useState(hoyIso())
  const [modalCargar, setModalCargar] = useState(false)
  const [modalBloquear, setModalBloquear] = useState(false)
  const [modalBuscar, setModalBuscar] = useState(false)
  const [turnoEditar, setTurnoEditar] = useState<TurnoAdmin | null>(null)
  // HU-25 — El turno abierto desde la grilla. Es un estado aparte del de reprogramar
  // porque son dos pasos encadenados: primero se ve quién es, y recién si hace falta se
  // pasa a mover el horario.
  const [turnoDetalle, setTurnoDetalle] = useState<TurnoAdmin | null>(null)
  // HU-27 — El turno que se está cobrando. Se abre al tocar "Realizado" (y ahí el modal
  // hace las dos cosas de una) o desde el detalle, para completarle el cobro a uno que ya
  // se marcó sin registrarlo.
  const [turnoCobrar, setTurnoCobrar] = useState<TurnoAdmin | null>(null)
  const [huecoElegido, setHuecoElegido] = useState<{
    fecha: string
    hora: string
  } | null>(null)

  // Qué días trabaja Ariel, según lo que tenga cargado en "Horarios y servicios".
  // `staleTime` alto porque esto cambia una vez cada muchos meses, y la agenda se
  // refresca cada 30 segundos: sin esto, cada refresco arrastraría también esta query.
  const horarioQuery = useQuery({
    queryKey: ['horario-laboral'],
    queryFn: obtenerHorarioLaboral,
    staleTime: 60 * 60 * 1000,
  })
  const diasLaborales = [
    ...new Set((horarioQuery.data ?? []).map((f) => f.diaSemana)),
  ]

  const { desde, hasta } =
    vista === 'semana'
      ? rangoDeLaSemana(fecha, diasLaborales)
      : { desde: fecha, hasta: fecha }

  const agendaQuery = useQuery({
    queryKey: ['agenda', desde, hasta],
    queryFn: () => obtenerAgenda(desde, hasta),
    // HU-17 — Con el panel abierto, los turnos nuevos aparecen solos. Va acá y no como
    // default del QueryClient a propósito: si no, el wizard público también estaría
    // pidiendo disponibilidad cada 30 segundos y quemando el plan gratuito de Render.
    // `refetchIntervalInBackground` queda en false (default): una pestaña de fondo deja
    // de pedir, y de paso no mantiene la sesión viva sola para siempre.
    // Con la pestaña visible, cada 30 s. Oculta, cada 3 minutos en vez de nada: el
    // contador del título y el badge sirven justamente cuando Ariel no está mirando esta
    // pestaña, así que dejar de pedir del todo los volvía inútiles. Son ~20 requests por
    // hora de fondo, irrelevante para el plan gratuito de Render.
    //
    // Efecto que vale nombrar: un panel abierto renueva su sesión para siempre. Es la
    // sesión deslizante que ya decidimos en la v2, no un accidente.
    refetchInterval: () => (document.hidden ? 180_000 : 30_000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  })

  const marcarVistosMutation = useMutation({
    mutationFn: marcarTurnosVistos,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })

  const bloqueosQuery = useQuery({
    queryKey: ['bloqueos', desde, hasta],
    queryFn: () => obtenerBloqueos(desde, hasta),
  })

  // Los feriados de la semana, para que la grilla no ofrezca como libre la tarde de un
  // feriado de medio día. Mismo `staleTime` largo que el horario laboral: cambian una vez
  // al año, y la agenda se refresca cada 30 segundos.
  const feriadosQuery = useQuery({
    queryKey: ['feriados'],
    queryFn: () => obtenerFeriados(),
    staleTime: 60 * 60 * 1000,
  })

  const cancelarMutation = useMutation({
    mutationFn: (id: string) => cancelarTurnoAdmin(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })

  const marcarMutation = useMutation({
    mutationFn: ({
      id,
      estado,
    }: {
      id: string
      estado: 'realizado' | 'ausente'
    }) => marcarEstadoTurno(id, estado),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })

  const levantarBloqueoMutation = useMutation({
    mutationFn: (id: string) => eliminarBloqueo(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bloqueos'] })
    },
  })

  function navegar(direccion: -1 | 1) {
    const salto = vista === 'semana' ? 7 : 1
    setFecha((f) => sumarDias(f, direccion * salto))
  }

  const dias = diasEnRango(desde, hasta)
  const turnos = agendaQuery.data?.turnos ?? []
  const franjas = horarioQuery.data ?? []

  // La línea de "ahora" de la grilla, que baja sola. Sí justifica un timer propio: el
  // refetch de la agenda es cada 30 segundos con la pestaña visible, pero cada 3 minutos
  // con la pestaña oculta — y volver a la pestaña y ver la línea atrasada es exactamente
  // el momento en que se la mira.
  const minutosAhora = useMinutosAhora()
  // El turno abierto, releído de la agenda en cada render en vez de usar la copia que se
  // guardó al abrirlo. Importa: cuando Ariel le carga el teléfono desde el modal, la
  // agenda se invalida y vuelve con la ficha puesta — con la copia vieja el modal seguiría
  // ofreciéndole cargar un teléfono que ya cargó. Si el turno desapareció del rango (lo
  // canceló), se cae a la copia para no vaciar el modal debajo de sus manos.
  const turnoAbierto = turnoDetalle
    ? (turnos.find((t) => t.id === turnoDetalle.id) ?? turnoDetalle)
    : null

  const sinVer = turnos.filter((t) => !t.vistoPorAdmin)
  const nuevosMasAdelante = agendaQuery.data?.nuevosMasAdelante ?? 0
  const idsMasAdelante = agendaQuery.data?.idsMasAdelante ?? []

  // Pestaña, favicon e ícono de la app. Se suman los de más adelante: para Ariel "tengo
  // 3 turnos nuevos" es uno solo aunque estén en semanas distintas.
  useAvisosPendientes(sinVer.length + nuevosMasAdelante)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Panel de Ariel</Kicker>
          <h1 className="font-hero text-tinta text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
            Agenda
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModalBuscar(true)}>
            Buscar turno
          </Button>
          <Button variant="outline" onClick={() => setModalBloquear(true)}>
            Bloquear horario
          </Button>
          <Button variant="primaryVino" onClick={() => setModalCargar(true)}>
            + Cargar turno
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navegar(-1)}>
            ‹
          </Button>
          <p className="text-tinta min-w-[10rem] text-center text-sm font-medium">
            {vista === 'dia'
              ? fechaLegible(fecha)
              : `${fechaLegible(desde)} – ${fechaLegible(hasta)}`}
          </p>
          <Button variant="outline" onClick={() => navegar(1)}>
            ›
          </Button>
          <Button variant="ghost" onClick={() => setFecha(hoyIso())}>
            Hoy
          </Button>
        </div>

        <div className="border-borde flex rounded-md border p-1">
          {(['dia', 'semana'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                vista === v
                  ? 'bg-miel-suave text-miel'
                  : 'text-tinta-suave hover:text-tinta'
              }`}
            >
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {sinVer.length > 0 && (
        <div className="border-miel bg-destacado mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <p className="text-tinta text-sm font-medium">
            {sinVer.length === 1
              ? 'Tenés 1 turno nuevo sin ver.'
              : `Tenés ${sinVer.length} turnos nuevos sin ver.`}
          </p>
          <Button
            variant="outline"
            disabled={marcarVistosMutation.isPending}
            onClick={() => marcarVistosMutation.mutate(sinVer.map((t) => t.id))}
          >
            {marcarVistosMutation.isPending
              ? 'Marcando…'
              : 'Marcar como vistos'}
          </Button>
        </div>
      )}

      {/* HU-17 — Turnos nuevos que entraron para más adelante. Sin esto, un turno que
          cae dentro de tres días queda invisible hasta que Ariel navega hasta ahí. */}
      {nuevosMasAdelante > 0 && (
        <div className="border-borde bg-superficie-2 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <p className="text-tinta text-sm">
            {nuevosMasAdelante === 1
              ? 'Además tenés 1 turno nuevo '
              : `Además tenés ${nuevosMasAdelante} turnos nuevos `}
            {vista === 'dia' ? 'esta semana' : 'la semana que viene'}, fuera de
            lo que estás viendo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (vista === 'dia') setVista('semana')
                else setFecha((f) => sumarDias(f, 7))
              }}
            >
              {vista === 'dia' ? 'Ver la semana' : 'Ir a esa semana'}
            </Button>
            {/* Marcarlos desde acá, sin navegar. Antes había que ir hasta esa semana solo
                para apagar el aviso, que es trabajo que no le aporta nada a Ariel. */}
            <Button
              variant="outline"
              disabled={marcarVistosMutation.isPending}
              onClick={() => marcarVistosMutation.mutate(idsMasAdelante)}
            >
              {marcarVistosMutation.isPending
                ? 'Marcando…'
                : 'Marcar como vistos'}
            </Button>
          </div>
        </div>
      )}

      {(agendaQuery.isPending || bloqueosQuery.isPending) && (
        <p className="text-tinta-suave">Cargando agenda…</p>
      )}
      {(agendaQuery.isError || bloqueosQuery.isError) && (
        <p className="text-vino">No pudimos cargar la agenda.</p>
      )}

      {/* HU-23 — La semana va en grilla, que es como Ariel viene leyendo su agenda: los
          huecos a la vista y la semana entera de un golpe. La vista Día sigue siendo la
          lista, que es la que sirve en el celular y con la que opera el día a día. */}
      {agendaQuery.data && bloqueosQuery.data && vista === 'semana' && (
        <GrillaSemana
          dias={dias}
          turnos={turnos}
          bloqueos={bloqueosQuery.data}
          franjas={franjas}
          feriados={feriadosQuery.data ?? []}
          hoy={hoyIso()}
          minutosAhora={minutosAhora}
          onElegirHueco={(f, h) => setHuecoElegido({ fecha: f, hora: h })}
          onElegirTurno={setTurnoDetalle}
        />
      )}

      {agendaQuery.data && bloqueosQuery.data && vista === 'dia' && (
        <div className="flex flex-col gap-6">
          {dias.map((dia) => {
            // Los que ya se resolvieron (realizado / ausente) caen al fondo: lo que le
            // sirve a Ariel de un vistazo es qué le queda por atender, no lo que ya pasó.
            // Dentro de cada grupo, por hora.
            const turnosDelDia = turnos
              .filter((t) => t.fecha === dia)
              .sort((a, b) => {
                const resuelto = (t: TurnoAdmin) =>
                  t.estado === 'realizado' || t.estado === 'ausente' ? 1 : 0
                return (
                  resuelto(a) - resuelto(b) || a.hora.localeCompare(b.hora)
                )
              })
            const bloqueosDelDia = bloqueosQuery.data.filter(
              (b) => b.fechaInicio <= dia && b.fechaFin >= dia,
            )

            return (
              <div key={dia}>
                {turnosDelDia.length === 0 && bloqueosDelDia.length === 0 && (
                  <p className="text-tinta-suave text-sm">Sin turnos.</p>
                )}
                <div className="flex flex-col gap-2">
                  {bloqueosDelDia.map((b) => (
                    <FilaBloqueo
                      key={b.id}
                      bloqueo={b}
                      levantando={
                        levantarBloqueoMutation.isPending &&
                        levantarBloqueoMutation.variables === b.id
                      }
                      onLevantar={() => levantarBloqueoMutation.mutate(b.id)}
                    />
                  ))}
                  {turnosDelDia.map((t) => (
                    <FilaTurno
                      key={t.id}
                      turno={t}
                      enCurso={turnoEnCurso(t, dia, hoyIso(), minutosAhora)}
                      onEditar={() => setTurnoEditar(t)}
                      onCancelar={() => cancelarMutation.mutate(t.id)}
                      // HU-27 — "Realizado" abre el cobro y desde ahí se guardan las dos
                      // cosas juntas; "Ausente" no pasa por ningún modal, porque un
                      // ausente no paga.
                      onMarcarEstado={(estado) =>
                        estado === 'realizado'
                          ? setTurnoCobrar(t)
                          : marcarMutation.mutate({ id: t.id, estado })
                      }
                      onCobrar={() => setTurnoCobrar(t)}
                      cancelando={
                        cancelarMutation.isPending &&
                        cancelarMutation.variables === t.id
                      }
                      marcando={
                        marcarMutation.isPending &&
                        marcarMutation.variables?.id === t.id
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* HU-25 — Tocar un turno en la grilla abre su detalle, no directamente el
          reprogramar: primero quién es, después qué hacer. */}
      {turnoAbierto && (
        <ModalTurno
          turno={turnoAbierto}
          onClose={() => setTurnoDetalle(null)}
          onReprogramar={() => {
            setTurnoEditar(turnoAbierto)
            setTurnoDetalle(null)
          }}
          onCobrar={() => {
            setTurnoCobrar(turnoAbierto)
            setTurnoDetalle(null)
          }}
          // Ausente cierra el detalle al marcarlo: el modal muestra las acciones de un
          // turno reservado, y dejarlo abierto sobre un turno que ya no lo es sería
          // mostrarle acciones que ya no aplican.
          onMarcarAusente={() => {
            marcarMutation.mutate({ id: turnoAbierto.id, estado: 'ausente' })
            setTurnoDetalle(null)
          }}
          marcando={
            marcarMutation.isPending &&
            marcarMutation.variables?.id === turnoAbierto.id
          }
        />
      )}
      {/* HU-27 — El cobro. Mismo modal para las dos puertas de entrada: al marcar
          Realizado y al completar un cobro pendiente. */}
      {turnoCobrar && (
        <ModalCobro
          turno={turnoCobrar}
          onClose={() => setTurnoCobrar(null)}
        />
      )}
      {turnoEditar && (
        <ModalEditarTurno
          turno={turnoEditar}
          onClose={() => setTurnoEditar(null)}
        />
      )}
      {modalCargar && (
        <ModalCargarTurno onClose={() => setModalCargar(false)} />
      )}
      {/* Mismo modal, abierto desde un hueco de la grilla: llega con el día y la hora ya
          puestos, así cargar un turno sobre un espacio libre es un solo toque. */}
      {huecoElegido && (
        <ModalCargarTurno
          fechaInicial={huecoElegido.fecha}
          horaInicial={huecoElegido.hora}
          onClose={() => setHuecoElegido(null)}
        />
      )}
      {modalBloquear && (
        <ModalBloquear
          fechaInicial={fecha}
          onClose={() => setModalBloquear(false)}
        />
      )}
      {modalBuscar && <ModalBuscarTurno onClose={() => setModalBuscar(false)} />}
    </div>
  )
}
