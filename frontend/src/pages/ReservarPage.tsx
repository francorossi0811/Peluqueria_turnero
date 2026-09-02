import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BotonVolver } from '../components/ui/BotonVolver'
import { Kicker } from '../components/ui/Kicker'
import { BTN_OUTLINE, BTN_GHOST } from '../components/ui/estilosBoton'
import { GrillaHorarios } from '../components/GrillaHorarios'
import { Chip } from '../components/ui/Chip'
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
import type { DisponibilidadDia, ErrorApi, Servicio, Turno } from '../types/api'
// import type { Turno } from '../types/api' // lo usa `PasoConfirmacion`, comentado abajo

type Paso = 'servicio' | 'cuantos' | 'horario' | 'datos' | 'confirmacion'

const DIAS_A_MOSTRAR = 14

/** HU-31 — Cuántos turnos entran en un bloque. Tiene que ser el mismo número que
 * `MAX_TURNOS_POR_GRUPO` del backend, que es quien lo aplica de verdad: acá solo decide
 * cuántos botones dibuja el paso "¿cuántos turnos?". */
const MAX_TURNOS_POR_GRUPO = 6

/** HU-31 — Un turno del bloque. Guarda el `servicio` entero y no solo el id porque hacen
 * falta las tres cosas: la duración para calcular el bloque, y el nombre y el precio para
 * el resumen.
 *
 * ⚠️ **No tiene fecha ni hora.** El bloque entero comparte día y arranca a una sola hora;
 * la de cada turno la deriva el backend encadenando duraciones. Guardarlas acá sería tener
 * dos fuentes para el mismo dato, y la de la pantalla podría quedar vieja. */
interface TurnoElegido {
  servicio: Servicio
  /** El de cada hijo. Se completa en el paso de datos, todos juntos. */
  nombre: string
}

/** Los minutos que dura el bloque completo — lo que se le pide a la disponibilidad. */
function duracionDelBloque(turnos: TurnoElegido[]): number {
  return turnos.reduce((total, t) => total + t.servicio.duracionMinutos, 0)
}

/** "HH:mm" + minutos -> "HH:mm". Para mostrar a qué hora termina el bloque y a qué hora
 * arranca cada turno adentro. Es el espejo de `horariosDelBloque` del backend, pero solo
 * para **mostrar**: quien decide las horas de verdad es el backend. */
