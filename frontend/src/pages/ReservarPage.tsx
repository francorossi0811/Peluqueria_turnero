import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BotonVolver } from '../components/ui/BotonVolver'
import { Kicker } from '../components/ui/Kicker'
import { BTN_OUTLINE, BTN_GHOST } from '../components/ui/estilosBoton'
import { GrillaHorarios } from '../components/GrillaHorarios'
import { Landing } from '../components/Landing'
import { obtenerServicios } from '../api/servicios'
import { obtenerDisponibilidad } from '../api/disponibilidad'
import { crearTurno, crearTurnosEnGrupo } from '../api/turnos'
// Los usa `PasoConfirmacion`, que está comentado más abajo — ver la nota de ahí.
// import { enviarConfirmacion, urlCalendario } from '../api/turnos'
import { hoyIso, sumarDias, fechaLegible } from '../utils/fecha'
import { formatearPesos } from '../utils/dinero'
import { WHATSAPP_URL } from '../utils/contacto'
// `whatsappDeTurnosConfirmados` cubre los dos casos: con un turno delega en
// `mensajeDeTurno('confirmado', …)`, que es el mensaje de siempre carácter por carácter.
import { whatsappDeTurnosConfirmados } from '../utils/mensajesWhatsapp'
import { WHATSAPP_AUTOMATICO } from '../utils/avisos'
import {
  esEmailValido,
  esNombreValido,
  esTelefonoValido,
  MENSAJE_EMAIL_INVALIDO,
  MENSAJE_NOMBRE_INVALIDO,
  MENSAJE_TELEFONO_INVALIDO,
} from '../utils/validaciones'
import { descontarHorariosDelGrupo } from '../utils/horariosDelGrupo'
import type { DisponibilidadDia, ErrorApi, Servicio, Turno } from '../types/api'
// import type { Turno } from '../types/api' // lo usa `PasoConfirmacion`, comentado abajo

type Paso = 'servicio' | 'horario' | 'datos' | 'confirmacion'

const DIAS_A_MOSTRAR = 14

/** HU-31 — Cuántos turnos entran en una pasada. Tiene que ser el mismo número que
 * `MAX_TURNOS_POR_GRUPO` del backend, que es quien lo aplica de verdad: acá solo decide
 * cuándo dejar de ofrecer el botón "Agregar otro turno". */
const MAX_TURNOS_POR_GRUPO = 3

/** HU-31 — Un turno ya elegido, esperando a que se carguen los datos.
 *
 * Guarda el `servicio` entero y no solo el id porque hacen falta las tres cosas: la
 * duración para descontar horarios, y el nombre y el precio para el resumen. */
