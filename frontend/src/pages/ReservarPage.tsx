import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BotonVolver } from '../components/ui/BotonVolver'
import { Kicker } from '../components/ui/Kicker'
import { BTN_OUTLINE, BTN_GHOST } from '../components/ui/estilosBoton'
import { GrillaHorarios } from '../components/GrillaHorarios'
import { Landing } from '../components/Landing'
import { obtenerServicios } from '../api/servicios'
import { obtenerDisponibilidad } from '../api/disponibilidad'
import { crearTurno, enviarConfirmacion, urlCalendario } from '../api/turnos'
import { hoyIso, sumarDias, fechaLegible } from '../utils/fecha'
import {
  esEmailValido,
  esTelefonoValido,
  MENSAJE_EMAIL_INVALIDO,
  MENSAJE_TELEFONO_INVALIDO,
} from '../utils/validaciones'
import type { DisponibilidadDia, ErrorApi, Servicio, Turno } from '../types/api'

type Paso = 'servicio' | 'horario' | 'datos' | 'confirmacion'

const DIAS_A_MOSTRAR = 14

const INPUT_BASE = 'rounded-md border px-3 py-2 outline-none bg-superficie text-tinta'

function claseInput(conError: boolean): string {
  return conError
    ? `${INPUT_BASE} border-vino`
    : `${INPUT_BASE} border-borde focus:border-miel`
}

function ErrorCampo({ children }: { children: React.ReactNode }) {
  return <span className="text-vino text-xs">{children}</span>
}

