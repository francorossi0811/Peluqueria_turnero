import { useState } from 'react'
import { Button } from '../ui/Button'
import type { EstadoTurno, TurnoAdmin } from '../../types/api'

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

const ETIQUETA_ORIGEN: Record<TurnoAdmin['origen'], string> = {
  online: 'Online',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
}

interface FilaTurnoProps {
  turno: TurnoAdmin
  onEditar: () => void
  onCancelar: () => void
  onMarcarEstado: (estado: 'realizado' | 'ausente') => void
  cancelando: boolean
  marcando: boolean
}

export function FilaTurno({
  turno,
  onEditar,
  onCancelar,
  onMarcarEstado,
  cancelando,
  marcando,
}: FilaTurnoProps) {
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const esReservado = turno.estado === 'reservado'

  // HU-17 — Un turno sin ver se destaca con el borde del acento, para que salte a la
  // vista en un día cargado sin necesidad de leer fila por fila.
  const sinVer = !turno.vistoPorAdmin

  return (
    <div
      className={`rounded-lg border p-3 ${
        sinVer
          ? 'border-miel bg-destacado shadow-sm'
          : 'border-borde bg-superficie-2'
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
            Editar
          </Button>
          <Button variant="ghost" onClick={() => setConfirmandoCancelar(true)}>
            Cancelar
          </Button>
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
