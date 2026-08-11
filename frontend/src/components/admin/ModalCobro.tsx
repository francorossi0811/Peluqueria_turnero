import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { marcarEstadoTurno, registrarCobroTurno } from '../../api/agenda'
import { obtenerServiciosAdmin } from '../../api/servicios'
import { ETIQUETA_MEDIO_PAGO, formatearPesos } from '../../utils/dinero'
import type {
  ErrorApi,
  EstadoTurno,
  MedioPago,
  Servicio,
} from '../../types/api'

// HU-27 — Cómo le pagaron este turno.
//
// Se abre desde el botón "Realizado", que es el gesto que Ariel ya hace decenas de veces
// por día: el cobro se cuelga de ahí en vez de ser un paso nuevo aparte, que es la forma
// más segura de que se olvide. Sobre un turno que ya está realizado, el mismo modal sirve
// para cargarle el cobro que quedó pendiente o para corregirlo.
//
// Los cuatro medios son botones grandes y no un `<select>`: Ariel usa lentes, esto lo hace
// con el cliente enfrente, y un desplegable son dos toques y una lista chica.

const MEDIOS: MedioPago[] = [
  'efectivo',
  'transferencia',
  'mercado_pago',
  'tarjeta',
]

/**
 * Lo que el modal necesita de un turno, y nada más.
 *
 * Se declara así en vez de pedir un `TurnoAdmin` porque lo abren dos pantallas con formas
 * distintas: la agenda, que trae el turno entero, y la sección Cobros, que trae una
 * versión recortada. Pedir el tipo grande obligaría a que la lista de cobros arrastrara
 * teléfono, email y etiquetas para nada.
 */
export interface TurnoACobrar {
  id: string
  hora: string
  estado: EstadoTurno
  clienteNombre: string
  cliente: { apodo: string | null } | null
  /** El `id` es el que decide el precio que se prellena — el de hoy, no el de la reserva. */
  servicio: Servicio
  medioPago: MedioPago | null
  montoCobrado: number | null
}

interface ModalCobroProps {
  turno: TurnoACobrar
  onClose: () => void
}

