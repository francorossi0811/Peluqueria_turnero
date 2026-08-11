import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import {
  actualizarEtiqueta,
  crearEtiqueta,
  eliminarEtiqueta,
  obtenerEtiquetas,
} from '../../api/etiquetas'
import type { ErrorApi, Etiqueta } from '../../types/api'

// HU-25 — Ariel se arma sus propias insignias.
//
// No es un catálogo cerrado a propósito: la planilla usa un color para marcar clientes
// porque es lo único que Sheets sabe hacer, y heredar esa limitación sería quedarnos con
// lo peor de la planilla. Acá el color lo elige él y el significado lo escribe.
//
// El color arranca en el ámbar de la marca en vez de en negro (el default de
// `<input type="color">`), que sobre el panel oscuro es una insignia invisible.
const COLOR_INICIAL = '#b68235'

interface ModalEtiquetasProps {
  onClose: () => void
}

export function ModalEtiquetas({ onClose }: ModalEtiquetasProps) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLOR_INICIAL)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({ queryKey: ['etiquetas'], queryFn: obtenerEtiquetas })

  // Todo cambio de etiquetas invalida también a los clientes y a la agenda: una insignia
  // renombrada o borrada se ve en los tres lados a la vez.
  function invalidarTodo() {
    void queryClient.invalidateQueries({ queryKey: ['etiquetas'] })
    void queryClient.invalidateQueries({ queryKey: ['clientes'] })
    void queryClient.invalidateQueries({ queryKey: ['agenda'] })
  }

  function mostrarError(err: unknown, porDefecto: string) {
    const mensaje = isAxiosError<ErrorApi>(err)
      ? err.response?.data.error.mensaje
      : null
    setError(mensaje ?? porDefecto)
  }

  const crearMutation = useMutation({
    mutationFn: () => crearEtiqueta({ nombre: nombre.trim(), color }),
    onSuccess: () => {
      setNombre('')
      setColor(COLOR_INICIAL)
      setError(null)
      invalidarTodo()
    },
    onError: (err) => mostrarError(err, 'No pudimos crear la etiqueta.'),
  })

  const editarMutation = useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: Partial<Etiqueta> }) =>
      actualizarEtiqueta(id, datos),
    onSuccess: () => {
      setError(null)
      invalidarTodo()
    },
    onError: (err) => mostrarError(err, 'No pudimos guardar el cambio.'),
  })

  const borrarMutation = useMutation({
    mutationFn: eliminarEtiqueta,
    onSuccess: () => {
      setError(null)
      invalidarTodo()
    },
    onError: (err) => mostrarError(err, 'No pudimos borrar la etiqueta.'),
  })

  return (
    <Modal titulo="Etiquetas" onClose={onClose}>
      <p className="text-tinta-suave mb-4 text-sm">
        Son las marcas que le ponés a un cliente. El círculo de color se ve en la
        agenda sin abrir el turno; el nombre, al abrirlo.
      </p>

      {error && (
        <div className="border-vino bg-vino-suave text-vino mb-4 rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form
        className="border-borde mb-5 flex flex-wrap items-end gap-2 border-b pb-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (nombre.trim()) crearMutation.mutate()
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-tinta-suave text-xs">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Color de la etiqueta"
            className="border-borde h-11 w-14 cursor-pointer rounded-md border bg-transparent p-1"
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className="text-tinta-suave text-xs">Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Suele cancelar"
            maxLength={40}
            className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
          />
        </label>
        <Button type="submit" disabled={!nombre.trim() || crearMutation.isPending}>
          {crearMutation.isPending ? 'Agregando…' : 'Agregar'}
        </Button>
      </form>

      {query.isPending && <p className="text-tinta-suave">Cargando…</p>}
      {query.data?.length === 0 && (
        <p className="text-tinta-suave text-sm">
          Todavía no creaste ninguna etiqueta.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {query.data?.map((etiqueta) => (
          <FilaEtiqueta
            key={etiqueta.id}
            etiqueta={etiqueta}
            guardando={
              editarMutation.isPending &&
              editarMutation.variables?.id === etiqueta.id
            }
            borrando={
              borrarMutation.isPending && borrarMutation.variables === etiqueta.id
            }
            onGuardar={(datos) =>
              editarMutation.mutate({ id: etiqueta.id, datos })
            }
            onBorrar={() => borrarMutation.mutate(etiqueta.id)}
          />
        ))}
      </div>
    </Modal>
  )
}

interface FilaEtiquetaProps {
  etiqueta: Etiqueta
  guardando: boolean
  borrando: boolean
  onGuardar: (datos: Partial<Etiqueta>) => void
  onBorrar: () => void
}

function FilaEtiqueta({
  etiqueta,
  guardando,
  borrando,
  onGuardar,
  onBorrar,
}: FilaEtiquetaProps) {
  const [nombre, setNombre] = useState(etiqueta.nombre)
  const [confirmando, setConfirmando] = useState(false)

  const cambio = nombre.trim() !== etiqueta.nombre && nombre.trim().length > 0

  return (
    <div className="border-borde bg-superficie-2 flex flex-wrap items-center gap-2 rounded-lg border p-2">
      {/* El color se guarda apenas se suelta el selector: es un control continuo, y
          obligar a confirmarlo aparte sería un paso de más para algo reversible. */}
      <input
        type="color"
        value={etiqueta.color}
        onChange={(e) => onGuardar({ color: e.target.value })}
        aria-label={`Color de ${etiqueta.nombre}`}
        className="border-borde h-9 w-11 cursor-pointer rounded-md border bg-transparent p-1"
      />
      <div className="flex min-w-[8rem] flex-1 flex-col gap-0.5">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          className="border-borde bg-superficie text-tinta w-full rounded-md border px-2 py-2 text-sm"
        />
        {/* La automática se marca para que borrarla no sea una sorpresa: si desaparece,
            los clientes nuevos dejan de marcarse solos. Renombrarla y recolorearla no
            rompe nada — el sistema la busca por su clave, no por su nombre. */}
        {etiqueta.clave && (
          <span className="text-tinta-tenue text-[11px]">
            Se pone sola a los clientes nuevos
          </span>
        )}
      </div>
      {cambio && (
        <Button
          variant="outline"
          className="px-3 py-2 text-sm"
          disabled={guardando}
          onClick={() => onGuardar({ nombre: nombre.trim() })}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
      {confirmando ? (
        <>
          <Button
            variant="danger"
            className="px-3 py-2 text-sm"
            disabled={borrando}
            onClick={onBorrar}
          >
            {borrando ? 'Borrando…' : 'Sí, borrar'}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-2 text-sm"
            onClick={() => setConfirmando(false)}
          >
            No
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          className="px-3 py-2 text-sm"
          onClick={() => setConfirmando(true)}
        >
          Borrar
        </Button>
      )}
    </div>
  )
}
