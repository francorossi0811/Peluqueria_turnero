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
import { formatearPesos } from '../utils/dinero'
import { TELEFONO_URL, WHATSAPP_URL } from '../utils/contacto'
import { whatsappDeTurno } from '../utils/mensajesWhatsapp'
import { WHATSAPP_AUTOMATICO } from '../utils/avisos'
import type { DatosDelTurno, MotivoWhatsapp } from '../utils/mensajesWhatsapp'
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

/** El link único de gestión, que es lo que el mensaje le da a Ariel para abrir el turno. */
function linkDelTurno(id: string): string {
  return `${window.location.origin}/turno/${id}`
}

/** Salir del sitio hacia el chat de Ariel con el mensaje escrito.
 *
 * ⚠️ `location.href` y no `window.open`: esto corre dentro del `onSuccess` de una
 * mutación, o sea fuera del gesto del usuario, y ahí el bloqueador de pop-ups de Safari
 * se come la pestaña nueva. Con la redirección directa no hay nada que bloquear: en el
 * celular abre la app de WhatsApp y el navegador queda atrás con la página intacta.
 *
 * Va siempre DESPUÉS de que el backend confirmó el cambio. El turno ya está cancelado o
 * reprogramado cuando esto corre, así que si el cliente no llega a mandar el mensaje, lo
 * único que se pierde es el aviso — nunca el cambio. */