export function ModalCobro({ turno, onClose }: ModalCobroProps) {
  const queryClient = useQueryClient()

  // El turno llega `reservado` cuando esto se abrió desde "Realizado", y `realizado`
  // cuando Ariel viene a completar o corregir un cobro. Es la única diferencia entre los
  // dos usos, así que se deduce del turno en vez de pedir un prop que puede mentir.
  const alMarcar = turno.estado === 'reservado'

  // ⚠️ El precio se lee **ahora**, no de un snapshot guardado al reservar. La duración sí
  // se congela (decide la disponibilidad y moverla correría turnos ya agendados), pero el
  // precio no afecta nada hasta este momento: con inflación, un turno reservado hace tres
  // semanas se cobra al precio de hoy. Ver `turnos.monto_cobrado` en el esquema.
  const servicios = useQuery({
    queryKey: ['servicios-admin'],
    queryFn: obtenerServiciosAdmin,
  })
  const precioActual =
    servicios.data?.find((s) => s.id === turno.servicio.id)?.precio ?? null

  const [medioPago, setMedioPago] = useState<MedioPago | null>(
    turno.medioPago ?? null,
  )
  // Texto y no número: mientras Ariel borra para escribir otro monto, el campo pasa por
  // vacío, y un `useState<number>` lo convertiría en 0.
  const [monto, setMonto] = useState<string | null>(
    turno.montoCobrado != null ? String(turno.montoCobrado) : null,
  )
  const [error, setError] = useState<string | null>(null)

  // El prellenado espera a que llegue el precio, pero no pisa lo que Ariel haya escrito:
  // `null` es "todavía no tocó nada", y ahí sí manda el precio del servicio.
  const montoEnPantalla =
    monto ?? (precioActual != null ? String(precioActual) : '')
  const montoNumero = Number(montoEnPantalla)
  const montoValido =
    montoEnPantalla.trim() !== '' &&
    Number.isInteger(montoNumero) &&
    montoNumero >= 0

  function alTerminar() {
    void queryClient.invalidateQueries({ queryKey: ['agenda'] })
    void queryClient.invalidateQueries({ queryKey: ['cobros'] })
    onClose()
  }

  function alFallar(err: unknown, porDefecto: string) {
    const mensaje = isAxiosError<ErrorApi>(err)
      ? err.response?.data.error.mensaje
      : null
    setError(mensaje ?? porDefecto)
  }

  const guardar = useMutation({
    mutationFn: () => {
      const cobro = { medioPago: medioPago!, montoCobrado: montoNumero }
      return alMarcar
        ? marcarEstadoTurno(turno.id, 'realizado', cobro)
        : registrarCobroTurno(turno.id, cobro)
    },
    onSuccess: alTerminar,
    onError: (err) => alFallar(err, 'No pudimos guardar el cobro.'),
  })

  // La salida: marcar el turno como realizado sin decir cómo pagó. Existe porque el
  // flujo más frecuente del día no puede quedar trabado por un dato que a veces no está
  // (el cliente paga después, o Ariel está apurado). El turno queda visible como "sin
  // registrar" en la sección Cobros, y se completa desde ahí o desde su detalle.
  const marcarSinCobro = useMutation({
    mutationFn: () => marcarEstadoTurno(turno.id, 'realizado'),
    onSuccess: alTerminar,
    onError: (err) => alFallar(err, 'No pudimos marcar el turno.'),
  })

  const guardando = guardar.isPending || marcarSinCobro.isPending

  return (
    <Modal titulo="¿Cómo pagó?" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-tinta font-medium">
            {turno.cliente?.apodo || turno.clienteNombre}
          </p>
          <p className="text-tinta-suave text-sm">
            {turno.servicio.nombre} · {turno.hora}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Medio de pago
          </span>
          <div className="grid grid-cols-2 gap-2">
            {MEDIOS.map((medio) => (
              <button
                key={medio}
                type="button"
                onClick={() => setMedioPago(medio)}
                aria-pressed={medioPago === medio}
                className={`rounded-md border px-4 py-4 text-base font-semibold transition ${
                  medioPago === medio
                    ? 'border-miel-fuerte bg-miel-fuerte text-sobre-acento'
                    : 'border-borde bg-superficie text-tinta hover:bg-superficie-2'
                }`}
              >
                {ETIQUETA_MEDIO_PAGO[medio]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Monto
          </span>
          <div className="flex items-center gap-2">
            <span className="text-tinta-suave text-lg">$</span>
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              value={montoEnPantalla}
              onChange={(e) => setMonto(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel w-full rounded-md border px-3 py-2.5 text-lg"
            />
          </div>
          {/* Que el monto salga del precio del servicio se dice, no se asume: si Ariel lo
              cambia acá, está haciendo un descuento en este turno y no tocando la lista. */}
          {precioActual != null ? (
            <span className="text-tinta-tenue text-xs">
              {turno.servicio.nombre} sale {formatearPesos(precioActual)}. Podés
              cambiarlo solo para este turno.
            </span>
          ) : (
            <span className="text-tinta-tenue text-xs">
              Este servicio todavía no tiene precio cargado — se lo podés poner en
              "Horarios y servicios".
            </span>
          )}
        </label>

        {error && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            disabled={!medioPago || !montoValido || guardando}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending
              ? 'Guardando…'
              : alMarcar
                ? 'Marcar realizado y cobrado'
                : 'Guardar cobro'}
          </Button>
          {alMarcar && (
            <Button
              variant="ghost"
              disabled={guardando}
              onClick={() => marcarSinCobro.mutate()}
            >
              {marcarSinCobro.isPending
                ? 'Marcando…'
                : 'Marcar sin registrar el cobro'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
