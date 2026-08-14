import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { FichaCliente } from './FichaCliente'
import { cancelarTurnoAdmin, cargarTelefonoTurno } from '../../api/agenda'
import { esTelefonoValido, MENSAJE_TELEFONO_INVALIDO } from '../../utils/validaciones'
import { fechaLegible } from '../../utils/fecha'
import { ETIQUETA_MEDIO_PAGO, formatearPesos } from '../../utils/dinero'
import { ESTILO_ESTADO, ETIQUETA_ESTADO } from '../../utils/estadoTurno'
import type { ErrorApi, TurnoAdmin } from '../../types/api'

// HU-25 — El detalle de un turno de la grilla.
//
// Antes, tocar un turno en la semana abría directo el modal de reprogramar. Era la acción
// menos frecuente de todas puesta a un toque de distancia, y no había forma de ver quién
// era el cliente sin moverle el horario. Ahora el toque abre esto: primero quién es,
// después qué se puede hacer.
//
// La vista Día no cambia: ahí las acciones están inline en la fila, y ese es el flujo con
// el que Ariel opera durante la jornada. Meterle un modal en el medio sería más lento.

const ETIQUETA_ORIGEN: Record<TurnoAdmin['origen'], string> = {
  online: 'Reservó online',
  telefono: 'Cargado por teléfono',
  whatsapp: 'Cargado por WhatsApp',
}

interface ModalTurnoProps {
  turno: TurnoAdmin
  onClose: () => void
  /** Abre el modal de reprogramar (HU-09) sobre este mismo turno. */
  onReprogramar: () => void
  /** HU-27 — Abre el cobro sobre este turno. Sobre un turno reservado, el modal de cobro
   * hace las dos cosas: lo marca realizado y le guarda el cobro. */
  onCobrar: () => void
  /** HU-12 — Marca el turno como ausente. No abre nada: el que no vino no paga. */
  onMarcarAusente: () => void
  /** Si hay una marca en curso sobre este turno, para no dispararla dos veces. */
  marcando: boolean
}

