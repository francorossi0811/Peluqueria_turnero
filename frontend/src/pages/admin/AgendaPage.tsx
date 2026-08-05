import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Kicker } from '../../components/ui/Kicker'
import { FilaTurno } from '../../components/admin/FilaTurno'
import { FilaBloqueo } from '../../components/admin/FilaBloqueo'
import { ModalEditarTurno } from '../../components/admin/ModalEditarTurno'
import { ModalCargarTurno } from '../../components/admin/ModalCargarTurno'
import { ModalBloquear } from '../../components/admin/ModalBloquear'
import {
  cancelarTurnoAdmin,
  marcarEstadoTurno,
  marcarTurnosVistos,
  obtenerAgenda,
} from '../../api/agenda'
import { eliminarBloqueo, obtenerBloqueos } from '../../api/bloqueos'
import { hoyIso, sumarDias, fechaLegible } from '../../utils/fecha'
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

export function AgendaPage() {
  const queryClient = useQueryClient()
  const [vista, setVista] = useState<Vista>('dia')
  const [fecha, setFecha] = useState(hoyIso())
  const [modalCargar, setModalCargar] = useState(false)
  const [modalBloquear, setModalBloquear] = useState(false)
  const [turnoEditar, setTurnoEditar] = useState<TurnoAdmin | null>(null)

  const desde = fecha
  const hasta = vista === 'semana' ? sumarDias(fecha, 6) : fecha

  const agendaQuery = useQuery({
    queryKey: ['agenda', desde, hasta],
    queryFn: () => obtenerAgenda(desde, hasta),
    // HU-17 — Con el panel abierto, los turnos nuevos aparecen solos. Va acá y no como
    // default del QueryClient a propósito: si no, el wizard público también estaría
    // pidiendo disponibilidad cada 30 segundos y quemando el plan gratuito de Render.
    // `refetchIntervalInBackground` queda en false (default): una pestaña de fondo deja
    // de pedir, y de paso no mantiene la sesión viva sola para siempre.
    refetchInterval: 30_000,
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
  const sinVer = (agendaQuery.data ?? []).filter((t) => !t.vistoPorAdmin)

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
        <div className="border-miel bg-miel-suave/40 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
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

      {(agendaQuery.isPending || bloqueosQuery.isPending) && (
        <p className="text-tinta-suave">Cargando agenda…</p>
      )}
      {(agendaQuery.isError || bloqueosQuery.isError) && (
        <p className="text-vino">No pudimos cargar la agenda.</p>
      )}

      {agendaQuery.data && bloqueosQuery.data && (
        <div className="flex flex-col gap-6">
          {dias.map((dia) => {
            const turnosDelDia = agendaQuery.data
              .filter((t) => t.fecha === dia)
              .sort((a, b) => a.hora.localeCompare(b.hora))
            const bloqueosDelDia = bloqueosQuery.data.filter(
              (b) => b.fechaInicio <= dia && b.fechaFin >= dia,
            )

            if (
              vista === 'semana' &&
              turnosDelDia.length === 0 &&
              bloqueosDelDia.length === 0
            ) {
              return null
            }

            return (
              <div key={dia}>
                {vista === 'semana' && (
                  <p className="text-tinta-tenue mb-2 text-xs font-medium tracking-wide uppercase">
                    {fechaLegible(dia)}
                  </p>
                )}
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
                      onEditar={() => setTurnoEditar(t)}
                      onCancelar={() => cancelarMutation.mutate(t.id)}
                      onMarcarEstado={(estado) =>
                        marcarMutation.mutate({ id: t.id, estado })
                      }
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

      {turnoEditar && (
        <ModalEditarTurno
          turno={turnoEditar}
          onClose={() => setTurnoEditar(null)}
        />
      )}
      {modalCargar && (
        <ModalCargarTurno onClose={() => setModalCargar(false)} />
      )}
      {modalBloquear && (
        <ModalBloquear
          fechaInicial={fecha}
          onClose={() => setModalBloquear(false)}
        />
      )}
    </div>
  )
}
