import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { GrillaHorarios } from '../GrillaHorarios'
import { obtenerServicios } from '../../api/servicios'
import { obtenerDisponibilidadAdmin } from '../../api/disponibilidad'
import { cargarTurnoManual, cargarTurnosEnGrupoManual } from '../../api/agenda'
import { CamposClienteManual } from './CamposClienteManual'
import { PasoTurnoCargado } from './WhatsappAlCliente'
import { useMinutosAhora } from '../../lib/useMinutosAhora'
import {
  DIAS_CARGA_HACIA_ATRAS,
  fechaLegible,
  hoyIso,
  sumarDias,
  yaPaso,
} from '../../utils/fecha'
import type {
  ErrorApi,
  OrigenManual,
  Servicio,
  TurnoAdmin,
} from '../../types/api'

/** Días hacia adelante, contando hoy. Hacia atrás manda `DIAS_CARGA_HACIA_ATRAS`. */
const DIAS_A_MOSTRAR = 14

interface ModalCargarTurnoProps {
  onClose: () => void
  /** Día y hora del hueco que Ariel tocó en la grilla semanal (HU-23). Ver abajo por qué
   * la hora es una preferencia y no un valor fijo. */
  fechaInicial?: string
  horaInicial?: string
}

/** HU-31 — Un turno del bloque que carga Ariel. No tiene fecha ni hora: el bloque entero
 * comparte día y arranca a una sola hora; la de cada uno la deriva el backend encadenando
 * duraciones, igual que del lado del cliente. */
interface TurnoDelBloque {
  servicio: Servicio
}

/** Los minutos que ocupa el bloque completo — lo que se le pide a la disponibilidad. */
function duracionDelBloque(turnos: TurnoDelBloque[]): number {
  return turnos.reduce((total, t) => total + t.servicio.duracionMinutos, 0)
}

/** A qué hora arranca cada turno del bloque. Solo para mostrar: quien las decide de verdad
 * es el backend, con la misma cuenta. */
function horariosDelBloque(turnos: TurnoDelBloque[], inicio: string): string[] {
  const [h, m] = inicio.split(':').map(Number)
  let minutos = h * 60 + m
  return turnos.map((t) => {
    const actual = minutos
    minutos += t.servicio.duracionMinutos
    return `${String(Math.floor(actual / 60)).padStart(2, '0')}:${String(actual % 60).padStart(2, '0')}`
  })
}