export function ModalTurno({
  turno,
  onClose,
  onReprogramar,
  onCobrar,
  onMarcarAusente,
  marcando,
}: ModalTurnoProps) {
  const queryClient = useQueryClient()
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelarMutation = useMutation({
    mutationFn: () => cancelarTurnoAdmin(turno.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      onClose()
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null
      setError(mensaje ?? 'No pudimos cancelar el turno.')
    },
  })

  const esReservado = turno.estado === 'reservado'

  return (
    <Modal
      titulo={turno.cliente?.apodo || turno.clienteNombre}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-tinta font-medium">{turno.servicio.nombre}</p>
            <p className="text-tinta-suave text-sm">
              {fechaLegible(turno.fecha)} · {turno.hora}–{turno.horaFin}
            </p>
            <p className="text-tinta-tenue text-xs">
              {ETIQUETA_ORIGEN[turno.origen]}
            </p>
          </div>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${ESTILO_ESTADO[turno.estado]}`}
          >
            {ETIQUETA_ESTADO[turno.estado]}
          </span>
        </div>

        {error && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* HU-27 — El cobro, solo sobre un turno realizado: es el único estado en el que
            hay plata de por medio. Un turno marcado sin registrar el cobro lo dice y
            ofrece cargarlo acá — sin esto quedaría fuera de los totales para siempre,
            que es el mismo agujero que tapó el teléfono en HU-25. */}
        {turno.estado === 'realizado' && (
          <div className="border-borde flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            {turno.medioPago && turno.montoCobrado != null ? (
              <>
                <div>
                  <p className="text-tinta font-medium">
                    {formatearPesos(turno.montoCobrado)}
                  </p>
                  <p className="text-tinta-suave text-sm">
                    {ETIQUETA_MEDIO_PAGO[turno.medioPago]}
                  </p>
                </div>
                <Button variant="ghost" onClick={onCobrar}>
                  Corregir cobro
                </Button>
              </>
            ) : (
              <>
                <p className="text-tinta-suave text-sm">
                  Sin cobro registrado.
                </p>
                <Button variant="outline" onClick={onCobrar}>
                  Registrar cobro
                </Button>
              </>
            )}
          </div>
        )}

        <div className="border-borde border-t pt-4">
          {turno.cliente ? (
            // Sin historial: Ariel llegó acá desde un turno concreto, y la lista entera de
            // sus turnos abajo del que está mirando es más ruido que dato. Para eso está
            // la sección Clientes.
            <FichaCliente clienteId={turno.cliente.id} conHistorial={false} />
          ) : (
            <SinFicha turno={turno} />
          )}
        </div>

        {/* Las acciones, con la misma jerarquía que la fila de la vista Día: "Realizado" y
            "Ausente" son lo que Ariel hace decenas de veces por día y van adelante;
            reprogramar y cancelar son excepciones y quedan sin caja, detrás de un divisor.

            Antes acá solo estaban reprogramar y cancelar, y era un agujero: desde la
            grilla semanal no había forma de cerrar un turno, que es lo más frecuente de
            todo. Había que cambiar a la vista Día para marcarlo. */}
        {esReservado && !confirmandoCancelar && (
          <div className="border-borde flex flex-wrap items-center gap-2 border-t pt-4">
            {/* "Realizado" abre el cobro y desde ahí se guardan las dos cosas juntas
                (HU-27); "Ausente" no pasa por ningún modal porque el que no vino no paga. */}
            <Button variant="primary" onClick={onCobrar} disabled={marcando}>
              Realizado
            </Button>
            <Button
              variant="outline"
              onClick={onMarcarAusente}
              disabled={marcando}
            >
              Ausente
            </Button>

            <span className="bg-borde mx-1 hidden h-6 w-px sm:block" />

            <Button variant="ghost" onClick={onReprogramar}>
              Reprogramar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmandoCancelar(true)}>
              Cancelar turno
            </Button>
          </div>
        )}

        {esReservado && confirmandoCancelar && (
          <div className="border-borde flex flex-wrap items-center gap-2 border-t pt-4">
            <p className="text-tinta text-sm">¿Cancelar este turno?</p>
            <Button
              variant="danger"
              disabled={cancelarMutation.isPending}
              onClick={() => cancelarMutation.mutate()}
            >
              {cancelarMutation.isPending ? 'Cancelando…' : 'Sí, cancelar'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmandoCancelar(false)}
            >
              No, volver
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * El turno se cargó sin teléfono (HU-08), así que no tiene ficha.
 *
 * En vez de mostrar un vacío, se ofrece completarlo acá mismo: en cuanto se guarda, el
 * backend lo engancha con la ficha —creándola si hace falta— y el turno entra a la lista
 * de clientes. Sin esto, todos los turnos que Ariel carga con la persona enfrente
 * quedarían afuera para siempre.
 */
function SinFicha({ turno }: { turno: TurnoAdmin }) {
  const queryClient = useQueryClient()
  // Arranca con el número que el turno ya tenga, para que Ariel corrija en vez de volver a
  // tipear. Con el campo vacío sobre un turno que sí tiene teléfono, la pantalla lo estaba
  // escondiendo.
  const [telefono, setTelefono] = useState(turno.clienteTelefono ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => cargarTelefonoTurno(turno.id, telefono.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      void queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null
      setError(mensaje ?? 'No pudimos guardar el teléfono.')
    },
  })

  // ⚠️ Que no haya ficha no quiere decir que no haya teléfono: son dos cosas distintas y
  // el modal las trataba como una sola. Un turno puede tener el número cargado y seguir
  // sin ficha (los que quedaron de antes de HU-25, que espera el backfill), y ahí el
  // cartel afirmaba "este turno no tiene teléfono" con el número escrito al lado.
  const yaTieneTelefono = Boolean(turno.clienteTelefono)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-tinta font-medium">{turno.clienteNombre}</p>
      <p className="text-tinta-suave text-sm">
        {yaTieneTelefono
          ? `Este turno tiene el teléfono ${turno.clienteTelefono} pero todavía no tiene ficha. Confirmá el número y se crea sola.`
          : 'Este turno no tiene teléfono, así que todavía no tiene ficha. Cargalo y se crea sola.'}
      </p>

      {error && <p className="text-vino text-sm">{error}</p>}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!esTelefonoValido(telefono.trim())) {
            setError(MENSAJE_TELEFONO_INVALIDO)
            return
          }
          setError(null)
          mutation.mutate()
        }}
      >
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="351 459 3325"
          inputMode="tel"
          className="border-borde bg-superficie text-tinta min-w-[10rem] flex-1 rounded-md border px-3 py-2.5 text-base"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!telefono.trim() || mutation.isPending}
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  )
}
