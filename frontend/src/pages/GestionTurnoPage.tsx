import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { BotonVolver } from '../components/ui/BotonVolver'
import { Kicker } from '../components/ui/Kicker'
import { BTN_OUTLINE } from '../components/ui/estilosBoton'
import { GrillaHorarios } from '../components/GrillaHorarios'
import {
  obtenerTurno,
  cancelarTurno,
  reprogramarTurno,
  urlCalendario,
} from '../api/turnos'
import { obtenerDisponibilidad } from '../api/disponibilidad'
import { hoyIso, sumarDias, fechaLegible } from '../utils/fecha'
import type { ErrorApi, EstadoTurno } from '../types/api'

const DIAS_A_MOSTRAR = 14

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

type Modo = 'ver' | 'reprogramar'

// El padre (App.tsx) monta esta página con `key={id}` — así React la remonta entera
// cuando `id` cambia (ej. después de reprogramar), en vez de reusar la instancia vieja
// con estado local (modo, fechaNueva, etc.) pegado del turno anterior.
export function GestionTurnoPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [modo, setModo] = useState<Modo>('ver')
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false)
  const [fechaNueva, setFechaNueva] = useState<string | null>(null)
  const [horaNueva, setHoraNueva] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const turnoQuery = useQuery({
    queryKey: ['turno', id],
    queryFn: () => obtenerTurno(id),
    retry: false,
  })

  const desde = hoyIso()
  const hasta = sumarDias(desde, DIAS_A_MOSTRAR - 1)
  const servicioId = turnoQuery.data?.servicio.id

  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad', servicioId, desde, hasta],
    queryFn: () => obtenerDisponibilidad(servicioId!, desde, hasta),
    enabled: modo === 'reprogramar' && Boolean(servicioId),
  })

  const cancelarMutation = useMutation({
    mutationFn: () => cancelarTurno(id),
    onSuccess: (turno) => {
      queryClient.setQueryData(['turno', id], turno)
      setConfirmandoCancelacion(false)
    },
    onError: () => {
      setErrorAccion('No pudimos cancelar el turno. Probá de nuevo.')
      setConfirmandoCancelacion(false)
    },
  })

  const reprogramarMutation = useMutation({
    mutationFn: () =>
      reprogramarTurno(id, { fecha: fechaNueva!, hora: horaNueva! }),
    onSuccess: (nuevoTurno) => {
      navigate(`/turno/${nuevoTurno.id}`)
    },
    onError: (err) => {
      const codigo = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.codigo
        : null

      if (codigo === 'HORARIO_NO_DISPONIBLE') {
        setErrorAccion('Ese horario se acaba de ocupar. Elegí otro.')
        setHoraNueva(null)
        void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
        return
      }
      if (codigo === 'FUERA_DE_VENTANA_CANCELACION') {
        setErrorAccion(
          'Ya no podés reprogramar online. Contactá directamente a Ariel.',
        )
        setModo('ver')
        void queryClient.invalidateQueries({ queryKey: ['turno', id] })
        return
      }
      setErrorAccion('No pudimos reprogramar el turno. Probá de nuevo.')
    },
  })

  if (turnoQuery.isPending) {
    return (
      <PaginaCentrada>
        <p className="text-tinta-suave text-center">Cargando…</p>
      </PaginaCentrada>
    )
  }

  if (turnoQuery.isError) {
    return (
      <PaginaCentrada>
        <p className="text-vino text-center">No encontramos ese turno.</p>
      </PaginaCentrada>
    )
  }

  const turno = turnoQuery.data

  if (modo === 'reprogramar') {
    return (
      <PaginaCentrada>
        <BotonVolver
          onClick={() => {
            setModo('ver')
            setErrorAccion(null)
          }}
        />
        <Kicker>Reprogramar turno</Kicker>
        <h1 className="font-hero text-tinta text-[clamp(26px,4vw,36px)] leading-[1.15] font-extrabold">
          Elegí nuevo día y horario
        </h1>
        <p className="text-tinta-suave mb-4 text-sm">
          {turno.servicio.nombre} · {turno.servicio.duracionMinutos} min
        </p>

        {errorAccion && (
          <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
            {errorAccion}
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
            fecha={fechaNueva}
            hora={horaNueva}
            onElegirFecha={(f) => {
              setFechaNueva(f)
              setHoraNueva(null)
            }}
            onElegirHora={setHoraNueva}
          />
        )}

        <Button
          className="mt-4 w-full"
          disabled={!fechaNueva || !horaNueva || reprogramarMutation.isPending}
          onClick={() => reprogramarMutation.mutate()}
        >
          {reprogramarMutation.isPending
            ? 'Reprogramando…'
            : 'Confirmar nuevo horario'}
        </Button>
      </PaginaCentrada>
    )
  }

  return (
    <PaginaCentrada>
      <Kicker>Tu turno</Kicker>
      <h1 className="font-hero text-tinta mb-4 text-[clamp(26px,4vw,36px)] leading-[1.15] font-extrabold">
        {turno.servicio.nombre}
      </h1>

      <Card className="mb-4">
        <p className="text-tinta-tenue text-xs tracking-wide uppercase">
          Estado
        </p>
        <p className="mt-1">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${ESTILO_ESTADO[turno.estado]}`}
          >
            {ETIQUETA_ESTADO[turno.estado]}
          </span>
        </p>
      </Card>

      <Card className="mb-4">
        <p className="text-tinta-tenue text-xs tracking-wide uppercase">
          {turno.servicio.nombre}
        </p>
        <p className="text-tinta mt-1 text-sm">
          {fechaLegible(turno.fecha)} · {turno.hora}
        </p>
      </Card>

      {errorAccion && (
        <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
          {errorAccion}
        </div>
      )}

      {turno.estado === 'reservado' && (
        <a
          href={urlCalendario(turno.id)}
          className={`${BTN_OUTLINE} mb-4 w-full`}
        >
          Agregar a mi calendario
        </a>
      )}

      {turno.estado === 'reservado' &&
        turno.puedeCancelar &&
        !confirmandoCancelacion && (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setModo('reprogramar')}
            >
              Reprogramar
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setConfirmandoCancelacion(true)}
            >
              Cancelar turno
            </Button>
          </div>
        )}

      {turno.estado === 'reservado' &&
        turno.puedeCancelar &&
        confirmandoCancelacion && (
          <div className="flex flex-col gap-2">
            <p className="text-tinta text-center text-sm">
              ¿Seguro que querés cancelar este turno?
            </p>
            <Button
              variant="danger"
              className="w-full"
              disabled={cancelarMutation.isPending}
              onClick={() => cancelarMutation.mutate()}
            >
              {cancelarMutation.isPending ? 'Cancelando…' : 'Sí, cancelar'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setConfirmandoCancelacion(false)}
            >
              No, volver
            </Button>
          </div>
        )}

      {turno.estado === 'reservado' && !turno.puedeCancelar && (
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full" disabled>
            Reprogramar
          </Button>
          <Button variant="outline" className="w-full" disabled>
            Cancelar turno
          </Button>
          <div className="border-alerta bg-alerta-suave text-alerta mt-2 rounded-md border px-3 py-2 text-sm">
            Ya no podés cancelar online. Contactá directamente a Ariel.
          </div>
        </div>
      )}

      {turno.estado === 'cancelado' && (
        <div className="flex flex-col gap-2">
          <p className="text-tinta-suave text-center text-sm">
            Liberamos tu horario. Si te arrepentís, podés reservar de nuevo
            cuando quieras.
          </p>
          <Link to="/">
            <Button className="w-full">Reservar de nuevo</Button>
          </Link>
        </div>
      )}
    </PaginaCentrada>
  )
}

function PaginaCentrada({ children }: { children: ReactNode }) {
  return (
    <main className="bg-fondo min-h-screen">
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="text-tinta-suave mb-6 text-center text-xs font-medium tracking-wide uppercase">
          La Peluquería de Ariel Enrique
        </p>
        {children}
      </div>
    </main>
  )
}
