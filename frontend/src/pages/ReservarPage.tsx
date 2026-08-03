import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { BotonVolver } from '../components/ui/BotonVolver'
import { GrillaHorarios } from '../components/GrillaHorarios'
import { Landing } from '../components/Landing'
import { obtenerServicios } from '../api/servicios'
import { obtenerDisponibilidad } from '../api/disponibilidad'
import { crearTurno } from '../api/turnos'
import { hoyIso, sumarDias, fechaLegible } from '../utils/fecha'
import type { DisponibilidadDia, ErrorApi, Servicio, Turno } from '../types/api'

type Paso = 'servicio' | 'horario' | 'datos' | 'confirmacion'

const DIAS_A_MOSTRAR = 14

export function ReservarPage() {
  const queryClient = useQueryClient()

  const [paso, setPaso] = useState<Paso>('servicio')
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [turnoCreado, setTurnoCreado] = useState<Turno | null>(null)
  const [errorHorario, setErrorHorario] = useState<string | null>(null)

  const desde = hoyIso()
  const hasta = sumarDias(desde, DIAS_A_MOSTRAR - 1)

  const serviciosQuery = useQuery({
    queryKey: ['servicios'],
    queryFn: obtenerServicios,
  })

  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad', servicio?.id, desde, hasta],
    queryFn: () => obtenerDisponibilidad(servicio!.id, desde, hasta),
    enabled: Boolean(servicio),
  })

  // Preselecciona el primer día con horarios, para no dejar la grilla vacía sin motivo.
  useEffect(() => {
    if (fecha || !disponibilidadQuery.data) return
    const primerDiaConHorarios = disponibilidadQuery.data.find(
      (d) => d.horarios.length > 0,
    )
    if (primerDiaConHorarios) setFecha(primerDiaConHorarios.fecha)
  }, [disponibilidadQuery.data, fecha])

  const crearTurnoMutation = useMutation({
    mutationFn: crearTurno,
    onSuccess: (turno) => {
      setTurnoCreado(turno)
      setPaso('confirmacion')
    },
    onError: (err) => {
      if (isAxiosError<ErrorApi>(err) && err.response?.status === 409) {
        setErrorHorario('Ese horario se acaba de ocupar. Elegí otro.')
        setHora(null)
        setPaso('horario')
        queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
      } else {
        setErrorHorario(
          'Hubo un problema al confirmar el turno. Probá de nuevo.',
        )
        setPaso('horario')
      }
    },
  })

  function elegirServicio(elegido: Servicio) {
    setServicio(elegido)
    setFecha(null)
    setHora(null)
    setPaso('horario')
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!servicio || !fecha || !hora) return
    crearTurnoMutation.mutate({
      servicioId: servicio.id,
      fecha,
      hora,
      clienteNombre,
      clienteTelefono,
    })
  }

  if (paso === 'servicio') {
    return <Landing query={serviciosQuery} onElegir={elegirServicio} />
  }

  return (
    <main className="bg-fondo min-h-screen">
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="text-tinta-suave mb-6 text-center text-xs font-medium tracking-wide uppercase">
          La Peluquería de Ariel Enrique
        </p>

        {paso === 'horario' && servicio && (
          <PasoHorario
            servicio={servicio}
            query={disponibilidadQuery}
            fecha={fecha}
            hora={hora}
            error={errorHorario}
            onElegirFecha={(f) => {
              setFecha(f)
              setHora(null)
            }}
            onElegirHora={setHora}
            onVolver={() => setPaso('servicio')}
            onContinuar={() => {
              setErrorHorario(null)
              setPaso('datos')
            }}
          />
        )}

        {paso === 'datos' && servicio && fecha && hora && (
          <PasoDatos
            servicio={servicio}
            fecha={fecha}
            hora={hora}
            nombre={clienteNombre}
            telefono={clienteTelefono}
            enviando={crearTurnoMutation.isPending}
            onNombreChange={setClienteNombre}
            onTelefonoChange={setClienteTelefono}
            onVolver={() => setPaso('horario')}
            onSubmit={confirmar}
          />
        )}

        {paso === 'confirmacion' && turnoCreado && (
          <PasoConfirmacion turno={turnoCreado} />
        )}
      </div>
    </main>
  )
}