export function ReservarPage() {
  const queryClient = useQueryClient()

  const [paso, setPaso] = useState<Paso>('servicio')
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
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
    // La landing es larga y el click sale de la grilla de servicios, allá abajo: sin
    // esto el wizard aparece con la página scrolleada a la mitad.
    window.scrollTo({ top: 0 })
  }

  // La landing NO es otra ruta: es el primer paso de esta misma página, que vive en "/".
  // Por eso "volver al inicio" no puede ser un <Link to="/"> — navegar a la ruta en la
  // que ya estás no remonta nada y el paso queda donde estaba (el botón no hacía nada).
  // Volver al inicio es resetear el wizard.
  function volverAlInicio() {
    setPaso('servicio')
    setServicio(null)
    setFecha(null)
    setHora(null)
    setClienteNombre('')
    setClienteTelefono('')
    setClienteEmail('')
    setTurnoCreado(null)
    setErrorHorario(null)
    window.scrollTo({ top: 0 })
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
      // Vacío significa "no dejó mail". Se manda `undefined` y no '' para no guardar
      // un dato falso en la base.
      clienteEmail: clienteEmail.trim() || undefined,
    })
  }

  if (paso === 'servicio') {
    return <Landing query={serviciosQuery} onElegir={elegirServicio} />
  }

  return (
    <main className="bg-fondo min-h-screen">
      <div className="mx-auto max-w-[820px] px-[clamp(20px,5vw,72px)] py-8">
        <nav className="border-borde mb-8 flex items-center justify-between border-b pb-4">
          <span className="font-display text-tinta text-lg font-semibold">
            La Peluquería de Ariel Enrique
          </span>
          <button
            onClick={volverAlInicio}
            className="text-miel text-sm hover:underline"
          >
            Volver al inicio
          </button>
        </nav>

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
            email={clienteEmail}
            enviando={crearTurnoMutation.isPending}
            onNombreChange={setClienteNombre}
            onTelefonoChange={setClienteTelefono}
            onEmailChange={setClienteEmail}
            onVolver={() => setPaso('horario')}
            onSubmit={confirmar}
          />
        )}

        {paso === 'confirmacion' && turnoCreado && (
          <PasoConfirmacion
            turno={turnoCreado}
            nombre={clienteNombre}
            telefono={clienteTelefono}
            email={clienteEmail.trim()}
            onVolverAlInicio={volverAlInicio}
          />
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
      <Kicker>Reserva de turno</Kicker>
      <h1 className="font-hero text-tinta mb-2 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
        {servicio.nombre}
      </h1>
      <p className="font-body text-tinta mb-4 opacity-75">
        Elegí el día y el horario para tu turno · {servicio.duracionMinutos} min
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

      <button
        className={`${BTN_OUTLINE} mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={!fecha || !hora}
        onClick={onContinuar}
      >
        Continuar
      </button>
    </div>
  )
}

function PasoDatos({
  servicio,
  fecha,
  hora,
  nombre,
  telefono,
  email,
  enviando,
  onNombreChange,
  onTelefonoChange,
  onEmailChange,
  onVolver,
  onSubmit,
}: {
  servicio: Servicio
  fecha: string
  hora: string
  nombre: string
  telefono: string
  email: string
  enviando: boolean
  onNombreChange: (v: string) => void
  onTelefonoChange: (v: string) => void
  onEmailChange: (v: string) => void
  onVolver: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const [errores, setErrores] = useState<{
    nombre?: string
    telefono?: string
    email?: string
  }>({})

  // El form va con `noValidate` y valida acá: si dejáramos la validación nativa del
  // navegador, el submit se frenaría antes de llegar a esta función y el cliente vería
  // la burbuja gris del navegador en vez del error en el campo, con el estilo del resto.
  function manejarSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nuevos: typeof errores = {}
    if (!nombre.trim()) nuevos.nombre = 'Poné tu nombre y apellido.'
    if (!esTelefonoValido(telefono)) nuevos.telefono = MENSAJE_TELEFONO_INVALIDO
    // El email es opcional: solo se valida si escribió algo.
    if (email.trim() && !esEmailValido(email))
      nuevos.email = MENSAJE_EMAIL_INVALIDO

    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    onSubmit(e)
  }

  function limpiarError(campo: keyof typeof errores) {
    setErrores((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev))
  }

  return (
    <div>
      <Kicker>Un paso más</Kicker>
      <h1 className="font-hero text-tinta mb-2 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
        Tus datos
      </h1>
      <p className="font-body text-tinta mb-4 opacity-80">
        {servicio.nombre} · {fechaLegible(fecha)} · {hora}
      </p>

      <form onSubmit={manejarSubmit} noValidate className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Nombre y apellido
          </span>
          <input
            value={nombre}
            onChange={(e) => {
              onNombreChange(e.target.value)
              limpiarError('nombre')
            }}
            placeholder="Ej: Juan Pérez"
            className={claseInput(Boolean(errores.nombre))}
          />
          {errores.nombre && <ErrorCampo>{errores.nombre}</ErrorCampo>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Teléfono
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={telefono}
            onChange={(e) => {
              onTelefonoChange(e.target.value)
              limpiarError('telefono')
            }}
            placeholder="Ej: 351 459 3325"
            className={claseInput(Boolean(errores.telefono))}
          />
          {errores.telefono && <ErrorCampo>{errores.telefono}</ErrorCampo>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Email (opcional)
          </span>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              onEmailChange(e.target.value)
              limpiarError('email')
            }}
            placeholder="Ej: juan@gmail.com"
            className={claseInput(Boolean(errores.email))}
          />
          {errores.email ? (
            <ErrorCampo>{errores.email}</ErrorCampo>
          ) : (
            <span className="text-tinta-tenue text-xs">
              Te mandamos el link de tu turno por mail así no lo perdés. Si no
              ponés, te lo podemos mandar después.
            </span>
          )}
        </label>

        <div className="mt-2 flex gap-3">
          <button type="button" className={BTN_GHOST} onClick={onVolver}>
            Volver
          </button>
          <button
            type="submit"
            disabled={enviando}
            className={`${BTN_OUTLINE} flex-1 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {enviando ? 'Confirmando…' : 'Confirmar turno'}
          </button>
        </div>
        <p className="text-tinta-tenue text-center text-xs">
          Sin cuenta ni contraseña — tu turno se gestiona con un link único.
        </p>
      </form>
    </div>
  )
}

function PasoConfirmacion({
  turno,
  nombre,
  telefono,
  email,
  onVolverAlInicio,
}: {
  turno: Turno
  nombre: string
  telefono: string
  email: string
  onVolverAlInicio: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  // Si no dejó mail al reservar, puede cargarlo acá (HU-19). Una vez enviado, esta
  // pantalla se comporta igual que si lo hubiera dejado desde el principio.
  const [emailCargado, setEmailCargado] = useState<string | null>(null)
  const emailDelTurno = email || emailCargado
  const link = `${window.location.origin}/turno/${turno.id}`

  return (
    <div className="mx-auto max-w-[56ch] text-center">
      <Kicker>Turno confirmado</Kicker>
      <h1 className="font-hero text-tinta mb-4 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
        ¡Listo, {nombre}!
      </h1>
      <p className="font-body text-tinta mb-2 text-lg">
        {turno.servicio.nombre}
      </p>
      <p className="font-body text-tinta mb-2 text-lg">
        {fechaLegible(turno.fecha)} · {turno.hora}
      </p>
      <p className="font-body text-tinta mb-4 opacity-75">
        Te contactaremos al {telefono} si hace falta reprogramar.
      </p>

      <a href={urlCalendario(turno.id)} className={`${BTN_OUTLINE} mb-6 w-full`}>
        Agregar a mi calendario
      </a>

      {/* Con mail, el link no se muestra: ya le llegó a la casilla y ahí no se pierde.
          Mostrarlo igual invitaría a copiarlo a mano, que es justo el paso que el mail
          viene a sacar. Sin mail, el link es lo único que tiene, así que va bien
          visible y con botón para copiarlo. */}
      {emailDelTurno ? (
        <p className="border-borde bg-superficie-2 text-tinta mt-2 rounded-md border px-3 py-2 text-left text-sm">
          Te mandamos el link para gestionar tu turno a{' '}
          <strong>{emailDelTurno}</strong>. Con ese link podés cancelar o
          reprogramar hasta 60 minutos antes. Si no lo ves, fijate en spam.
        </p>
      ) : (
        <>
          <label className="text-tinta-tenue mb-2 block text-left text-xs tracking-wide uppercase">
            Tu link para gestionar el turno
          </label>
          <div className="border-borde bg-superficie-2 text-tinta mb-3 truncate rounded-md border px-3 py-2 text-left text-sm">
            {link}
          </div>
          <button
            className={`${BTN_OUTLINE} w-full`}
            onClick={() => {
              void navigator.clipboard.writeText(link)
              setCopiado(true)
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar link'}
          </button>

          <PedirMail turnoId={turno.id} onEnviado={setEmailCargado} />
        </>
      )}

      <button
        onClick={onVolverAlInicio}
        className={`${BTN_GHOST} mt-6 inline-flex`}
      >
        Volver al inicio
      </button>
    </div>
  )
}

/** HU-19 — Segunda oportunidad para dejar el mail, para el que reservó sin ponerlo.
 *
 * Va acá y no en otro lado porque este es el momento en que el cliente está mirando su
 * link y cae en la cuenta de que lo puede perder. El backend lo acepta una sola vez por
 * turno (ver `guardarEmailDelCliente`), así que este bloque desaparece al enviarlo. */
function PedirMail({
  turnoId,
  onEnviado,
}: {
  turnoId: string
  onEnviado: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => enviarConfirmacion(turnoId, email.trim()),
    onSuccess: (data) => onEnviado(data.email),
    onError: (err) => {
      setError(
        (isAxiosError<ErrorApi>(err) && err.response?.data.error.mensaje) ||
          'No pudimos mandarte el mail. Probá de nuevo.',
      )
    },
  })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!esEmailValido(email)) {
          setError(MENSAJE_EMAIL_INVALIDO)
          return
        }
        setError(null)
        mutation.mutate()
      }}
      className="border-borde bg-superficie-2 mt-4 rounded-md border p-3 text-left"
    >
      <p className="text-tinta text-sm">
        ¿Querés que te lo mandemos por mail? Así no dependés de guardar el link
        ahora.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          placeholder="Ej: juan@gmail.com"
          className={`${claseInput(Boolean(error))} flex-1`}
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className={`${BTN_OUTLINE} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {mutation.isPending ? 'Enviando…' : 'Mandámelo'}
        </button>
      </div>
      {error && <p className="text-vino mt-2 text-xs">{error}</p>}
    </form>
  )
}
