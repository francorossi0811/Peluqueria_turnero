import { useState } from 'react'
import { Button } from '../ui/Button'
import { ETIQUETA_MEDIO_PAGO, formatearPesos } from '../../utils/dinero'
import { ESTILO_ESTADO, ETIQUETA_ESTADO } from '../../utils/estadoTurno'
import type { TurnoAdmin } from '../../types/api'

const ETIQUETA_ORIGEN: Record<TurnoAdmin['origen'], string> = {
  online: 'Online',
  presencial: 'Presencial',
  llamada: 'Llamada',
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
            // Rojo, el mismo `ahora` que el recuadro de la fila y que la línea de la hora
            // actual en la grilla: las tres cosas dicen lo mismo y son un solo color. El
            // azul quedó entero para "Nuevo", así que en esta fila no hay dos carteles del
            // mismo color diciendo cosas distintas.
            //
            // El borde va a 2 px (era 1) por lo mismo que todo el resto del panel: con la
            // letra de 16 px, un contorno de 1 px se pierde.
            <span className="border-ahora text-ahora inline-block rounded-full border-2 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Ahora
            </span>
          )}
          {/* Azul, el mismo del cartel de la grilla: "nuevo" es una sola cosa y no puede
              tener un color acá y otro allá. Era miel, que además es el acento de marca y
              aparece en media pantalla. */}
          {sinVer && (
            <span className="bg-nuevo text-sobre-estado inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
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
