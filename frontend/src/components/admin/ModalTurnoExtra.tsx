import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { InputHora } from '../ui/InputHora'
import { CamposClienteManual } from './CamposClienteManual'
import { PasoTurnoCargado } from './WhatsappAlCliente'
import { obtenerServicios } from '../../api/servicios'
import { cargarTurnoExtra } from '../../api/agenda'
import { useMinutosAhora } from '../../lib/useMinutosAhora'
import {
  etiquetaDiaCorta,
  fechaLegible,
  hoyIso,
  minutosDeHora,
  yaPaso,
} from '../../utils/fecha'
import {
  aHoraTexto,
  FIN_DEL_DIA_MINUTOS,
  type OpcionExtra,
} from '../../utils/turnoExtra'
import type {
  ErrorApi,
  OrigenManual,
  Servicio,
  TurnoAdmin,
} from '../../types/api'

interface ModalTurnoExtraProps {
  /** Los días que ofrece el "+", cada uno con su rato: `cierre` es cuando termina la
   * franja, `tope` hasta dónde puede llegar (la franja siguiente o la medianoche) y `hora`
   * dónde lo propone (pegado al último turno extra, o al cierre). */
  opciones: OpcionExtra[]
  /** El día ya elegido (el "+" de abajo de un día), o `null` para que la ventana pregunte:
   * es el "+" de la columna de horas, que no señala ninguno. Ahí se muestra **siempre** el
   * selector y **sin ningún día marcado** (pedido de Franco, 11/11/2026): antes cargaba
   * solo para hoy, y un día marcado de entrada se carga sin mirarlo. */
  fechaInicial: string | null
  onClose: () => void
}

/**
 * HU-35 — Cargar un turno **fuera de horario**: Ariel se queda después del cierre para uno
 * más, solo ese día.
 *
 * No usa la grilla de disponibilidad de `ModalCargarTurno`, y es a propósito: esa grilla
 * sale del horario laboral, que es justo lo que este turno excede. La hora viene puesta
 * por el "+" (pegada al último turno) y Ariel la puede correr; lo que se le avisa antes de
 * mandar es que el turno entre antes del tope. Quien decide igual es el backend
 * (`POST /api/admin/turnos/extra`).
 */