function PasoHorario({
  servicio,
  query,
  fecha,
  hora,
  error,
  onElegirFecha,
  onElegirHora,
  onVolver,
  onContinuar,
}: {
  servicio: Servicio
  query: ReturnType<typeof useQuery<DisponibilidadDia[]>>
  fecha: string | null
  hora: string | null
  error: string | null
  onElegirFecha: (fecha: string) => void
  onElegirHora: (hora: string) => void
  onVolver: () => void
  onContinuar: () => void
}) {
  return (
    <div>
      <BotonVolver onClick={onVolver} />
      <h1 className="font-display text-tinta text-2xl font-semibold">
        Elegí día y horario
      </h1>
      <p className="text-tinta-suave mb-4 text-sm">
        {servicio.nombre} · {servicio.duracionMinutos} min
      </p>

      {error && (
        <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {query.isPending && (
        <p className="text-tinta-suave">Cargando disponibilidad…</p>
      )}
      {query.isError && (
        <p className="text-vino">
          No pudimos cargar la disponibilidad. Probá de nuevo.
        </p>
      )}

      {query.data && (
        <GrillaHorarios
          dias={query.data}
          fecha={fecha}
          hora={hora}
          onElegirFecha={onElegirFecha}
          onElegirHora={onElegirHora}
        />
      )}

      <Button
        className="mt-4 w-full"
        disabled={!fecha || !hora}
        onClick={onContinuar}
      >
        Continuar
      </Button>
    </div>
  )
}

function PasoDatos({
  servicio,
  fecha,
  hora,
  nombre,
  telefono,
  enviando,
  onNombreChange,
  onTelefonoChange,
  onVolver,
  onSubmit,
}: {
  servicio: Servicio
  fecha: string
  hora: string
  nombre: string
  telefono: string
  enviando: boolean
  onNombreChange: (v: string) => void
  onTelefonoChange: (v: string) => void
  onVolver: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div>
      <BotonVolver onClick={onVolver} />
      <h1 className="font-display text-tinta mb-4 text-2xl font-semibold">
        Tus datos
      </h1>

      <Card className="mb-4">
        <p className="text-tinta-tenue text-xs tracking-wide uppercase">
          Resumen
        </p>
        <p className="text-tinta mt-1 text-sm">
          {servicio.nombre} · {fechaLegible(fecha)} · {hora}
        </p>
      </Card>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Nombre y apellido
          </span>
          <input
            required
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Teléfono
          </span>
          <input
            required
            type="tel"
            value={telefono}
            onChange={(e) => onTelefonoChange(e.target.value)}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <Button type="submit" disabled={enviando} className="mt-2">
          {enviando ? 'Confirmando…' : 'Confirmar turno'}
        </Button>
        <p className="text-tinta-tenue text-center text-xs">
          Sin cuenta ni contraseña — tu turno se gestiona con un link único.
        </p>
      </form>
    </div>
  )
}

function PasoConfirmacion({ turno }: { turno: Turno }) {
  const [copiado, setCopiado] = useState(false)
  const link = `${window.location.origin}/turno/${turno.id}`

  return (
    <div className="text-center">
      <div className="bg-bien-suave text-bien mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold">
        ✓
      </div>
      <h1 className="font-display text-tinta mb-4 text-2xl font-semibold">
        ¡Turno confirmado!
      </h1>

      <Card className="mb-4 text-left">
        <p className="text-tinta-tenue text-xs tracking-wide uppercase">
          {turno.servicio.nombre}
        </p>
        <p className="text-tinta mt-1 text-sm">
          {fechaLegible(turno.fecha)} · {turno.hora}
        </p>
      </Card>

      <label className="text-tinta-tenue mb-2 block text-left text-xs tracking-wide uppercase">
        Tu link para gestionar el turno
      </label>
      <div className="border-borde bg-superficie-2 text-tinta mb-4 truncate rounded-md border px-3 py-2 text-left text-sm">
        {link}
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          void navigator.clipboard.writeText(link)
          setCopiado(true)
        }}
      >
        {copiado ? 'Copiado ✓' : 'Copiar link'}
      </Button>

      <p className="border-borde bg-superficie-2 text-tinta-suave mt-4 rounded-md border border-dashed px-3 py-2 text-left text-xs">
        <span className="bg-borde-suave mr-1 rounded px-1 py-0.5 font-mono text-[10px] tracking-wide uppercase">
          Simulado
        </span>
        Te llegaría este mismo mensaje por WhatsApp cuando Ariel tenga cuenta de
        negocio.
      </p>
    </div>
  )
}