export function ModalCargarTurno({
  onClose,
  fechaInicial,
  horaInicial,
}: ModalCargarTurnoProps) {
  const queryClient = useQueryClient()
  // HU-31 — Los turnos del bloque, en orden. Vacío hasta que Ariel elige el primer
  // servicio; con uno solo —el caso de todos los días— la pantalla es la de siempre.
  const [turnos, setTurnos] = useState<TurnoDelBloque[]>([])
  const [fecha, setFecha] = useState<string | null>(fechaInicial ?? null)
  const [hora, setHora] = useState<string | null>(null)
  // ⚠️ **Uno solo para todo el bloque** (4/9/2026). Antes vivía dentro de cada
  // `TurnoDelBloque` y había que tipear N. Ariel carga esto con la persona enfrente, y
  // mientras tipea, un cliente de la web le puede tomar un rato del medio — el bloque entra
  // entero o no entra, así que cada segundo de tipeo es ventana de choque. Lo que anote se
  // corrige turno por turno desde la agenda (`cambiarNombreDeTurno`).
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null)
  // HU-36 — Los turnos recién cargados, cuando quedaron con ficha: la ventana no se cierra
  // y ofrece mandarle el link al cliente por WhatsApp.
  const [cargados, setCargados] = useState<TurnoAdmin[] | null>(null)

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
  // HU-31 — Se pregunta por **todos** los servicios del bloque: lo que vuelve son las horas
  // de arranque donde entran los N seguidos, no donde entra el primero.
  const idsDelBloque = turnos.map((t) => t.servicio.id)
  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad-admin', idsDelBloque.join(','), desde, hasta],
    queryFn: () =>
      obtenerDisponibilidadAdmin(idsDelBloque, desde, hasta, {
        incluirPasado: true,
      }),
    enabled: idsDelBloque.length > 0,
  })

  // HU-31 — Con un turno sigue yendo por la ruta de siempre; el bloque va por la suya. Así
  // la carga de a uno —lo que Ariel hace todos los días— no pasa por código nuevo.
  const cargarMutation = useMutation({
    mutationFn: () => {
      // Vacío significa "no me lo sé", no un teléfono en blanco. Mismo criterio que el
      // email: se manda `undefined` para no guardar un dato falso en la base.
      const telefono = clienteTelefono.trim() || undefined
      const email = clienteEmail.trim() || undefined
      if (turnos.length === 1) {
        return cargarTurnoManual({
          servicioId: turnos[0].servicio.id,
          fecha: fecha!,
          hora: hora!,
          clienteNombre: clienteNombre.trim(),
          clienteTelefono: telefono,
          clienteEmail: email,
          origen,
        }).then((t) => [t])
      }
      return cargarTurnosEnGrupoManual({
        fecha: fecha!,
        hora: hora!,
        clienteNombre: clienteNombre.trim(),
        clienteTelefono: telefono,
        clienteEmail: email,
        origen,
        turnos: turnos.map((t) => ({ servicioId: t.servicio.id })),
      })
    },
    onSuccess: (creados) => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      // Sin ficha (no se cargó teléfono) no hay a quién mandarle nada: se cierra como
      // siempre.
      if (creados[0]?.cliente) setCargados(creados)
      else onClose()
    },
    onError: (err) => {
      const datos = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error
        : null
      if (datos?.codigo === 'HORARIO_NO_DISPONIBLE') {
        setError('Ese horario se acaba de ocupar. Elegí otro.')
        setHora(null)
        void queryClient.invalidateQueries({
          queryKey: ['disponibilidad-admin'],
        })
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
  // enfrente y sin saberse el número. El nombre es **uno** aunque el bloque tenga seis.
  const listo =
    turnos.length > 0 && fecha && hora && Boolean(clienteNombre.trim())
  const varios = turnos.length > 1
  const horasDelBloque = hora ? horariosDelBloque(turnos, hora) : []

  if (cargados) {
    return (
      <Modal titulo="Turno cargado" onClose={onClose}>
        <PasoTurnoCargado turnos={cargados} onClose={onClose} />
      </Modal>
    )
  }

  return (
    <Modal
      titulo={esPasado ? 'Registrar turno pasado' : 'Cargar turno'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* HU-31 — Un selector por turno. Con uno solo dice "Servicio" y se ve igual que
            siempre; el botón de abajo es lo único nuevo en el caso de todos los días. */}
        {(turnos.length === 0 ? [null] : turnos).map((t, i) => (
          <label key={i} className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              {varios ? `Servicio del turno ${i + 1}` : 'Servicio'}
            </span>
            <select
              value={t?.servicio.id ?? ''}
              onChange={(e) => {
                const elegido = serviciosQuery.data?.find(
                  (x) => x.id === e.target.value,
                )
                if (!elegido) return
                setTurnos((prev) => {
                  const copia = [...prev]
                  if (i < copia.length)
                    copia[i] = { ...copia[i], servicio: elegido }
                  else copia.push({ servicio: elegido })
                  return copia
                })
                // Cambiar un servicio cambia la duración del bloque, así que la hora
                // elegida deja de valer.
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
        ))}

        {/* Sin tope de cantidad: el panel no limita a Ariel (HU-08, HU-28). */}
        {turnos.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTurnos((prev) => [
                  ...prev,
                  { servicio: prev[prev.length - 1].servicio },
                ])
                setHora(null)
              }}
              className="text-miel text-sm font-semibold hover:underline"
            >
              + Otro turno seguido
            </button>
            {varios && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setTurnos((prev) => prev.slice(0, -1))
                    setHora(null)
                  }}
                  className="text-tinta-tenue text-sm hover:underline"
                >
                  Sacar el último
                </button>
                <span className="text-tinta-tenue text-sm">
                  {turnos.length} turnos · {duracionDelBloque(turnos)} min en
                  total
                </span>
              </>
            )}
          </div>
        )}

        {turnos.length > 0 && (
          <div>
            <span className="text-tinta-tenue mb-2 block text-xs tracking-wide uppercase">
              {varios ? 'Día y horario de arranque' : 'Día y horario'}
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
            {/* Un campo, tenga el bloque un turno o seis. Con varios el label lo dice y
                debajo van los horarios, para que se vea que el nombre es de todos. */}
            <CamposClienteManual
              nombre={clienteNombre}
              onNombre={setClienteNombre}
              etiquetaNombre={
                varios
                  ? `Nombre (para los ${turnos.length} turnos)`
                  : 'Nombre y apellido'
              }
              ayudaNombre={
                varios
                  ? `${turnos
                      .map((t, i) => `${horasDelBloque[i]} ${t.servicio.nombre}`)
                      .join(' · ')}. Después podés cambiarle el nombre a cada uno desde la agenda.`
                  : undefined
              }
              telefono={clienteTelefono}
              onTelefono={(v) => {
                setErrorTelefono(null)
                setClienteTelefono(v)
              }}
              errorTelefono={errorTelefono}
              email={clienteEmail}
              onEmail={setClienteEmail}
              origen={origen}
              onOrigen={setOrigen}
            />
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
