import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { GrillaHorarios } from '../GrillaHorarios'
import { obtenerServicios } from '../../api/servicios'
import { obtenerDisponibilidad } from '../../api/disponibilidad'
import { cargarTurnoManual } from '../../api/agenda'
import { hoyIso, sumarDias } from '../../utils/fecha'
import type { ErrorApi, Servicio } from '../../types/api'

const DIAS_A_MOSTRAR = 14

interface ModalCargarTurnoProps {
  onClose: () => void
}

export function ModalCargarTurno({ onClose }: ModalCargarTurnoProps) {
  const queryClient = useQueryClient()
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [origen, setOrigen] = useState<'telefono' | 'whatsapp'>('telefono')
  const [error, setError] = useState<string | null>(null)

  const desde = hoyIso()
  const hasta = sumarDias(desde, DIAS_A_MOSTRAR - 1)

  const serviciosQuery = useQuery({
    queryKey: ['servicios'],
    queryFn: obtenerServicios,
  })

  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad', servicio?.id, desde, hasta],
    queryFn: () => obtenerDisponibilidad(servicio!.id, desde, hasta),
    enabled: Boolean(servicio),
  })

  const cargarMutation = useMutation({
    mutationFn: () =>
      cargarTurnoManual({
        servicioId: servicio!.id,
        fecha: fecha!,
        hora: hora!,
        clienteNombre,
        clienteTelefono,
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
        void queryClient.invalidateQueries({ queryKey: ['disponibilidad'] })
        return
      }
      // El backend valida el teléfono y el mail (backend/src/utils/validaciones.ts).
      // Su mensaje dice qué campo está mal; el genérico de abajo dejaría a Ariel
      // adivinando.
      if (datos?.codigo === 'PARAMETROS_INVALIDOS') {
        setError(datos.mensaje)
        return
      }
      setError('No pudimos cargar el turno. Probá de nuevo.')
    },
  })

  const listo = servicio && fecha && hora && clienteNombre && clienteTelefono

  return (
    <Modal titulo="Cargar turno" onClose={onClose}>
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
              setFecha(null)
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
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Teléfono
              </span>
              <input
                required
                type="tel"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
              />
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
                <button
                  type="button"
                  onClick={() => setOrigen('telefono')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    origen === 'telefono'
                      ? 'border-vino bg-vino-suave text-vino'
                      : 'border-borde text-tinta-suave'
                  }`}
                >
                  Teléfono
                </button>
                <button
                  type="button"
                  onClick={() => setOrigen('whatsapp')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    origen === 'whatsapp'
                      ? 'border-vino bg-vino-suave text-vino'
                      : 'border-borde text-tinta-suave'
                  }`}
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </>
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
            {cargarMutation.isPending ? 'Cargando…' : 'Cargar turno'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
