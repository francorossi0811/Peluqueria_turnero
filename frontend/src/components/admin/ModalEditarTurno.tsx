import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { GrillaHorarios } from '../GrillaHorarios'
import { editarTurno } from '../../api/agenda'
import { obtenerDisponibilidadAdmin } from '../../api/disponibilidad'
import { hoyIso, sumarDias, fechaLegible } from '../../utils/fecha'
import type { ErrorApi, TurnoAdmin } from '../../types/api'

const DIAS_A_MOSTRAR = 14

interface ModalEditarTurnoProps {
  turno: TurnoAdmin
  onClose: () => void
}

export function ModalEditarTurno({ turno, onClose }: ModalEditarTurnoProps) {
  const queryClient = useQueryClient()
  const [fecha, setFecha] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const desde = hoyIso()
  const hasta = sumarDias(desde, DIAS_A_MOSTRAR - 1)

  // Endpoint admin, pero **sin** `incluirPasado`: mover un turno a un horario que ya pasó
  // no es lo que HU-08 habilitó (eso es *registrar* algo que ya ocurrió) y sería
  // indistinguible de un error de dedo. Lo que sí hereda de esta ruta es el margen 0: el
  // backend ya lo aceptaba en `editarTurno`, pero esta pantalla pedía la disponibilidad al
  // endpoint del cliente, así que le sobraban los 30 minutos de antelación.
  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad-admin', turno.servicio.id, desde, hasta],
    queryFn: () => obtenerDisponibilidadAdmin([turno.servicio.id], desde, hasta),
  })

  const editarMutation = useMutation({
    mutationFn: () => editarTurno(turno.id, { fecha: fecha!, hora: hora! }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      onClose()
    },
    onError: (err) => {
      const datos = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error
        : null
      const codigo = datos?.codigo

      if (codigo === 'HORARIO_NO_DISPONIBLE') {
        setError('Ese horario se acaba de ocupar. Elegí otro.')
        setHora(null)
        void queryClient.invalidateQueries({ queryKey: ['disponibilidad-admin'] })
        return
      }
      if (codigo === 'TURNO_NO_MODIFICABLE') {
        setError('Este turno ya no está activo.')
        void queryClient.invalidateQueries({ queryKey: ['agenda'] })
        return
      }
      // El backend explica qué fecha u hora está mal, con las palabras que usa esta
      // pantalla (`utils/esquemasFecha.ts`). Sin este paso, ese mensaje moría acá y Ariel
      // veía siempre el genérico de abajo — que no le dice qué corregir.
      if (codigo === 'PARAMETROS_INVALIDOS' && datos?.mensaje) {
        setError(datos.mensaje)
        return
      }
      setError('No pudimos mover el turno. Probá de nuevo.')
    },
  })

  return (
    // "Reprogramar" y no "Editar" (que es como se llama HU-09 puertas adentro): es la
    // palabra que usa Ariel, y lo que la pantalla hace es mover el turno a otro horario.
    // Mecánicamente no es lo mismo que el reprogramar del cliente —acá se mueve el mismo
    // turno, no se crea uno nuevo enlazado— pero esa diferencia es del modelo de datos,
    // no de lo que él está haciendo.
    <Modal titulo="Reprogramar turno" onClose={onClose}>
      {/* El apodo primero, igual que en el detalle del turno: si el modal anterior decía
          "Roja" y este dice "Prueba", parece que se cambió de cliente en el medio. */}
      <p className="text-tinta-suave mb-1 text-sm">
        {turno.servicio.nombre} · {turno.cliente?.apodo || turno.clienteNombre}
      </p>
      <p className="text-tinta-tenue mb-4 text-sm">
        Actualmente: {fechaLegible(turno.fecha)} · {turno.hora}
      </p>

      {error && (
        <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
          {error}
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
          fecha={fecha}
          hora={hora}
          onElegirFecha={(f) => {
            setFecha(f)
            setHora(null)
          }}
          onElegirHora={setHora}
        />
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primaryVino"
          className="flex-1"
          disabled={!fecha || !hora || editarMutation.isPending}
          onClick={() => editarMutation.mutate()}
        >
          {editarMutation.isPending ? 'Guardando…' : 'Guardar nuevo horario'}
        </Button>
      </div>
    </Modal>
  )
}
