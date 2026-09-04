import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Kicker } from '../../components/ui/Kicker'
import { Modal } from '../../components/ui/Modal'
import { Insignia, Insignias } from '../../components/admin/Insignia'
import { FichaCliente } from '../../components/admin/FichaCliente'
import { ModalEtiquetas } from '../../components/admin/ModalEtiquetas'
import { obtenerClientes } from '../../api/clientes'
import { obtenerEtiquetas } from '../../api/etiquetas'
import { fechaLegible } from '../../utils/fecha'
import type { ClienteResumen } from '../../types/api'

// HU-25 — La lista de clientes.
//
// Existe en la aplicación y no como una integración con Drive por una razón concreta: de
// Drive lo que le servía a Ariel era poder abrir la planilla desde el celular o desde la
// computadora del local, y eso una aplicación web ya se lo da. Lo que faltaba era poder
// llevarse los datos, y eso lo cubre el botón de exportar.

export function ClientesPage() {
  const [buscar, setBuscar] = useState('')
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null)
  const [fichaAbierta, setFichaAbierta] = useState<ClienteResumen | null>(null)
  const [modalEtiquetas, setModalEtiquetas] = useState(false)

  const filtros = {
    buscar: buscar.trim() || undefined,
    etiquetaId: etiquetaId ?? undefined,
  }

  const clientesQuery = useQuery({
    queryKey: ['clientes', filtros.buscar ?? '', filtros.etiquetaId ?? ''],
    queryFn: () => obtenerClientes(filtros),
  })
  const etiquetasQuery = useQuery({
    queryKey: ['etiquetas'],
    queryFn: obtenerEtiquetas,
  })

  const clientes = clientesQuery.data ?? []

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Panel de Ariel</Kicker>
          <h1 className="font-hero text-tinta mb-1 text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
            Clientes
          </h1>
          <p className="text-tinta-suave text-sm">
            Una ficha por teléfono. Dos turnos con el mismo número son la misma
            persona.
          </p>
        </div>
        <Button variant="outline" onClick={() => setModalEtiquetas(true)}>
          Etiquetas
        </Button>
      </div>

      <div className="mb-5 flex flex-col gap-3">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por apodo, nombre o teléfono"
          className="border-borde bg-superficie text-tinta w-full rounded-md border px-3 py-2.5 text-base"
        />

        {(etiquetasQuery.data ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEtiquetaId(null)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                etiquetaId === null
                  ? 'border-miel bg-miel-suave text-miel font-medium'
                  : 'border-borde bg-superficie text-tinta-suave hover:text-tinta'
              }`}
            >
              Todos
            </button>
            {etiquetasQuery.data?.map((etiqueta) => (
              <button
                key={etiqueta.id}
                onClick={() =>
                  setEtiquetaId((prev) =>
                    prev === etiqueta.id ? null : etiqueta.id,
                  )
                }
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  etiquetaId === etiqueta.id
                    ? 'border-miel bg-miel-suave text-miel font-medium'
                    : 'border-borde bg-superficie text-tinta-suave hover:text-tinta'
                }`}
              >
                <Insignia etiqueta={etiqueta} />
                {etiqueta.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {clientesQuery.isPending && (
        <p className="text-tinta-suave">Cargando clientes…</p>
      )}
      {clientesQuery.isError && (
        <p className="text-vino">No pudimos cargar los clientes.</p>
      )}
      {clientesQuery.data && clientes.length === 0 && (
        <p className="text-tinta-suave text-sm">
          {buscar || etiquetaId
            ? 'Ningún cliente coincide con eso.'
            : 'Todavía no hay fichas. Se crean solas con cada turno que tenga teléfono.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {clientes.map((cliente) => (
          <FilaCliente
            key={cliente.id}
            cliente={cliente}
            onAbrir={() => setFichaAbierta(cliente)}
          />
        ))}
      </div>

      {fichaAbierta && (
        <Modal
          titulo={fichaAbierta.apodo || fichaAbierta.nombre}
          onClose={() => setFichaAbierta(null)}
        >
          <FichaCliente clienteId={fichaAbierta.id} />
        </Modal>
      )}
      {modalEtiquetas && (
        <ModalEtiquetas
          onClose={() => setModalEtiquetas(false)}
          // ⚠️ Si el filtro apuntaba a la etiqueta que se acaba de borrar, hay que
          // soltarlo acá: el chip para desactivarlo se dibuja a partir de la lista de
          // etiquetas, así que desaparece junto con ella y deja la lista filtrada por un
          // id que ya no existe —vacía— y sin ningún control para volver atrás.
          onBorrada={(id) =>
            setEtiquetaId((actual) => (actual === id ? null : actual))
          }
        />
      )}
    </div>
  )
}

function FilaCliente({
  cliente,
  onAbrir,
}: {
  cliente: ClienteResumen
  onAbrir: () => void
}) {
  return (
    <button
      onClick={onAbrir}
      className="border-borde bg-superficie-2 hover:border-miel flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-left transition"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* El apodo va primero y en grande: es el nombre con el que Ariel piensa a esa
              persona. El nombre que tipeó el cliente queda al lado, en chico, porque sirve
              para reconocerlo pero no es como lo llama. */}
          <p className="text-tinta font-medium">
            {cliente.apodo || cliente.nombre}
          </p>
          {cliente.apodo && (
            <span className="text-tinta-tenue text-sm">{cliente.nombre}</span>
          )}
          <Insignias etiquetas={cliente.etiquetas} />
        </div>
        <p className="text-tinta-suave text-sm">{cliente.telefono}</p>
      </div>
      <div className="text-right">
        <p className="text-tinta-suave text-sm">
          {cliente.visitas} {cliente.visitas === 1 ? 'visita' : 'visitas'}
        </p>
        <p className="text-tinta-tenue text-xs">
          {cliente.proximoTurno
            ? `Próximo: ${fechaLegible(cliente.proximoTurno)}`
            : cliente.ultimaVisita
              ? `Última: ${fechaLegible(cliente.ultimaVisita)}`
              : 'Sin turnos hechos'}
        </p>
      </div>
    </button>
  )
}
