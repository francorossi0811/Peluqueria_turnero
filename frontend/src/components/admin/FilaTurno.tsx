import { useState } from 'react'
import { Button } from '../ui/Button'
import { ETIQUETA_MEDIO_PAGO, formatearPesos } from '../../utils/dinero'
import type { EstadoTurno, TurnoAdmin } from '../../types/api'

const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  reservado: 'Reservado',
  cancelado: 'Cancelado',
  reprogramado: 'Reprogramado',
  realizado: 'Realizado',
  ausente: 'Ausente',
}

/** Los mismos tres colores que la grilla: miel lo que viene, verde lo que se hizo, rojo el
 * que no vino. `ausente` usaba `alerta` (ámbar-naranja) y en la grilla usaba un neutro:
 * eran tres colores distintos para el mismo estado según dónde lo miraras. */
const ESTILO_ESTADO: Record<EstadoTurno, string> = {
  reservado: 'bg-miel-suave text-miel',
  cancelado: 'bg-borde-suave text-tinta-tenue',
  reprogramado: 'bg-borde-suave text-tinta-tenue',
  realizado: 'bg-bien-suave text-bien',
  ausente: 'bg-ausente-suave text-ausente',
}

const ETIQUETA_ORIGEN: Record<TurnoAdmin['origen'], string> = {
  online: 'Online',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
}

interface FilaTurnoProps {
  turno: TurnoAdmin
  /** Si este turno está ocurriendo en este momento. Lo decide la página, que es la que
   * sabe qué día se está mirando y qué hora es. */
  enCurso?: boolean
  onEditar: () => void
  onCancelar: () => void
  onMarcarEstado: (estado: 'realizado' | 'ausente') => void
  /** HU-27 — Abre el cobro sobre este turno, para cargarlo o corregirlo. */
  onCobrar: () => void
  cancelando: boolean
  marcando: boolean
}

export function FilaTurno({
  turno,
  enCurso = false,
  onEditar,
  onCancelar,
  onMarcarEstado,
  onCobrar,
  cancelando,
  marcando,
}: FilaTurnoProps) {
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const esReservado = turno.estado === 'reservado'

  // HU-17 — Un turno sin ver se destaca con el borde del acento, para que salte a la
  // vista en un día cargado sin necesidad de leer fila por fila.
  const sinVer = !turno.vistoPorAdmin

  // El turno en curso **no se tiñe**, igual que en la grilla: se marca con el borde más
  // grueso y la insignia "Ahora". Si se pintara, su color dejaría de decir su estado.
  return (
    <div
      className={`rounded-lg p-3 shadow-sm ${
        enCurso
          ? 'border-ahora border-[3px]'
          : sinVer
            ? 'border-miel bg-destacado border'
            : 'border-borde bg-superficie-2 border'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-tinta font-medium">
            {turno.hora}–{turno.horaFin} · {turno.servicio.nombre}
          </p>
          {/* Sin el condicional queda un " · " colgando cuando Ariel cargó el turno sin
              teléfono (HU-08). */}
          <p className="text-tinta-suave text-sm">
            {turno.clienteNombre}
            {turno.clienteTelefono && ` · ${turno.clienteTelefono}`}
          </p>
          <p className="text-tinta-tenue text-xs">
            {ETIQUETA_ORIGEN[turno.origen]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enCurso && (
            <span className="border-ahora text-ahora inline-block rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Ahora
            </span>
          )}
          {sinVer && (
            <span className="bg-miel text-sobre-acento inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Nuevo
            </span>
          )}
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${ESTILO_ESTADO[turno.estado]}`}
          >
            {ETIQUETA_ESTADO[turno.estado]}
          </span>
        </div>
      </div>

      {/* Las cuatro acciones pesaban lo mismo y competían entre sí. Ahora hay jerarquía:
          "Realizado" y "Ausente" son lo que Ariel hace todos los días, decenas de veces,
          y quedan adelante y destacadas; "Editar" y "Cancelar" son excepciones y pasan a
          la derecha, sin caja, separadas por un divisor. */}
      {esReservado && !confirmandoCancelar && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => onMarcarEstado('realizado')}
            disabled={marcando}
          >
            Realizado
          </Button>
          <Button
            variant="outline"
            onClick={() => onMarcarEstado('ausente')}
            disabled={marcando}
          >
            Ausente
          </Button>

          <span className="bg-borde mx-1 hidden h-6 w-px sm:block" />

          <Button variant="ghost" onClick={onEditar}>
            Reprogramar
          </Button>
          <Button variant="ghost" onClick={() => setConfirmandoCancelar(true)}>
            Cancelar
          </Button>
        </div>
      )}

      {/* HU-27 — El cobro de un turno ya realizado, en la vista Día.
          Tiene que estar acá y no solo en el detalle de la grilla: las filas del día no
          abren ningún modal —a propósito, ver ModalTurno— así que sin esto un cobro que
          quedó pendiente solo se podría completar yéndose a la vista Semana, que es
          justo la que Ariel no usa en el celular. */}
      {turno.estado === 'realizado' && (
        <div className="border-borde mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          {turno.medioPago && turno.montoCobrado != null ? (
            <>
              <p className="text-tinta-suave text-sm">
                <span className="text-tinta font-medium">
                  {formatearPesos(turno.montoCobrado)}
                </span>{' '}
                · {ETIQUETA_MEDIO_PAGO[turno.medioPago]}
              </p>
              <Button variant="ghost" onClick={onCobrar}>
                Corregir cobro
              </Button>
            </>
          ) : (
            <>
              <p className="text-tinta-suave text-sm">Sin cobro registrado.</p>
              <Button variant="outline" onClick={onCobrar}>
                Registrar cobro
              </Button>
            </>
          )}
        </div>
      )}

      {esReservado && confirmandoCancelar && (
        <div className="border-borde mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <p className="text-tinta text-sm">¿Cancelar este turno?</p>
          <Button
            variant="danger"
            disabled={cancelando}
            onClick={() => {
              onCancelar()
              setConfirmandoCancelar(false)
            }}
          >
            {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmandoCancelar(false)}>
            No, volver
          </Button>
        </div>
      )}
    </div>
  )
}