export function ModalTurnoExtra({
  opciones,
  fechaInicial,
  onClose,
}: ModalTurnoExtraProps) {
  const queryClient = useQueryClient()
  const conSelector = fechaInicial === null
  const [fecha, setFecha] = useState(fechaInicial)
  const opcion = opciones.find((o) => o.fecha === fecha) ?? null
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [hora, setHora] = useState(opcion ? aHoraTexto(opcion.boton.hora) : '')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null)
  // HU-36 — El turno recién cargado, cuando quedó con ficha (ver `ModalCargarTurno`).
  const [cargado, setCargado] = useState<TurnoAdmin | null>(null)

  const hoy = hoyIso()
  const minutosAhora = useMinutosAhora()
  const esPasado =
    fecha !== null && hora !== '' && yaPaso(fecha, hora, hoy, minutosAhora)
  // HU-08 — Igual que la carga de siempre: un turno que ya pasó es casi siempre alguien que
  // Ariel atendió en el local, así que arranca en "Presencial".
  const [origen, setOrigen] = useState<OrigenManual>(() =>
    esPasado ? 'presencial' : 'llamada',
  )

  const serviciosQuery = useQuery({
    queryKey: ['servicios'],
    queryFn: obtenerServicios,
  })

  const cierre = opcion?.boton.cierre ?? 0
  const tope = opcion?.boton.tope ?? 0
  const inicio = hora ? minutosDeHora(hora) : 0
  const fin = opcion && servicio ? inicio + servicio.duracionMinutos : null
  // Lo que el backend va a rechazar, dicho antes de mandar y con palabras de la pantalla.
  const problemaDeHora = !opcion
    ? null
    : inicio < cierre
      ? `Un turno fuera de horario arranca a las ${aHoraTexto(cierre)} o después. Para antes, usá "Cargar turno".`
      : fin !== null && fin > tope
        ? tope === FIN_DEL_DIA_MINUTOS
          ? 'Ese turno pasaría de las 23:59, que es lo más tarde que se puede cargar.'
          : `Ese turno terminaría a las ${aHoraTexto(fin)} y a las ${aHoraTexto(tope)} abre la tarde.`
        : null

  const cargarMutation = useMutation({
    mutationFn: () =>
      cargarTurnoExtra({
        servicioId: servicio!.id,
        fecha: fecha!,
        hora,
        clienteNombre: clienteNombre.trim(),
        clienteTelefono: clienteTelefono.trim() || undefined,
        clienteEmail: clienteEmail.trim() || undefined,
        origen,
      }),
    onSuccess: (creado) => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      if (creado.cliente) setCargado(creado)
      else onClose()
    },
    onError: (err) => {
      const datos = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error
        : null
      // Se ramifica por `codigo`, nunca por status: los dos son 409 y dicen cosas
      // distintas (ver la regla de `ReservarPage` en CLAUDE.md). En ninguno se borra lo
      // tipeado: lo único que hay que cambiar es la hora.
      if (datos?.codigo === 'HORARIO_NO_DISPONIBLE') {
        setError('Ese rato ya lo ocupa otro turno. Elegí otra hora.')
        return
      }
      if (datos?.codigo === 'HORARIO_EXTRA_INVALIDO') {
        setError(datos.mensaje)
        return
      }
      if (datos?.codigo === 'PARAMETROS_INVALIDOS') {
        if (clienteTelefono.trim()) setErrorTelefono(datos.mensaje)
        else setError(datos.mensaje)
        return
      }
      setError('No pudimos cargar el turno. Probá de nuevo.')
    },
  })

  const listo =
    opcion !== null &&
    servicio !== null &&
    Boolean(clienteNombre.trim()) &&
    problemaDeHora === null

  if (cargado) {
    return (
      <Modal titulo="Turno cargado" onClose={onClose}>
        <PasoTurnoCargado turnos={[cargado]} onClose={onClose} />
      </Modal>
    )
  }

  return (
    <Modal titulo="Turno fuera de horario" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {conSelector && (
          <div className="flex flex-col gap-2">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Día
            </span>
            <div className="flex flex-wrap gap-2">
              {opciones.map((o) => (
                <button
                  key={o.fecha}
                  type="button"
                  aria-pressed={o.fecha === fecha}
                  onClick={() => {
                    // Cada día tiene su propio rato (el sábado cierra más tarde) y su
                    // propia hora sugerida, pegada a sus extras: cambiar de día la
                    // vuelve a proponer.
                    const horaNueva = aHoraTexto(o.boton.hora)
                    setError(null)
                    setFecha(o.fecha)
                    setHora(horaNueva)
                    // HU-08 — Como en la carga de siempre: un día que ya pasó es casi
                    // siempre alguien que Ariel atendió en el local.
                    setOrigen(
                      yaPaso(o.fecha, horaNueva, hoy, minutosAhora)
                        ? 'presencial'
                        : 'llamada',
                    )
                  }}
                  className={`rounded-md border px-3 py-2 text-base font-semibold transition ${
                    o.fecha === fecha
                      ? 'border-miel-fuerte bg-miel-fuerte text-sobre-acento'
                      : 'border-borde bg-superficie text-tinta hover:bg-superficie-2'
                  }`}
                >
                  {o.fecha === hoy ? 'Hoy' : etiquetaDiaCorta(o.fecha)}
                </button>
              ))}
            </div>
          </div>
        )}

        {opcion ? (
          <>
            <p className="text-tinta-suave text-sm">
              {fechaLegible(opcion.fecha)} · después del cierre de las{' '}
              {aHoraTexto(cierre)}. Los clientes no ven este horario en la web.
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Servicio
              </span>
              <select
                value={servicio?.id ?? ''}
                onChange={(e) => {
                  setError(null)
                  setServicio(
                    serviciosQuery.data?.find((s) => s.id === e.target.value) ??
                      null,
                  )
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

            <div className="flex flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Hora
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <InputHora
                  value={hora}
                  onChange={(v) => {
                    setError(null)
                    setHora(v)
                  }}
                  etiqueta="el turno fuera de horario"
                />
                {fin !== null && problemaDeHora === null && (
                  <span className="text-tinta-suave text-sm">
                    Termina a las {aHoraTexto(fin)}
                  </span>
                )}
              </div>
              {problemaDeHora && (
                <span className="text-vino text-xs">{problemaDeHora}</span>
              )}
            </div>

            {servicio && (
              <CamposClienteManual
                nombre={clienteNombre}
                onNombre={setClienteNombre}
                etiquetaNombre="Nombre y apellido"
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
            )}

            {/* HU-08 — Mismo aviso que la carga de siempre: un extra de un día que ya pasó es
            un registro, no un turno que viene. */}
            {esPasado && (
              <div className="border-alerta bg-alerta-suave text-alerta rounded-md border px-3 py-2 text-sm">
                <p className="font-semibold">
                  ⚠ Estás registrando un turno que YA PASÓ
                </p>
                <p className="mt-0.5">
                  {fechaLegible(opcion.fecha)} · {hora}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-tinta-suave text-sm">
            Elegí el día del turno fuera de horario. Los clientes no ven este
            horario en la web.
          </p>
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
                : 'Cargar turno extra'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
