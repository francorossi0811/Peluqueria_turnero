import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { GrillaHorarios } from '../GrillaHorarios'
import { obtenerServicios } from '../../api/servicios'
import { obtenerDisponibilidadAdmin } from '../../api/disponibilidad'
import { cargarTurnoManual } from '../../api/agenda'
import { elegirContacto, soportaElegirContacto } from '../../lib/contactos'
import { useMinutosAhora } from '../../lib/useMinutosAhora'
import {
  esTelefonoValido,
  MENSAJE_TELEFONO_INVALIDO,
} from '../../utils/validaciones'
import {
  DIAS_CARGA_HACIA_ATRAS,
  fechaLegible,
  hoyIso,
  sumarDias,
  yaPaso,
} from '../../utils/fecha'
import type { ErrorApi, OrigenManual, Servicio } from '../../types/api'

/** Días hacia adelante, contando hoy. Hacia atrás manda `DIAS_CARGA_HACIA_ATRAS`. */
const DIAS_A_MOSTRAR = 14

interface ModalCargarTurnoProps {
  onClose: () => void
  /** Día y hora del hueco que Ariel tocó en la grilla semanal (HU-23). Ver abajo por qué
   * la hora es una preferencia y no un valor fijo. */
  fechaInicial?: string
  horaInicial?: string
}

