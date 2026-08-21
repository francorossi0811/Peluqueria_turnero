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
import { crearTurno } from '../api/turnos'
// Los usa `PasoConfirmacion`, que está comentado más abajo — ver la nota de ahí.
// import { enviarConfirmacion, urlCalendario } from '../api/turnos'
import { hoyIso, sumarDias, fechaLegible } from '../utils/fecha'
import { formatearPesos } from '../utils/dinero'
import { WHATSAPP_URL } from '../utils/contacto'
import { whatsappDeTurno } from '../utils/mensajesWhatsapp'
import { WHATSAPP_AUTOMATICO } from '../utils/avisos'
import {
  esEmailValido,
  esNombreValido,
  esTelefonoValido,
  MENSAJE_EMAIL_INVALIDO,
  MENSAJE_NOMBRE_INVALIDO,
  MENSAJE_TELEFONO_INVALIDO,
} from '../utils/validaciones'
import type { DisponibilidadDia, ErrorApi, Servicio } from '../types/api'
// import type { Turno } from '../types/api' // lo usa `PasoConfirmacion`, comentado abajo

type Paso = 'servicio' | 'horario' | 'datos' | 'confirmacion'

const DIAS_A_MOSTRAR = 14

const INPUT_BASE =
  'rounded-md border px-3 py-2 outline-none bg-superficie text-tinta'

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
  // const [turnoCreado, setTurnoCreado] = useState<Turno | null>(null)
  // Entre que la mutación resuelve y el navegador se va a WhatsApp pasa un rato en el
  // que `isPending` ya es `false`: sin esto el botón vuelve a decir "Confirmar por
  // WhatsApp" y queda invitando a un segundo click que crearía un segundo turno.
  const [redirigiendo, setRedirigiendo] = useState(false)
  const [errorHorario, setErrorHorario] = useState<string | null>(null)
  // El rechazo del teléfono que solo sabe el backend. Ver el `onError` de la mutación.
  const [errorTelefonoServidor, setErrorTelefonoServidor] = useState<
    string | null
  >(null)
  // HU-28 — El turno no entra por una regla de la persona, no del horario: ya tiene sus
  // turnos de la semana, o eligió una fecha demasiado lejana. No es un campo del formulario
  // ni un horario ocupado, así que tiene su propio cartel.
  const [errorReserva, setErrorReserva] = useState<string | null>(null)

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
    // El turno YA quedó reservado acá: tiene su fila, su horario tomado y su link. Lo
    // que sigue no es confirmarlo —eso lo hizo el backend— sino avisarle a Ariel por el
    // canal que él usa. Mientras la Cloud API de Meta no esté conectada, el aviso lo
    // manda el cliente desde su propio WhatsApp con el texto ya escrito.
    //
    // ⚠️ Se va con `location.href` y no con `window.open`: esto corre dentro del callback
    // de una promesa, o sea fuera del gesto del usuario, y ahí Safari y compañía bloquean
    // la pestaña nueva. En el celular —que es donde está casi todo el mundo— esto abre la
    // app de WhatsApp y el navegador se queda atrás con la página intacta.
    //
    // Y si la redirección igual no pasara, el turno no se pierde: existe en la agenda de
    // Ariel y su link viaja adentro del mensaje.
    onSuccess: (turno) => {
      // Con el backend avisando por la Cloud API no hay nada que redirigir: el mensaje ya
      // salió. Se va a la pantalla de gestión del turno, que es donde el cliente puede
      // hacer algo. Ver `utils/avisos.ts`.
      if (WHATSAPP_AUTOMATICO) {
        setRedirigiendo(true)
        window.location.href = `/turno/${turno.id}`
        return
      }

      setRedirigiendo(true)
      window.location.href = whatsappDeTurno('confirmado', {
        nombre: clienteNombre,
        servicio: turno.servicio.nombre,
        fecha: turno.fecha,
        hora: turno.hora,
        link: `${window.location.origin}/turno/${turno.id}`,
      })
    },
    onError: (err) => {
      setRedirigiendo(false)
      const datos = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error
        : null

      // HU-28 — Los dos topes de la reserva pública. Van **antes** del caso del horario
      // ocupado, y la rama de abajo mira el `codigo` y ya no el status a secas: los tres
      // son 409, así que un `status === 409` genérico se comía estos dos y le mostraba a la
      // persona "ese horario se acaba de ocupar" —que es falso— en la pantalla equivocada y
      // perdiéndole el horario que ya había elegido. Es el mismo defecto que se corrigió
      // una vez con el teléfono, acá abajo.
      //
      // Se queda en el paso de datos: la salida no es elegir otro horario cualquiera (el
      // límite es de la persona, no del rato), así que mandarla de vuelta a la grilla la
      // haría chocar de nuevo contra lo mismo.
      if (
        datos?.codigo === 'LIMITE_SEMANAL_ALCANZADO' ||
        datos?.codigo === 'FUERA_DE_HORIZONTE'
      ) {
        setErrorReserva(datos.mensaje)
        return
      }

      if (datos?.codigo === 'HORARIO_NO_DISPONIBLE') {
        setErrorHorario('Ese horario se acaba de ocupar. Elegí otro.')
        setHora(null)
        setPaso('horario')
        queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
        return
      }

      // El backend es más estricto que el chequeo local en un solo campo: el teléfono
      // (`esTelefonoUtilizable` sabe qué características existen de verdad, y para eso
      // haría falta traerse `libphonenumber-js` al bundle público). Así que un 400 de
      // parámetros es, en la práctica, siempre el número.
      //
      // Se queda en el paso de datos con el mensaje pegado al campo. Mandarlo de vuelta al
      // paso del horario, como hacía antes, lo alejaba justo del campo que tiene que
      // corregir y le hablaba de otra cosa.
      if (datos?.codigo === 'PARAMETROS_INVALIDOS') {
        setErrorTelefonoServidor(datos.mensaje)
        return
      }

      setErrorHorario('Hubo un problema al confirmar el turno. Probá de nuevo.')
      setPaso('horario')
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
    // setTurnoCreado(null)
    setRedirigiendo(false)
    setErrorHorario(null)
    setErrorReserva(null)
    window.scrollTo({ top: 0 })
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!servicio || !fecha || !hora) return
    setErrorReserva(null)
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
            enviando={crearTurnoMutation.isPending || redirigiendo}
            errorTelefonoServidor={errorTelefonoServidor}
            errorReserva={errorReserva}
            onNombreChange={setClienteNombre}
            onTelefonoChange={(v) => {
              // Tocar el número borra el rechazo del servidor: si no, el error queda
              // pegado mientras la persona ya lo está corrigiendo.
              setErrorTelefonoServidor(null)
              setClienteTelefono(v)
            }}
            onEmailChange={setClienteEmail}
            onVolver={() => {
              // Volver a la grilla limpia el cartel: elegir otra fecha es una salida real
              // para el tope semanal (un día fuera de esos 7) y para el horizonte.
              setErrorReserva(null)
              setPaso('horario')
            }}
            onSubmit={confirmar}
          />
        )}

        {/* ⚠️ La pantalla "¡Listo, {nombre}!" está COMENTADA, no borrada — igual que la
            sección Beneficios de la landing, y por el mismo motivo: es la pantalla que
            corresponde el día que los avisos salgan solos desde el backend. Hoy no sale
            ninguno, así que el aviso lo manda el cliente desde su WhatsApp y el paso
            'confirmacion' no se llega a renderizar nunca: `onSuccess` se va del sitio.

            Para volver a prenderla hay que descomentar CUATRO cosas, que van juntas:
            este bloque, el estado `turnoCreado`, los componentes `PasoConfirmacion` y
            `PedirMail` del final del archivo, y sus imports de arriba
            (`enviarConfirmacion`, `urlCalendario`, el tipo `Turno`). Y sacar la
            redirección del `onSuccess`, claro.

        {paso === 'confirmacion' && turnoCreado && (
          <PasoConfirmacion
            turno={turnoCreado}
            nombre={clienteNombre}
            telefono={clienteTelefono}
            email={clienteEmail.trim()}
            onVolverAlInicio={volverAlInicio}
          />
        )} */}
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
        {servicio.precio !== null && ` · ${formatearPesos(servicio.precio)}`}
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
  errorTelefonoServidor,
  errorReserva,
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
  /** El rechazo que solo puede dar el backend: un número bien escrito cuya característica
   * no existe. Se dibuja en el mismo lugar que los errores locales. */
  errorTelefonoServidor: string | null
  /** HU-28 — El tope semanal o el horizonte. No cuelga de ningún campo —es la persona la
   * que no puede reservar, no el dato que escribió—, así que va en su propio cartel arriba
   * de los botones y no debajo de un input. */
  errorReserva: string | null
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
    // Dos mensajes distintos a propósito: "no pusiste nada" y "eso no es un nombre" son
    // dos problemas distintos, y decirle "solo letras" a quien dejó el campo vacío no le
    // explica nada.
    if (!nombre.trim()) nuevos.nombre = 'Poné tu nombre y apellido.'
    else if (!esNombreValido(nombre)) nuevos.nombre = MENSAJE_NOMBRE_INVALIDO
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

  // El error local gana sobre el del servidor: si la persona rompió el número después de
  // que el backend lo rechazara, lo primero que tiene que arreglar es lo que se ve ahora.
  const errorTelefono = errores.telefono ?? errorTelefonoServidor

  return (
    <div>
      <Kicker>Un paso más</Kicker>
      <h1 className="font-hero text-tinta mb-2 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
        Tus datos
      </h1>
      <p className="font-body text-tinta mb-4 opacity-80">
        {servicio.nombre} · {fechaLegible(fecha)} · {hora}
        {servicio.precio !== null && ` · ${formatearPesos(servicio.precio)}`}
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
            className={claseInput(Boolean(errorTelefono))}
          />
          {errorTelefono ? (
            <ErrorCampo>{errorTelefono}</ErrorCampo>
          ) : (
            <span className="text-tinta-tenue text-xs">
              Es con lo que Ariel te ubica si hace falta reprogramar.
            </span>
          )}
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
              Por si querés tenerlo también por mail.
            </span>
          )}
        </label>

        {errorReserva && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            <p>{errorReserva}</p>
            {/* La salida real: Ariel puede cargarle el turno a mano, y el límite es solo
                para la reserva por la web. Sin esto el cartel es una puerta cerrada. */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-semibold underline"
            >
              Escribinos por WhatsApp
            </a>
          </div>
        )}

        <div className="mt-2 flex gap-3">
          <button type="button" className={BTN_GHOST} onClick={onVolver}>
            Volver
          </button>
          <button
            type="submit"
            disabled={enviando}
            className={`${BTN_OUTLINE} flex-1 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {enviando ? 'Abriendo WhatsApp…' : 'Confirmar por WhatsApp'}
          </button>
        </div>
        {/* Lo que hace el botón, dicho antes de tocarlo. El turno queda reservado igual
            en el momento del click —el mensaje no es lo que lo confirma— pero avisarle a
            Ariel por su canal es lo que él pidió, y el link viaja adentro del mensaje:
            mandarlo es también la forma de que al cliente le quede guardado. */}
        <p className="text-tinta-tenue text-center text-xs">
          Te abrimos WhatsApp con el mensaje ya escrito para Ariel, con el link
          de tu turno adentro. Sin cuenta ni contraseña.
        </p>
      </form>
    </div>
  )
}

// ⚠️ COMENTADO, NO BORRADO — la pantalla de confirmación y el pedido de mail.
//
// Las dos son el final del flujo que existía cuando el sistema le avisaba al cliente
// solo: le mostraba su link, le ofrecía mandárselo por mail y le daba el .ics. Hoy el
// aviso lo manda el cliente por WhatsApp desde el paso de datos, así que a este código
// no se llega.
//
// Se conserva entero porque el día que Meta apruebe la conexión con el número de Ariel
// —o que se valide el remitente de Brevo y el mail vuelva a entregarse— esta es la
// pantalla que corresponde, y rehacerla sería trabajo tirado. Es el mismo criterio que
// la sección Beneficios de la landing.
//
// Va comentado línea por línea y no con /* */ porque el bloque tiene comentarios JSX
// adentro: el primer cierre de comentario lo partiría al medio.
//
// Para prenderlo de nuevo, ver la nota del bloque comentado dentro de `ReservarPage`:
// son cuatro cosas que van juntas, no solo esta.
// function PasoConfirmacion({
//   turno,
//   nombre,
//   telefono,
//   email,
//   onVolverAlInicio,
// }: {
//   turno: Turno
//   nombre: string
//   telefono: string
//   email: string
//   onVolverAlInicio: () => void
// }) {
//   const [copiado, setCopiado] = useState(false)
//   // Si no dejó mail al reservar, puede cargarlo acá (HU-19). Una vez enviado, esta
//   // pantalla se comporta igual que si lo hubiera dejado desde el principio.
//   const [emailCargado, setEmailCargado] = useState<string | null>(null)
//   const emailDelTurno = email || emailCargado
//   const link = `${window.location.origin}/turno/${turno.id}`
//
//   return (
//     <div className="mx-auto max-w-[56ch] text-center">
//       <Kicker>Turno confirmado</Kicker>
//       <h1 className="font-hero text-tinta mb-4 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
//         ¡Listo, {nombre}!
//       </h1>
//       <p className="font-body text-tinta mb-2 text-lg">
//         {turno.servicio.nombre}
//         {turno.servicio.precio !== null &&
//           ` · ${formatearPesos(turno.servicio.precio)}`}
//       </p>
//       <p className="font-body text-tinta mb-2 text-lg">
//         {fechaLegible(turno.fecha)} · {turno.hora}
//       </p>
//       <p className="font-body text-tinta mb-4 opacity-75">
//         Te contactaremos al {telefono} si hace falta reprogramar.
//       </p>
//
//       {/* Con mail, el link no se muestra: ya le llegó a la casilla y ahí no se pierde.
//           Mostrarlo igual invitaría a copiarlo a mano, que es justo el paso que el mail
//           viene a sacar. Sin mail, el link es lo único que tiene, así que va bien
//           visible y con botón para copiarlo. */}
//       {emailDelTurno ? (
//         <p className="border-borde bg-superficie-2 text-tinta mt-2 rounded-md border px-3 py-2 text-left text-sm">
//           Te mandamos el link para gestionar tu turno a{' '}
//           <strong>{emailDelTurno}</strong>. Con ese link podés cancelar o
//           reprogramar hasta 60 minutos antes. Si no lo ves, fijate en spam.
//         </p>
//       ) : (
//         <>
//           <label className="text-tinta-tenue mb-2 block text-left text-xs tracking-wide uppercase">
//             Tu link para gestionar el turno
//           </label>
//           <div className="border-borde bg-superficie-2 text-tinta mb-3 truncate rounded-md border px-3 py-2 text-left text-sm">
//             {link}
//           </div>
//           <button
//             className={`${BTN_OUTLINE} w-full`}
//             onClick={() => {
//               void navigator.clipboard.writeText(link)
//               setCopiado(true)
//             }}
//           >
//             {copiado ? 'Copiado ✓' : 'Copiar link'}
//           </button>
//
//           <PedirMail turnoId={turno.id} onEnviado={setEmailCargado} />
//         </>
//       )}
//
//       {/* Va al final y no arriba: lo primero que el cliente necesita saber es que el
//           turno quedó y cómo lo va a gestionar. Guardarlo en el calendario es el paso
//           siguiente, opcional. */}
//       <a href={urlCalendario(turno.id)} className={`${BTN_OUTLINE} mt-6 w-full`}>
//         Agregar a mi calendario
//       </a>
//
//       <button
//         onClick={onVolverAlInicio}
//         className={`${BTN_GHOST} mt-4 inline-flex`}
//       >
//         Volver al inicio
//       </button>
//     </div>
//   )
// }
//
// /** HU-19 — Segunda oportunidad para dejar el mail, para el que reservó sin ponerlo.
//  *
//  * Va acá y no en otro lado porque este es el momento en que el cliente está mirando su
//  * link y cae en la cuenta de que lo puede perder. El backend lo acepta una sola vez por
//  * turno (ver `guardarEmailDelCliente`), así que este bloque desaparece al enviarlo. */
// function PedirMail({
//   turnoId,
//   onEnviado,
// }: {
//   turnoId: string
//   onEnviado: (email: string) => void
// }) {
//   const [email, setEmail] = useState('')
//   const [error, setError] = useState<string | null>(null)
//
//   const mutation = useMutation({
//     mutationFn: () => enviarConfirmacion(turnoId, email.trim()),
//     onSuccess: (data) => onEnviado(data.email),
//     onError: (err) => {
//       setError(
//         (isAxiosError<ErrorApi>(err) && err.response?.data.error.mensaje) ||
//           'No pudimos mandarte el mail. Probá de nuevo.',
//       )
//     },
//   })
//
//   return (
//     <form
//       noValidate
//       onSubmit={(e) => {
//         e.preventDefault()
//         if (!esEmailValido(email)) {
//           setError(MENSAJE_EMAIL_INVALIDO)
//           return
//         }
//         setError(null)
//         mutation.mutate()
//       }}
//       className="border-borde bg-superficie-2 mt-4 rounded-md border p-3 text-left"
//     >
//       <p className="text-tinta text-sm">
//         ¿Querés que te lo mandemos por mail? Así no dependés de guardar el link
//         ahora.
//       </p>
//       <div className="mt-2 flex flex-col gap-2 sm:flex-row">
//         <input
//           type="email"
//           inputMode="email"
//           value={email}
//           onChange={(e) => {
//             setEmail(e.target.value)
//             setError(null)
//           }}
//           placeholder="Ej: juan@gmail.com"
//           className={`${claseInput(Boolean(error))} flex-1`}
//         />
//         <button
//           type="submit"
//           disabled={mutation.isPending}
//           className={`${BTN_OUTLINE} disabled:cursor-not-allowed disabled:opacity-50`}
//         >
//           {mutation.isPending ? 'Enviando…' : 'Mandámelo'}
//         </button>
//       </div>
//       {error && <p className="text-vino mt-2 text-xs">{error}</p>}
//     </form>
//   )
// }
