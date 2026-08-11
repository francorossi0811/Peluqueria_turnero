import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { Insignia } from './Insignia'
import { actualizarCliente, obtenerCliente } from '../../api/clientes'
import { obtenerEtiquetas } from '../../api/etiquetas'
import { fechaLegible } from '../../utils/fecha'
import type { EstadoTurno, TurnoDeHistorial } from '../../types/api'

// HU-25 — La ficha editable de un cliente.
//
// Vive en su propio componente y no dentro de un modal porque se muestra en dos lugares
// distintos: la sección Clientes la abre en un modal, y el detalle de un turno la incrusta
// directo. Es el mismo formulario en los dos casos, y tenía que serlo: una ficha que se
// edita distinto según desde dónde la abriste es una ficha que Ariel no va a confiar.

interface FichaClienteProps {
  clienteId: string
  /** El historial de turnos ocupa lugar, y adentro del detalle de un turno es redundante
   * con lo que Ariel está mirando. Se puede apagar. */
  conHistorial?: boolean
}

export function FichaCliente({
  clienteId,
  conHistorial = true,
}: FichaClienteProps) {
  const queryClient = useQueryClient()
  const [apodo, setApodo] = useState<string | null>(null)
  const [notas, setNotas] = useState<string | null>(null)
  const [etiquetaIds, setEtiquetaIds] = useState<string[] | null>(null)
  const [guardado, setGuardado] = useState(false)

  const fichaQuery = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => obtenerCliente(clienteId),
  })
  const etiquetasQuery = useQuery({
    queryKey: ['etiquetas'],
    queryFn: obtenerEtiquetas,
  })

  // El formulario arranca con lo que vino del servidor y de ahí en más es local: si se
  // reinicializara en cada refetch, un refresco de fondo le borraría a Ariel lo que está
  // escribiendo. Por eso la guarda de `=== null` en vez de depender solo de `data`.
  useEffect(() => {
    if (fichaQuery.data && apodo === null) {
      setApodo(fichaQuery.data.apodo ?? '')
      setNotas(fichaQuery.data.notas ?? '')
      setEtiquetaIds(fichaQuery.data.etiquetas.map((e) => e.id))
    }
  }, [fichaQuery.data, apodo])

  const guardarMutation = useMutation({
    mutationFn: () =>
      actualizarCliente(clienteId, {
        apodo,
        notas,
        etiquetaIds: etiquetaIds ?? [],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cliente', clienteId] })
      void queryClient.invalidateQueries({ queryKey: ['clientes'] })
      // La agenda también: las insignias de la grilla salen del turno, así que sin esto
      // Ariel etiqueta a alguien y la grilla sigue mostrándolo igual hasta el próximo
      // refresco.
      void queryClient.invalidateQueries({ queryKey: ['agenda'] })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    },
  })

  if (fichaQuery.isPending || apodo === null || etiquetaIds === null) {
    return <p className="text-tinta-suave text-sm">Cargando la ficha…</p>
  }
  if (fichaQuery.isError || !fichaQuery.data) {
    return <p className="text-vino text-sm">No pudimos cargar la ficha.</p>
  }

  const ficha = fichaQuery.data
  const etiquetas = etiquetasQuery.data ?? []

  const sinCambios =
    apodo === (ficha.apodo ?? '') &&
    notas === (ficha.notas ?? '') &&
    etiquetaIds.length === ficha.etiquetas.length &&
    ficha.etiquetas.every((e) => etiquetaIds.includes(e.id))

  function alternarEtiqueta(id: string) {
    setEtiquetaIds((prev) =>
      prev!.includes(id) ? prev!.filter((x) => x !== id) : [...prev!, id],
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-tinta font-medium">{ficha.nombre}</p>
        <p className="text-tinta-suave text-sm">{ficha.telefono}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-tinta-suave text-sm">
          Cómo le decís vos
          {/* El apodo manda sobre el nombre en toda la interfaz, y conviene decirlo: en la
              planilla Ariel escribe "Flaco" o "Jubilado bici", no el nombre del documento. */}
        </span>
        <input
          value={apodo}
          onChange={(e) => setApodo(e.target.value)}
          placeholder={ficha.nombre}
          maxLength={60}
          className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
        />
      </label>

      <div>
        <p className="text-tinta-suave mb-2 text-sm">Etiquetas</p>
        {etiquetas.length === 0 ? (
          <p className="text-tinta-tenue text-sm">
            Todavía no creaste ninguna. Se crean desde "Etiquetas", en la sección
            Clientes.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {etiquetas.map((etiqueta) => {
              const puesta = etiquetaIds.includes(etiqueta.id)
              return (
                <button
                  key={etiqueta.id}
                  type="button"
                  onClick={() => alternarEtiqueta(etiqueta.id)}
                  aria-pressed={puesta}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    puesta
                      ? 'border-miel bg-miel-suave text-miel font-medium'
                      : 'border-borde bg-superficie text-tinta-suave hover:text-tinta'
                  }`}
                >
                  <Insignia etiqueta={etiqueta} />
                  {etiqueta.nombre}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-tinta-suave text-sm">Observaciones</span>
        <textarea
          value={notas ?? ''}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Le gusta el degradé bajo. Viene con el nene."
          className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button
          disabled={sinCambios || guardarMutation.isPending}
          onClick={() => guardarMutation.mutate()}
        >
          {guardarMutation.isPending ? 'Guardando…' : 'Guardar ficha'}
        </Button>
        {guardado && <span className="text-bien text-sm">Guardado.</span>}
        {guardarMutation.isError && (
          <span className="text-vino text-sm">No pudimos guardar.</span>
        )}
      </div>

      {conHistorial && <Historial turnos={ficha.turnos} />}
    </div>
  )
}

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
  ausente: 'bg-ausente-suave text-ausente',
}

/** El historial completo, sin filtrar por estado.
 *
 * Que un cliente haya cancelado tres veces es justamente lo que Ariel quiere ver al abrir
 * su ficha — esconderlo lo dejaría más prolijo y menos útil. */
function Historial({ turnos }: { turnos: TurnoDeHistorial[] }) {
  return (
    <div className="border-borde border-t pt-4">
      <p className="text-tinta-suave mb-2 text-sm">
        Historial · {turnos.length} {turnos.length === 1 ? 'turno' : 'turnos'}
      </p>
      {turnos.length === 0 ? (
        <p className="text-tinta-tenue text-sm">Todavía no tiene turnos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {turnos.map((turno) => (
            <li
              key={turno.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="text-tinta">
                {fechaLegible(turno.fecha)} · {turno.hora} ·{' '}
                <span className="text-tinta-suave">{turno.servicio.nombre}</span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${ESTILO_ESTADO[turno.estado]}`}
              >
                {ETIQUETA_ESTADO[turno.estado]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