export function ModalCargarTurno({
  onClose,
  fechaInicial,
  horaInicial,
}: ModalCargarTurnoProps) {
  const queryClient = useQueryClient()
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [fecha, setFecha] = useState<string | null>(fechaInicial ?? null)
  const [hora, setHora] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null)

  const hoy = hoyIso()
  const minutosAhora = useMinutosAhora()
  const desde = sumarDias(hoy, -DIAS_CARGA_HACIA_ATRAS)
  // ⚠️ Se cuenta desde HOY, no desde `desde`. Con `sumarDias(desde, …)` la ventana entera
  // se correría una semana para atrás y desaparecerían los últimos 7 días futuros, sin que
  // nada falle ni avise.
  const hasta = sumarDias(hoy, DIAS_A_MOSTRAR - 1)

  // HU-08 — Un turno cargado sobre un horario que ya pasó es, casi siempre, el cliente de
  // vidriera que Ariel atendió y está registrando ahora. Arrancar en 'presencial' le
  // evita corregir el origen todas las veces.
  const esPasado = Boolean(
    fecha && hora && yaPaso(fecha, hora, hoy, minutosAhora),
  )
  const [origen, setOrigen] = useState<OrigenManual>('llamada')
  useEffect(() => {
    if (esPasado) setOrigen('presencial')
  }, [esPasado])

  const serviciosQuery = useQuery({
    queryKey: ['servicios'],
    queryFn: obtenerServicios,
  })

  // ⚠️ Clave distinta a la de la reserva pública (`['disponibilidad', …]`) a propósito: el
  // mismo servicio y el mismo rango devuelven contenidos distintos según la ruta, y
  // compartir cache entre las dos sería el bug más difícil de encontrar de todo esto.
  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad-admin', servicio?.id, desde, hasta],
    queryFn: () =>
      obtenerDisponibilidadAdmin(servicio!.id, desde, hasta, {
        incluirPasado: true,
      }),
    enabled: Boolean(servicio),
  })

  const cargarMutation = useMutation({
    mutationFn: () =>
      cargarTurnoManual({
        servicioId: servicio!.id,
        fecha: fecha!,
        hora: hora!,
        clienteNombre,
        // Vacío significa "no me lo sé", no un teléfono en blanco. Mismo criterio que el
        // email: se manda `undefined` para no guardar un dato falso en la base.
        clienteTelefono: clienteTelefono.trim() || undefined,
        clienteEmail: clienteEmail.trim() || undefined,
        origen,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      onClose()
    },
    onError: (err) => {
      const datos = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error
        : null
      if (datos?.codigo === 'HORARIO_NO_DISPONIBLE') {
        setError('Ese horario se acaba de ocupar. Elegí otro.')
        setHora(null)
        void queryClient.invalidateQueries({ queryKey: ['disponibilidad-admin'] })
        return
      }
      // El backend valida el teléfono y el mail (backend/src/utils/validaciones.ts).
      // Su mensaje dice qué campo está mal; el genérico de abajo dejaría a Ariel
      // adivinando.
      //
      // El del teléfono va **pegado al input** y no en el cartel de abajo: es el único
      // campo donde el backend es más estricto que lo que se puede chequear acá (necesita
      // la metadata de características de `libphonenumber-js`), así que es el error que
      // más veces va a aparecer, y a 40 cm del campo no se entiende de cuál habla.
      if (datos?.codigo === 'PARAMETROS_INVALIDOS') {
        if (clienteTelefono.trim()) setErrorTelefono(datos.mensaje)
        else setError(datos.mensaje)
        return
      }
      setError('No pudimos cargar el turno. Probá de nuevo.')
    },
  })

  async function completarDesdeContactos() {
    try {
      const contacto = await elegirContacto()
      if (!contacto) return
      if (contacto.telefono) setClienteTelefono(contacto.telefono)
      // El nombre solo se completa si Ariel todavía no escribió uno, para no pisarle lo
      // que ya venía tipeando.
      if (contacto.nombre && !clienteNombre.trim())
        setClienteNombre(contacto.nombre)
    } catch {
      // Cancelar el selector nativo también entra por acá. No es un error que valga la
      // pena mostrar: el campo se puede tipear igual.
    }
  }

  // Cuando el modal se abre desde un hueco de la grilla ya sabemos qué día y qué hora
  // quiere Ariel, pero **la hora no se puede dar por buena**: la disponibilidad depende
  // de la duración del servicio, y el servicio se elige después. Un corte de 20 min entra
  // en un hueco donde un corte + barba de 35 no.
  //
  // Por eso la hora entra como *preferencia*: se aplica sola si sigue libre para el
  // servicio elegido, y si no, el hueco queda sin elegir y Ariel ve la grilla normal.
  // Nunca se manda al backend una hora que va a rechazar.
  useEffect(() => {
    if (!horaInicial || hora || fecha !== fechaInicial) return
    const dia = disponibilidadQuery.data?.find((d) => d.fecha === fecha)
    if (dia?.horarios.includes(horaInicial)) setHora(horaInicial)
  }, [horaInicial, fechaInicial, fecha, hora, disponibilidadQuery.data])

  // El teléfono ya no bloquea el alta: Ariel suele cargar el turno con el cliente
  // enfrente y sin saberse el número.
  const listo = servicio && fecha && hora && clienteNombre

  return (
    <Modal
      titulo={esPasado ? 'Registrar turno pasado' : 'Cargar turno'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Servicio
          </span>
          <select
            value={servicio?.id ?? ''}
            onChange={(e) => {
              const s = serviciosQuery.data?.find(
                (x) => x.id === e.target.value,
              )
              setServicio(s ?? null)
              setFecha(fechaInicial ?? null)
              setHora(null)
            }}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          >
            <option value="" disabled>
              Elegí un servicio…
            </option>
            {serviciosQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} ({s.duracionMinutos} min)
              </option>
            ))}
          </select>
        </label>

        {servicio && (
          <div>
            <span className="text-tinta-tenue mb-2 block text-xs tracking-wide uppercase">
              Día y horario
            </span>
            {disponibilidadQuery.isPending && (
              <p className="text-tinta-suave text-sm">
                Cargando disponibilidad…
              </p>
            )}
            {disponibilidadQuery.isError && (
              <p className="text-vino text-sm">
                No pudimos cargar la disponibilidad.
              </p>
            )}
            {disponibilidadQuery.data && (
              <GrillaHorarios
                dias={disponibilidadQuery.data}
                fecha={fecha}
                hora={hora}
                onElegirFecha={(f) => {
                  setFecha(f)
                  setHora(null)
                }}
                onElegirHora={setHora}
                pasado={{ hoy, minutosAhora }}
              />
            )}
          </div>
        )}

        {fecha && hora && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Nombre y apellido
              </span>
              <input
                required
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                  Teléfono (opcional)
                </span>
                {/* Solo aparece donde funciona de verdad: Chrome en Android. En la
                    computadora del mostrador ni se renderiza, así que no hay un botón
                    que no haga nada. */}
                {soportaElegirContacto() && (
                  <button
                    type="button"
                    onClick={completarDesdeContactos}
                    className="text-miel text-xs font-medium hover:opacity-80"
                  >
                    Elegir de mis contactos
                  </button>
                )}
              </div>
              <input
                type="tel"
                value={clienteTelefono}
                onChange={(e) => {
                  setErrorTelefono(null)
                  setClienteTelefono(e.target.value)
                }}
                placeholder="Si no lo sabés, dejalo vacío"
                className={`bg-superficie text-tinta rounded-md border px-3 py-2 outline-none ${
                  errorTelefono
                    ? 'border-vino'
                    : 'border-borde focus:border-miel'
                }`}
              />
              {errorTelefono ? (
                <span className="text-vino text-xs">{errorTelefono}</span>
              ) : (
                // Chequeo laxo local, solo para el caso obvio (letras, muy corto). El de
                // verdad lo hace el backend: saber si una característica existe necesita
                // metadata que no vale traer al bundle.
                clienteTelefono.trim() !== '' &&
                !esTelefonoValido(clienteTelefono) && (
                  <span className="text-vino text-xs">
                    {MENSAJE_TELEFONO_INVALIDO}
                  </span>
                )
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Email (opcional)
              </span>
              <input
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                placeholder="Si te lo dicta, le llega la confirmación"
                className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
              />
            </label>
            <div>
              <span className="text-tinta-tenue mb-2 block text-xs tracking-wide uppercase">
                Origen
              </span>
              <div className="flex gap-2">
                {(
                  [
                    ['presencial', 'Presencial'],
                    ['llamada', 'Llamada'],
                    ['whatsapp', 'WhatsApp'],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setOrigen(valor)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                      origen === valor
                        ? 'border-vino bg-vino-suave text-vino'
                        : 'border-borde text-tinta-suave'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* HU-08 — Lo último que Ariel lee antes de confirmar. Va acá, pegado al botón, y
            no arriba de todo: para cuando llegó hasta acá ya se olvidó de qué chip tocó. */}
        {esPasado && (
          <div className="border-alerta bg-alerta-suave text-alerta rounded-md border px-3 py-2 text-sm">
            <p className="font-semibold">
              ⚠ Estás registrando un turno que YA PASÓ
            </p>
            <p className="mt-0.5">
              {fechaLegible(fecha!)} · {hora}
            </p>
          </div>
        )}

        {error && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primaryVino"
            className="flex-1"
            disabled={!listo || cargarMutation.isPending}
            onClick={() => cargarMutation.mutate()}
          >
            {cargarMutation.isPending
              ? 'Cargando…'
              : esPasado
                ? 'Registrar turno pasado'
                : 'Cargar turno'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