interface TurnoElegido {
  servicio: Servicio
  fecha: string
  hora: string
  /** El de cada hijo. Se completa en el paso de datos, todos juntos. */
  nombre: string
}

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
  // HU-31 — El borrador: el turno que se está eligiendo ahora. Son los mismos tres
  // escalares de siempre, con el mismo nombre, y por eso `PasoHorario` no cambió de forma.
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  // HU-31 — Los que ya se eligieron. Vacío mientras se reserva uno solo, que es el caso
  // normal: con la lista vacía todo el flujo se comporta exactamente como antes.
  const [turnos, setTurnos] = useState<TurnoElegido[]>([])
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

  // HU-31 — Los horarios que el propio grupo ya se llevó no se pueden volver a ofrecer: el
  // primer turno todavía no existe en la base, así que el backend lo sigue dando por libre.
  //
  // ⚠️ El filtro vive acá y no dentro de `GrillaHorarios`: ese componente tiene tres
  // llamadores (esta página, la reprogramación y el panel de Ariel) y el concepto "lo que
  // este grupo ya tomó" no existe para dos de los tres. `ReservarPage` ya es dueña de la
  // query y de la lista, así que el filtro es una derivación de lo que ya tiene.
  const diasDisponibles = useMemo(() => {
    if (!disponibilidadQuery.data || !servicio) return disponibilidadQuery.data
    return descontarHorariosDelGrupo(
      disponibilidadQuery.data,
      turnos.map((t) => ({
        fecha: t.fecha,
        hora: t.hora,
        duracionMinutos: t.servicio.duracionMinutos,
      })),
      servicio.duracionMinutos,
    )
  }, [disponibilidadQuery.data, turnos, servicio])

  // Preselecciona el primer día con horarios, para no dejar la grilla vacía sin motivo.
  //
  // ⚠️ Mira los días **ya filtrados**: con los del backend podría caer en un día que el
  // grupo dejó sin horarios libres.
  useEffect(() => {
    if (fecha || !diasDisponibles) return
    const primerDiaConHorarios = diasDisponibles.find(
      (d) => d.horarios.length > 0,
    )
    if (primerDiaConHorarios) setFecha(primerDiaConHorarios.fecha)
  }, [diasDisponibles, fecha])

  // HU-31 — Un turno solo sigue yendo por `crearTurno` y el endpoint de siempre; el grupo
  // va por el suyo. El caso normal no toca una línea de código nueva del backend.
  const crearTurnoMutation = useMutation({
    mutationFn: async (elegidos: TurnoElegido[]): Promise<Turno[]> => {
      const email = clienteEmail.trim() || undefined
      if (elegidos.length === 1) {
        const uno = elegidos[0]
        const turno = await crearTurno({
          servicioId: uno.servicio.id,
          fecha: uno.fecha,
          hora: uno.hora,
          clienteNombre: uno.nombre,
          clienteTelefono,
          // Vacío significa "no dejó mail". Se manda `undefined` y no '' para no guardar
          // un dato falso en la base.
          clienteEmail: email,
        })
        return [turno]
      }
      return crearTurnosEnGrupo({
        clienteTelefono,
        clienteEmail: email,
        turnos: elegidos.map((t) => ({
          servicioId: t.servicio.id,
          fecha: t.fecha,
          hora: t.hora,
          clienteNombre: t.nombre,
        })),
      })
    },
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
    onSuccess: (creados) => {
      // Con el backend avisando por la Cloud API no hay nada que redirigir: el mensaje ya
      // salió. Se va a la pantalla de gestión del turno, que es donde el cliente puede
      // hacer algo. Ver `utils/avisos.ts`.
      //
      // ⚠️ Con varios turnos no hay "la" pantalla: se va a la del primero. Esta rama hoy no
      // corre en producción (la Cloud API sigue sin credenciales en Render), así que no
      // vale la pena inventarle una pantalla de grupo hasta que sea real.
      if (WHATSAPP_AUTOMATICO) {
        setRedirigiendo(true)
        window.location.href = `/turno/${creados[0].id}`
        return
      }

      setRedirigiendo(true)
      const datos = creados.map((turno) => ({
        nombre: turno.clienteNombre ?? '',
        servicio: turno.servicio.nombre,
        fecha: turno.fecha,
        hora: turno.hora,
        link: `${window.location.origin}/turno/${turno.id}`,
      }))
      // Con uno solo esto devuelve, carácter por carácter, el mismo mensaje que antes
      // armaba `whatsappDeTurno('confirmado', …)`. Hay un test que lo fija.
      window.location.href = whatsappDeTurnosConfirmados(datos)
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

      // HU-31 — Dos del propio grupo que se pisan. También es 409, así que depende de
      // ramificar por `codigo`. Se queda en el paso de datos igual que los de arriba: la
      // salida es sacar uno de los dos del resumen, y ese botón está justo ahí.
      if (datos?.codigo === 'TURNOS_DEL_GRUPO_SE_PISAN') {
        setErrorReserva(datos.mensaje)
        return
      }

      if (datos?.codigo === 'HORARIO_NO_DISPONIBLE') {
        setErrorHorario('Ese horario se acaba de ocupar. Elegí otro.')
        // HU-31 — Con un grupo, el que se ocupó vuelve al borrador para volver a elegirle
        // hora, y **los otros quedan en la lista**: siguen siendo válidos y hacerle rehacer
        // los tres sería castigarlo por un choque que no es suyo.
        //
        // ⚠️ El backend no dice cuál de los N falló, así que se vuelve el último elegido:
        // es el único que se puede señalar sin adivinar, y es además el más probable.
        setTurnos((prev) => {
          const ultimo = prev[prev.length - 1]
          if (ultimo) {
            setServicio(ultimo.servicio)
            setFecha(ultimo.fecha)
          }
          return prev.slice(0, -1)
        })
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
  /** HU-31 — Pasa el borrador a la lista. Lo llaman los dos botones del paso del horario:
   * "Continuar" (que sigue a los datos) y "Agregar otro turno" (que vuelve al principio). */
  function agregarAlGrupo(): TurnoElegido[] {
    if (!servicio || !fecha || !hora) return turnos
    const siguiente = [...turnos, { servicio, fecha, hora, nombre: '' }]
    setTurnos(siguiente)
    return siguiente
  }

  /** HU-31 — Vuelve al paso 1 **conservando** lo elegido, para sumar otro turno.
   *
   * ⚠️ Cambia `paso` y nada más: nada de `navigate` ni de `<Link to="/">`. La landing no es
   * una ruta, es el paso 1 de esta misma página — y por eso esto **no agrega ni una entrada
   * al historial**, que es lo que el proyecto viene evitando desde que el botón "atrás"
   * confundió a Ariel en el login. */
  function agregarOtroTurno() {
    agregarAlGrupo()
    setServicio(null)
    setFecha(null)
    setHora(null)
    setErrorHorario(null)
    setPaso('servicio')
    window.scrollTo({ top: 0 })
  }

  function volverAlInicio() {
    setPaso('servicio')
    setServicio(null)
    setFecha(null)
    setHora(null)
    setTurnos([])
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
    if (turnos.length === 0) return
    setErrorReserva(null)
    crearTurnoMutation.mutate(turnos)
  }

  /** HU-31 — Saca uno del grupo desde el resumen del paso de datos.
   *
   * Sin esto, el único arreglo de "me equivoqué en el segundo" sería empezar los tres de
   * nuevo — el mismo agujero que taparon `PATCH …/telefono` (HU-25) y `PATCH …/cobro`
   * (HU-27). El horario que suelta vuelve a ofrecerse solo: el filtro es estado derivado. */
  function sacarDelGrupo(indice: number) {
    setErrorReserva(null)
    const quedan = turnos.filter((_, i) => i !== indice)
    setTurnos(quedan)
    // Si se sacó el último que quedaba, no hay nada que confirmar: vuelve a elegir.
    if (quedan.length === 0) {
      setServicio(null)
      setFecha(null)
      setHora(null)
      setPaso('servicio')
      window.scrollTo({ top: 0 })
    }
  }

  function cambiarNombre(indice: number, valor: string) {
    setTurnos((prev) =>
      prev.map((t, i) => (i === indice ? { ...t, nombre: valor } : t)),
    )
  }

  if (paso === 'servicio') {
    return (
      <Landing
        query={serviciosQuery}
        onElegir={elegirServicio}
        // HU-31 — Sin turnos acumulados la prop no se pasa y la landing se dibuja
        // exactamente como siempre. Es el mismo patrón que la prop `pasado` de
        // `GrillaHorarios`.
        turnosElegidos={
          turnos.length > 0
            ? turnos.map((t) => ({
                servicio: t.servicio.nombre,
                fecha: t.fecha,
                hora: t.hora,
              }))
            : undefined
        }
        onIrACargarDatos={() => setPaso('datos')}
      />
    )
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
            dias={diasDisponibles}
            fecha={fecha}
            hora={hora}
            error={errorHorario}
            yaElegidos={turnos.length}
            onElegirFecha={(f) => {
              setFecha(f)
              setHora(null)
            }}
            onElegirHora={setHora}
            onVolver={() => setPaso('servicio')}
            onAgregarOtro={agregarOtroTurno}
            onContinuar={() => {
              setErrorHorario(null)
              agregarAlGrupo()
              setPaso('datos')
            }}
          />
        )}

        {paso === 'datos' && turnos.length > 0 && (
          <PasoDatos
            turnos={turnos}
            telefono={clienteTelefono}
            email={clienteEmail}
            enviando={crearTurnoMutation.isPending || redirigiendo}
            errorTelefonoServidor={errorTelefonoServidor}
            errorReserva={errorReserva}
            onNombreChange={cambiarNombre}
            onSacar={sacarDelGrupo}
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
              //
              // HU-31 — El último elegido vuelve al borrador, así "Volver" sigue queriendo
              // decir "cambiame este horario" y no "perdé todo lo que elegiste".
              setErrorReserva(null)
              const ultimo = turnos[turnos.length - 1]
              if (ultimo) {
                setServicio(ultimo.servicio)
                setFecha(ultimo.fecha)
                setHora(ultimo.hora)
                setTurnos((prev) => prev.slice(0, -1))
              }
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
  dias,
  fecha,
  hora,
  error,
  yaElegidos,
  onElegirFecha,
  onElegirHora,
  onVolver,
  onAgregarOtro,
  onContinuar,
}: {
  servicio: Servicio
  /** Solo para los estados de carga y de error; los días salen de `dias`. */
  query: ReturnType<typeof useQuery<DisponibilidadDia[]>>
  /** HU-31 — Los días **ya descontados** de lo que el grupo se llevó. */
  dias: DisponibilidadDia[] | undefined
  fecha: string | null
  hora: string | null
  error: string | null
  /** HU-31 — Cuántos lleva elegidos el grupo. Con 0 la pantalla queda idéntica a la de
   * siempre: sin aviso arriba y con un solo botón abajo. */
  yaElegidos: number
  onElegirFecha: (fecha: string) => void
  onElegirHora: (hora: string) => void
  onVolver: () => void
  onAgregarOtro: () => void
  onContinuar: () => void
}) {
  // Agregar este dejaría lugar a por lo menos uno más.
  const entraOtro = yaElegidos + 1 < MAX_TURNOS_POR_GRUPO
  return (
    <div>
      <BotonVolver onClick={onVolver} />
      <Kicker>
        {yaElegidos > 0 ? `Turno ${yaElegidos + 1}` : 'Reserva de turno'}
      </Kicker>
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

      {dias && (
        <GrillaHorarios
          dias={dias}
          fecha={fecha}
          hora={hora}
          onElegirFecha={onElegirFecha}
          onElegirHora={onElegirHora}
        />
      )}

      {/* HU-31 — Los dos botones hacen lo mismo con el turno que se acaba de elegir
          (guardarlo); lo que cambia es a dónde van después. "Agregar otro" solo aparece si
          todavía entra otro, así que reservando un turno solo esta zona es exactamente el
          botón único de siempre. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {entraOtro && (
          <button
            className={`${BTN_GHOST} disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={!fecha || !hora}
            onClick={onAgregarOtro}
          >
            Agregar otro turno
          </button>
        )}
        <button
          className={`${BTN_OUTLINE} flex-1 disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={!fecha || !hora}
          onClick={onContinuar}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}

function PasoDatos({
  turnos,
  telefono,
  email,
  enviando,
  errorTelefonoServidor,
  errorReserva,
  onNombreChange,
  onSacar,
  onTelefonoChange,
  onEmailChange,
  onVolver,
  onSubmit,
}: {
  /** HU-31 — Los turnos elegidos. Con uno solo esta pantalla es la de siempre: un campo
   * "Nombre y apellido" y un resumen de una línea, sin ✕ ni total. */
  turnos: TurnoElegido[]
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
  onNombreChange: (indice: number, v: string) => void
  onSacar: (indice: number) => void
  onTelefonoChange: (v: string) => void
  onEmailChange: (v: string) => void
  onVolver: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const varios = turnos.length > 1
  const [errores, setErrores] = useState<{
    /** Un error por turno, por índice: cada mensaje va pegado a **su** campo. */
    nombres?: (string | undefined)[]
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
    const nombres = turnos.map(({ nombre }) => {
      if (!nombre.trim())
        return varios ? 'Poné el nombre.' : 'Poné tu nombre y apellido.'
      if (!esNombreValido(nombre)) return MENSAJE_NOMBRE_INVALIDO
      return undefined
    })
    if (nombres.some(Boolean)) nuevos.nombres = nombres
    if (!esTelefonoValido(telefono)) nuevos.telefono = MENSAJE_TELEFONO_INVALIDO
    // El email es opcional: solo se valida si escribió algo.
    if (email.trim() && !esEmailValido(email))
      nuevos.email = MENSAJE_EMAIL_INVALIDO

    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    onSubmit(e)
  }

  function limpiarError(campo: 'telefono' | 'email') {
    setErrores((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev))
  }

  function limpiarErrorNombre(indice: number) {
    setErrores((prev) =>
      prev.nombres?.[indice]
        ? {
            ...prev,
            nombres: prev.nombres.map((m, i) => (i === indice ? undefined : m)),
          }
        : prev,
    )
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
      {/* HU-31 — El resumen. Con un turno es la misma línea de siempre; con varios, un
          renglón por turno con su ✕ para sacarlo y el total abajo. */}
      {!varios ? (
        <p className="font-body text-tinta mb-4 opacity-80">
          {turnos[0].servicio.nombre} · {fechaLegible(turnos[0].fecha)} ·{' '}
          {turnos[0].hora}
          {turnos[0].servicio.precio !== null &&
            ` · ${formatearPesos(turnos[0].servicio.precio)}`}
        </p>
      ) : (
        <div className="border-borde mb-4 rounded-md border">
          {turnos.map((t, i) => (
            <div
              key={`${t.fecha}-${t.hora}`}
              className="border-borde flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <span className="font-body text-tinta text-sm opacity-80">
                {t.servicio.nombre} · {fechaLegible(t.fecha)} · {t.hora}
                {t.servicio.precio !== null &&
                  ` · ${formatearPesos(t.servicio.precio)}`}
              </span>
              <button
                type="button"
                onClick={() => onSacar(i)}
                aria-label={`Sacar el turno de ${t.hora}`}
                className="text-tinta-tenue hover:text-vino shrink-0 px-1 text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
          {/* Tres turnos sin total obligan a sumar de cabeza, y los precios ya son
              públicos desde el 14/8/2026. Solo se muestra si están todos cargados: un
              total al que le falta un servicio sin precio sería un número falso. */}
          {turnos.every((t) => t.servicio.precio !== null) && (
            <p className="text-tinta bg-superficie-2 px-3 py-2 text-sm font-semibold">
              Total:{' '}
              {formatearPesos(
                turnos.reduce((acc, t) => acc + (t.servicio.precio ?? 0), 0),
              )}
            </p>
          )}
        </div>
      )}

      <form onSubmit={manejarSubmit} noValidate className="flex flex-col gap-3">
        {turnos.map((t, i) => (
          <label key={`${t.fecha}-${t.hora}`} className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              {varios
                ? `Nombre de quien viene el ${fechaLegible(t.fecha)} a las ${t.hora}`
                : 'Nombre y apellido'}
            </span>
            <input
              value={t.nombre}
              onChange={(e) => {
                onNombreChange(i, e.target.value)
                limpiarErrorNombre(i)
              }}
              placeholder="Ej: Juan Pérez"
              className={claseInput(Boolean(errores.nombres?.[i]))}
            />
            {errores.nombres?.[i] && (
              <ErrorCampo>{errores.nombres[i]}</ErrorCampo>
            )}
          </label>
        ))}
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
          Te abrimos WhatsApp con el mensaje ya escrito para Ariel, con
          {varios ? ' los links de tus turnos adentro' : ' el link de tu turno adentro'}.
          Sin cuenta ni contraseña.
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