function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** A qué hora arranca cada turno del bloque, para el resumen y los labels. */
function horariosDelBloque(turnos: TurnoElegido[], inicio: string): string[] {
  let hora = inicio
  return turnos.map((t) => {
    const actual = hora
    hora = sumarMinutos(hora, t.servicio.duracionMinutos)
    return actual
  })
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
  // HU-31 — Los turnos del bloque, en orden. Con uno solo —el caso normal— toda la pantalla
  // se comporta exactamente como antes.
  const [turnos, setTurnos] = useState<TurnoElegido[]>([])
  // El día y la hora de arranque son del **bloque**, no de cada turno.
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
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

  // HU-31 — Se pregunta por **todos** los servicios del bloque: lo que vuelve son los
  // horarios donde entra el bloque completo, no donde entra el primero.
  const idsDelBloque = turnos.map((t) => t.servicio.id)
  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad', idsDelBloque.join(','), desde, hasta],
    queryFn: () => obtenerDisponibilidad(idsDelBloque, desde, hasta),
    enabled: idsDelBloque.length > 0,
  })

  // Preselecciona el primer día con horarios, para no dejar la grilla vacía sin motivo.
  //
  // ⚠️ Mira los días **ya filtrados**: con los del backend podría caer en un día que el
  // grupo dejó sin horarios libres.
  useEffect(() => {
    if (fecha || !disponibilidadQuery.data) return
    const primerDiaConHorarios = disponibilidadQuery.data.find(
      (d) => d.horarios.length > 0,
    )
    if (primerDiaConHorarios) setFecha(primerDiaConHorarios.fecha)
  }, [disponibilidadQuery.data, fecha])

  // HU-31 — Un turno solo sigue yendo por `crearTurno` y el endpoint de siempre; el grupo
  // va por el suyo. El caso normal no toca una línea de código nueva del backend.
  const crearTurnoMutation = useMutation({
    mutationFn: async (elegidos: TurnoElegido[]): Promise<Turno[]> => {
      const email = clienteEmail.trim() || undefined
      if (elegidos.length === 1) {
        const turno = await crearTurno({
          servicioId: elegidos[0].servicio.id,
          fecha: fecha!,
          hora: hora!,
          clienteNombre: elegidos[0].nombre,
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
        fecha: fecha!,
        hora: hora!,
        turnos: elegidos.map((t) => ({
          servicioId: t.servicio.id,
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

      if (datos?.codigo === 'HORARIO_NO_DISPONIBLE') {
        // HU-31 — Con un bloque, lo que se ocupó no es "uno de los turnos": es el rato
        // entero. Así que vuelve a elegir **un** horario, con el bloque intacto — no hay
        // nada que rehacer salvo la hora de arranque.
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
    // HU-31 — El servicio de la landing arranca un bloque de uno. El paso siguiente pregunta
    // cuántos son, que es lo primero que hay que saber: la disponibilidad depende de la
    // duración del bloque entero.
    setTurnos([{ servicio: elegido, nombre: '' }])
    setFecha(null)
    setHora(null)
    setPaso('cuantos')
    // La landing es larga y el click sale de la grilla de servicios, allá abajo: sin
    // esto el wizard aparece con la página scrolleada a la mitad.
    window.scrollTo({ top: 0 })
  }

  // La landing NO es otra ruta: es el primer paso de esta misma página, que vive en "/".
  // Por eso "volver al inicio" no puede ser un <Link to="/"> — navegar a la ruta en la
  // que ya estás no remonta nada y el paso queda donde estaba (el botón no hacía nada).
  // Volver al inicio es resetear el wizard.
  /** HU-31 — Cuántos turnos va a sacar. Arma la lista repitiendo el servicio que ya eligió
   * en la landing; después puede cambiarle el servicio a cada uno.
   *
   * Repetir el primero es el default correcto: el caso que motivó esto es la mamá que trae a
   * los hijos al mismo corte. Quien necesite otro lo cambia con el selector. */
  function elegirCantidad(cantidad: number) {
    const base = turnos[0]
    if (!base) return
    setTurnos(
      Array.from({ length: cantidad }, (_, i) => turnos[i] ?? { ...base, nombre: '' }),
    )
    // La hora vieja puede no servir para un bloque más largo: se vuelve a elegir.
    setHora(null)
    setErrorHorario(null)
    // ⚠️ **No** cambia de paso. Elegir la cantidad es la mitad de este paso; la otra mitad
    // es decir qué se hace cada uno, y los selectores recién aparecen acá. Saltando al
    // horario, la mamá que trae dos varones y una nena no tenía dónde pedir el corte de
    // mujer para la tercera.
  }

  /** Cambia el servicio de uno de los turnos del bloque. Cambia la duración total, así que
   * el horario elegido deja de valer. */
  function cambiarServicio(indice: number, servicio: Servicio) {
    setTurnos((prev) =>
      prev.map((t, i) => (i === indice ? { ...t, servicio } : t)),
    )
    setHora(null)
  }

  function volverAlInicio() {
    setPaso('servicio')
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

  /** HU-31 — Saca uno del bloque desde el resumen del paso de datos.
   *
   * Sin esto, el único arreglo de "me equivoqué, somos dos y no tres" sería empezar de cero
   * — el mismo agujero que taparon `PATCH …/telefono` (HU-25) y `PATCH …/cobro` (HU-27).
   *
   * ⚠️ Sacar uno **acorta el bloque**, así que la hora elegida puede ya no ser la mejor (y
   * el bloque más corto entra en más lugares). Se vuelve a elegir horario en vez de asumir
   * que la vieja sigue sirviendo. */
  function sacarDelBloque(indice: number) {
    setErrorReserva(null)
    const quedan = turnos.filter((_, i) => i !== indice)
    setTurnos(quedan)
    setHora(null)
    if (quedan.length === 0) {
      setFecha(null)
      setPaso('servicio')
      window.scrollTo({ top: 0 })
    } else {
      setPaso('horario')
    }
  }

  function cambiarNombre(indice: number, valor: string) {
    setTurnos((prev) =>
      prev.map((t, i) => (i === indice ? { ...t, nombre: valor } : t)),
    )
  }

  if (paso === 'servicio') {
    return (
      <Landing query={serviciosQuery} onElegir={elegirServicio} />
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

        {paso === 'cuantos' && turnos.length > 0 && (
          <PasoCuantos
            turnos={turnos}
            servicios={serviciosQuery.data ?? []}
            onElegirCantidad={elegirCantidad}
            onCambiarServicio={cambiarServicio}
            onVolver={() => setPaso('servicio')}
            onContinuar={() => setPaso('horario')}
          />
        )}

        {paso === 'horario' && turnos.length > 0 && (
          <PasoHorario
            turnos={turnos}
            query={disponibilidadQuery}
            fecha={fecha}
            hora={hora}
            error={errorHorario}
            onElegirFecha={(f) => {
              setFecha(f)
              setHora(null)
            }}
            onElegirHora={setHora}
            onVolver={() => setPaso('cuantos')}
            onContinuar={() => {
              setErrorHorario(null)
              setPaso('datos')
            }}
          />
        )}

        {paso === 'datos' && turnos.length > 0 && (
          <PasoDatos
            turnos={turnos}
            fecha={fecha!}
            horaInicio={hora!}
            telefono={clienteTelefono}
            email={clienteEmail}
            enviando={crearTurnoMutation.isPending || redirigiendo}
            errorTelefonoServidor={errorTelefonoServidor}
            errorReserva={errorReserva}
            onNombreChange={cambiarNombre}
            onSacar={sacarDelBloque}
            onTelefonoChange={(v) => {
              // Tocar el número borra el rechazo del servidor: si no, el error queda
              // pegado mientras la persona ya lo está corrigiendo.
              setErrorTelefonoServidor(null)
              setClienteTelefono(v)
            }}
            onEmailChange={setClienteEmail}
            onVolver={() => {
              // Volver a la grilla limpia el cartel: elegir otra fecha es una salida real
              // para el tope semanal (un día fuera de esos 7) y para el horizonte. El
              // bloque queda intacto: lo único que se vuelve a elegir es cuándo empieza.
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

/** HU-31 — "¿Cuántos turnos querés sacar?", el paso que abre el bloque.
 *
 * Va primero porque es lo que hay que saber antes de poder buscar horario: la disponibilidad
 * de un bloque depende de su duración total, así que preguntarlo después obligaría a
 * recalcular todo.
 *
 * Con 1 —el caso normal— la pantalla es una fila de botones y "Continuar": un click de más
 * respecto de antes, y a cambio deja de existir el flujo de ir agregando turnos de a uno. */
function PasoCuantos({
  turnos,
  servicios,
  onElegirCantidad,
  onCambiarServicio,
  onVolver,
  onContinuar,
}: {
  turnos: TurnoElegido[]
  servicios: Servicio[]
  onElegirCantidad: (cantidad: number) => void
  onCambiarServicio: (indice: number, servicio: Servicio) => void
  onVolver: () => void
  onContinuar: () => void
}) {
  const total = duracionDelBloque(turnos)
  const conPrecio = turnos.every((t) => t.servicio.precio !== null)

  return (
    <div>
      <BotonVolver onClick={onVolver} />
      <Kicker>Reserva de turno</Kicker>
      <h1 className="font-hero text-tinta mb-2 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
        ¿Cuántos turnos?
      </h1>
      <p className="font-body text-tinta mb-4 opacity-75">
        Si venís con más gente, sacá todos los turnos de una. Los agendamos
        seguidos, uno atrás del otro.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: MAX_TURNOS_POR_GRUPO }, (_, i) => i + 1).map(
          (n) => (
            <Chip
              key={n}
              selected={turnos.length === n}
              onClick={() => onElegirCantidad(n)}
            >
              {n}
            </Chip>
          ),
        )}
      </div>

      {/* Con más de uno hay que poder decir qué se hace cada uno: la mamá que trae dos
          varones y una nena no lleva el mismo servicio para los tres. El primero viene de
          la landing y se puede cambiar igual. */}
      <div className="flex flex-col gap-3">
        {turnos.map((t, i) => (
          <label key={i} className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              {turnos.length > 1 ? `Turno ${i + 1}` : 'Servicio'}
            </span>
            <select
              value={t.servicio.id}
              onChange={(e) => {
                const elegido = servicios.find((s) => s.id === e.target.value)
                if (elegido) onCambiarServicio(i, elegido)
              }}
              className={claseInput(false)}
            >
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} · {s.duracionMinutos} min
                  {s.precio !== null && ` · ${formatearPesos(s.precio)}`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {turnos.length > 1 && (
        <p className="text-tinta mt-4 text-sm">
          <span className="font-semibold">En total: {total} minutos</span>
          {conPrecio &&
            ` · ${formatearPesos(turnos.reduce((acc, t) => acc + (t.servicio.precio ?? 0), 0))}`}
        </p>
      )}

      <button
        className={`${BTN_OUTLINE} mt-6 w-full`}
        onClick={onContinuar}
      >
        Elegir horario
      </button>
    </div>
  )
}

function PasoHorario({
  turnos,
  query,
  fecha,
  hora,
  error,
  onElegirFecha,
  onElegirHora,
  onVolver,
  onContinuar,
}: {
  /** El bloque entero: hace falta la duración total para el título y el rango. */
  turnos: TurnoElegido[]
  query: ReturnType<typeof useQuery<DisponibilidadDia[]>>
  fecha: string | null
  hora: string | null
  error: string | null
  onElegirFecha: (fecha: string) => void
  onElegirHora: (hora: string) => void
  onVolver: () => void
  onContinuar: () => void
}) {
  const varios = turnos.length > 1
  const total = duracionDelBloque(turnos)
  const precioTotal = turnos.every((t) => t.servicio.precio !== null)
    ? turnos.reduce((acc, t) => acc + (t.servicio.precio ?? 0), 0)
    : null

  // ⚠️ Un bloque grande puede no entrar en NINGÚN lado: seis turnos de 30 minutos son 180, y
  // la franja de la mañana dura exactamente eso. Sin este cartel, la persona ve una grilla
  // vacía día tras día y no tiene forma de saber que el problema es el tamaño del bloque y
  // no la agenda de Ariel.
  const sinLugarEnTodoElRango =
    varios && query.data !== undefined && query.data.every((d) => d.horarios.length === 0)

  return (
    <div>
      <BotonVolver onClick={onVolver} />
      <Kicker>Reserva de turno</Kicker>
      <h1 className="font-hero text-tinta mb-2 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-extrabold">
        {varios ? `${turnos.length} turnos seguidos` : turnos[0].servicio.nombre}
      </h1>
      <p className="font-body text-tinta mb-4 opacity-75">
        {varios
          ? `${turnos.map((t) => t.servicio.nombre).join(' + ')} · ${total} min en total`
          : `Elegí el día y el horario para tu turno · ${total} min`}
        {precioTotal !== null && ` · ${formatearPesos(precioTotal)}`}
      </p>

      {varios && (
        <p className="text-tinta-tenue mb-4 text-sm">
          Buscamos un hueco donde entren los {turnos.length} seguidos. La hora
          que elijas es la del primero.
        </p>
      )}

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

      {sinLugarEnTodoElRango && (
        <div className="border-miel bg-destacado text-tinta mb-4 rounded-md border px-3 py-2 text-sm">
          No hay ningún hueco donde entren {turnos.length} turnos seguidos
          ({total} minutos) en estos días. Probá con menos turnos, o escribinos
          por WhatsApp y lo acomodamos.
        </div>
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

      {/* Con un bloque, la hora elegida es la de arranque: decir hasta cuándo va evita que
          alguien reserve tres turnos creyendo que ocupa solo los primeros 20 minutos. */}
      {varios && hora && (
        <p className="text-tinta mt-3 text-sm">
          Quedan de <span className="font-semibold">{hora}</span> a{' '}
          <span className="font-semibold">{sumarMinutos(hora, total)}</span>.
        </p>
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
  turnos,
  fecha,
  horaInicio,
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
  /** El día y la hora de arranque del bloque. Vienen de arriba y no de cada turno: la hora
   * de cada uno se deriva encadenando duraciones. */
  fecha: string
  horaInicio: string
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
  // Las horas de cada turno del bloque, derivadas. Es solo para mostrar: quien las decide
  // de verdad es el backend, con la misma cuenta.
  const horas = horariosDelBloque(turnos, horaInicio)
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
          {turnos[0].servicio.nombre} · {fechaLegible(fecha)} · {horaInicio}
          {turnos[0].servicio.precio !== null &&
            ` · ${formatearPesos(turnos[0].servicio.precio)}`}
        </p>
      ) : (
        <div className="border-borde mb-4 rounded-md border">
          {/* El día va una sola vez: los turnos del bloque son todos del mismo. */}
          <p className="border-borde text-tinta border-b px-3 py-2 text-sm font-semibold">
            {fechaLegible(fecha)}
          </p>
          {turnos.map((t, i) => (
            <div
              key={i}
              className="border-borde flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <span className="font-body text-tinta text-sm opacity-80">
                {t.servicio.nombre} · {horas[i]}
                {t.servicio.precio !== null &&
                  ` · ${formatearPesos(t.servicio.precio)}`}
              </span>
              <button
                type="button"
                onClick={() => onSacar(i)}
                aria-label={`Sacar el turno de ${horas[i]}`}
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
          <label key={i} className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              {varios
                ? `Nombre de quien viene a las ${horas[i]} (${t.servicio.nombre})`
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