function irAWhatsapp(motivo: MotivoWhatsapp, datos: DatosDelTurno): void {
  // Cuando el backend ya avisa por la Cloud API, mandar al cliente a WhatsApp sería
  // pedirle que cuente algo que Ariel ya sabe. Ver `utils/avisos.ts`.
  if (WHATSAPP_AUTOMATICO) return
  window.location.href = whatsappDeTurno(motivo, datos)
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
    queryFn: () => obtenerDisponibilidad([servicioId!], desde, hasta),
    enabled: modo === 'reprogramar' && Boolean(servicioId),
  })

  // ⚠️ Un solo botón hace las dos cosas: cancela el turno de verdad —el `PATCH` libera el
  // horario y lo saca de la agenda— y recién con eso hecho abre WhatsApp para que el
  // cliente le avise a Ariel. Nunca al revés: si abriera el chat primero, el que no llega
  // a mandar el mensaje deja el rato bloqueado sin que nadie se entere.
  //
  // Por eso el aviso dice "Cancelé", en pasado. Cuando el mensaje se escribe, ya pasó.
  const cancelarMutation = useMutation({
    mutationFn: () => cancelarTurno(id),
    onSuccess: (turno) => {
      queryClient.setQueryData(['turno', id], turno)
      setConfirmandoCancelacion(false)
      irAWhatsapp('cancelado', {
        nombre: turno.clienteNombre,
        servicio: turno.servicio.nombre,
        fecha: turno.fecha,
        hora: turno.hora,
        link: linkDelTurno(turno.id),
      })
    },
    onError: () => {
      setErrorAccion('No pudimos cancelar el turno. Probá de nuevo.')
      setConfirmandoCancelacion(false)
    },
  })

  const reprogramarMutation = useMutation({
    mutationFn: () =>
      reprogramarTurno(id, { fecha: fechaNueva!, hora: horaNueva! }),
    // Reprogramar no mueve el turno: crea uno nuevo enlazado al viejo (que queda en
    // `reprogramado`). O sea que el link cambia — el mensaje tiene que llevar el del
    // turno NUEVO, que es el que el cliente va a poder gestionar de acá en más.
    //
    // El `navigate` va igual y va primero: si el cliente vuelve del chat, la pestaña ya
    // está parada en su turno nuevo y no en el viejo, que ya no sirve para nada.
    onSuccess: (nuevoTurno) => {
      // `replace` y no push: el link viejo apunta a un turno que quedó `reprogramado` y
      // ya no se puede gestionar. Dejarlo en el historial es que el botón "atrás" lo
      // traiga de vuelta — el mismo tropiezo que la v3 ya arregló en `LoginPage`.
      navigate(`/turno/${nuevoTurno.id}`, { replace: true })
      irAWhatsapp('reprogramado', {
        nombre: nuevoTurno.clienteNombre,
        servicio: nuevoTurno.servicio.nombre,
        fecha: nuevoTurno.fecha,
        hora: nuevoTurno.hora,
        link: linkDelTurno(nuevoTurno.id),
      })
    },
    onError: (err) => {
      const datos = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error
        : null
      const codigo = datos?.codigo ?? null

      // HU-28 — Los dos topes de la reserva pública valen también acá, que es el otro
      // camino por el que un cliente elige una fecha. Se muestra el mensaje del backend tal
      // cual en vez del genérico de abajo: "no pudimos reprogramar, probá de nuevo" invita
      // a reintentar algo que va a fallar siempre igual, y no dice qué hacer.
      if (
        codigo === 'LIMITE_SEMANAL_ALCANZADO' ||
        codigo === 'FUERA_DE_HORIZONTE'
      ) {
        setErrorAccion(datos!.mensaje)
        return
      }

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

  // Lo que todo mensaje a Ariel necesita saber del turno.
  const datosParaWhatsapp: DatosDelTurno = {
    nombre: turno.clienteNombre,
    servicio: turno.servicio.nombre,
    fecha: turno.fecha,
    hora: turno.hora,
    link: `${window.location.origin}/turno/${turno.id}`,
  }

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
          {turno.servicio.precio !== null &&
            ` · ${formatearPesos(turno.servicio.precio)}`}
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

        {/* Acá el motivo es concreto: si ningún horario de los que quedan le sirve, la
            salida es hablar con Ariel, no volver atrás. */}
        <ContactoAriel datos={datosParaWhatsapp} motivo="pedirReprogramar" />
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
          {turno.servicio.precio !== null &&
            ` · ${formatearPesos(turno.servicio.precio)}`}
        </p>
      </Card>

      {errorAccion && (
        <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
          {errorAccion}
        </div>
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
          {/* ⚠️ Acá NO va ningún botón de cancelar ni de reprogramar, tampoco por
              WhatsApp. Pasados los 60 minutos el sistema ya no toca el turno (CU-03), así
              que un botón que diga "Cancelar por WhatsApp" estaría ofreciendo una acción
              que no ocurre: el que lo toca manda un mensaje, se queda tranquilo, y el
              turno sigue en pie hasta que Ariel lo lea y lo dé de baja a mano. En el resto
              de la pantalla un botón cancela de verdad; que acá uno igual no lo hiciera
              sería la misma palabra queriendo decir dos cosas.

              Lo que queda es hablar con Ariel, que es lo que de verdad puede pasar, y para
              eso están los botones de `ContactoAriel` acá abajo (HU-03). */}
          <div className="border-alerta bg-alerta-suave text-alerta mt-2 rounded-md border px-3 py-2 text-sm">
            Faltan menos de 60 minutos, así que ya no podés cancelar ni
            reprogramar desde acá. Escribile o llamalo a Ariel.
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

      {/* ⚠️ **Este chat abre en blanco, y tiene que seguir así.** Precargaba "mi turno
          quedó confirmado", y estaba mal por dos motivos. Uno: el botón dice "¿Necesitás
          hablar con Ariel?", o sea que el que lo toca quiere decir algo suyo, no volver a
          anunciar un turno del que Ariel ya se enteró. Dos, y peor: esta pantalla es
          justo donde cae el que **acaba de reprogramar**, así que el botón le ofrecía
          mandar una confirmación en el flujo de reprogramación, contando el turno como si
          fuera nuevo y sin decir que se movió.

          La confirmación se manda sola en el único momento en que corresponde: al salir
          del formulario de reserva. Repetirla después es ruido para Ariel. */}
      <ContactoAriel />

      {/* Último a propósito: agendar es lo que se hace una vez y después no se vuelve a
          tocar, mientras que reprogramar, cancelar y escribirle a Ariel son las acciones
          por las que alguien vuelve a esta pantalla. */}
      {turno.estado === 'reservado' && (
        <a
          href={urlCalendario(turno.id)}
          className={`${BTN_OUTLINE} mt-3 w-full`}
        >
          Agregar a mi calendario
        </a>
      )}
    </PaginaCentrada>
  )
}

/** Los dos caminos para hablar con Ariel, siempre a la vista.
 *
 * "Contactá directamente a Ariel" ya se lo decía la pantalla al que llegaba tarde para
 * cancelar, pero sin decirle cómo: el número está en la landing, a la que este cliente
 * no entró — llegó por su link. Van siempre y no solo en ese caso porque el motivo para
 * escribirle no siempre es el turno (llegar tarde, preguntar algo, cambiar el servicio).
 *
 * Los dos son links nativos (`wa.me` y `tel:`), así que en el celular abren la app que
 * corresponde sin que tengamos que detectar nada. */
function ContactoAriel({
  datos,
  motivo = 'confirmado',
}: {
  /** Sin datos el chat abre en blanco, como antes. Con datos abre con el turno escrito:
   * el que escribe casi nunca lo hace en abstracto, lo hace por el turno que tiene
   * abierto en la pantalla, y tipearle a Ariel de qué turno habla es un paso que el
   * sitio ya puede hacer por él. */
  datos?: DatosDelTurno
  motivo?: MotivoWhatsapp
}) {
  const href = datos ? whatsappDeTurno(motivo, datos) : WHATSAPP_URL
  return (
    <div className="border-borde mt-6 border-t pt-4">
      <p className="text-tinta-suave mb-2 text-center text-sm">
        ¿Necesitás hablar con Ariel?
      </p>
      <div className="flex gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`${BTN_OUTLINE} flex-1`}
        >
          WhatsApp
        </a>
        <a href={TELEFONO_URL} className={`${BTN_OUTLINE} flex-1`}>
          Llamar
        </a>
      </div>
    </div>
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
