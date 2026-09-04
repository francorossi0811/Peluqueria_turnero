import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { InsigniaConNombre } from './Insignia'
import {
  actualizarEtiqueta,
  crearEtiqueta,
  eliminarEtiqueta,
  obtenerEtiquetas,
} from '../../api/etiquetas'
import type { ErrorApi, EtiquetaConUso } from '../../types/api'

// HU-25 — Ariel se arma sus propias insignias.
//
// No es un catálogo cerrado a propósito: la planilla usa un color para marcar clientes
// porque es lo único que Sheets sabe hacer, y heredar esa limitación sería quedarnos con
// lo peor de la planilla. Acá el color lo elige él y el significado lo escribe.
//
// El color arranca en el ámbar de la marca en vez de en negro (el default de
// `<input type="color">`), que sobre el panel oscuro es una insignia invisible.
const COLOR_INICIAL = '#b68235'

/** El mensaje que mandó el backend, o uno propio si el error no vino de la API. */
function mensajeDeError(err: unknown, porDefecto: string): string {
  const mensaje = isAxiosError<ErrorApi>(err)
    ? err.response?.data.error.mensaje
    : null
  return mensaje ?? porDefecto
}

interface ModalEtiquetasProps {
  onClose: () => void
  /** Se llama con la etiqueta ya borrada. Existe porque quien tiene el filtro de la lista
   * de clientes es `ClientesPage`, y si el filtro apuntaba a esta etiqueta queda apuntando
   * a un id que ya no existe: la lista se vacía **y el chip para desactivarlo desapareció
   * junto con la etiqueta**, así que no queda forma de salir salvo recargar. */
  onBorrada?: (id: string) => void
}

export function ModalEtiquetas({ onClose, onBorrada }: ModalEtiquetasProps) {
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

  const crearMutation = useMutation({
    mutationFn: () => crearEtiqueta({ nombre: nombre.trim(), color }),
    onSuccess: () => {
      setNombre('')
      setColor(COLOR_INICIAL)
      setError(null)
      invalidarTodo()
    },
    onError: (err) =>
      setError(mensajeDeError(err, 'No pudimos crear la etiqueta.')),
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
            alCambiar={invalidarTodo}
            alBorrar={() => {
              invalidarTodo()
              onBorrada?.(etiqueta.id)
            }}
          />
        ))}
      </div>
    </Modal>
  )
}

interface FilaEtiquetaProps {
  etiqueta: EtiquetaConUso
  alCambiar: () => void
  alBorrar: () => void
}

/**
 * Una etiqueta de la lista, con sus tres estados: mirándola, editándola y confirmando el
 * borrado.
 *
 * ⚠️ **El color se edita en estado local y se guarda con un botón, no solo.** Antes el
 * `<input type="color">` estaba atado directo al servidor (`value={etiqueta.color}`) y
 * mandaba un PATCH en el `onChange`, que en un selector de color **corre continuo mientras
 * arrastrás el cursor por la rueda**, no al soltarlo. Medido en el navegador: un solo
 * cambio de color disparó **31 PATCH y 31 GET** más los preflight de CORS, o sea unos 90
 * requests. De ahí salen los dos síntomas que reportó Ariel:
 *
 * - el color "no se puede cambiar" — cada respuesta que volvía reseteaba el input, que
 *   está atado al valor del servidor, con el selector todavía abierto; y
 * - "no queda guardado" — los PATCH viajan en paralelo, así que el que llega último al
 *   servidor no es necesariamente el último que elegiste. Contra Render (plan free, con
 *   latencia de verdad) el que gana es cualquiera.
 *
 * El arreglo no es un debounce: es que **el color deje de ser estado del servidor mientras
 * se lo elige**. Un solo PATCH por "Guardar", con los dos campos juntos.
 *
 * Cada fila tiene además sus propias mutaciones en vez de compartir las del modal. Eso da
 * gratis lo que antes había que reconstruir comparando `variables`: el "Guardando…" y
 * **el mensaje de error caen en la fila que falló**. El cartel de error del modal está
 * arriba de todo, así que un error sobre la última etiqueta de una lista larga quedaba
 * fuera de la vista y se leía como que no había pasado nada.
 */
function FilaEtiqueta({ etiqueta, alCambiar, alBorrar }: FilaEtiquetaProps) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(etiqueta.nombre)
  const [color, setColor] = useState(etiqueta.color)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardarMutation = useMutation({
    mutationFn: () =>
      actualizarEtiqueta(etiqueta.id, { nombre: nombre.trim(), color }),
    onSuccess: () => {
      setError(null)
      setEditando(false)
      alCambiar()
    },
    onError: (err) =>
      setError(mensajeDeError(err, 'No pudimos guardar el cambio.')),
  })

  const borrarMutation = useMutation({
    mutationFn: () => eliminarEtiqueta(etiqueta.id),
    onSuccess: () => {
      setError(null)
      alBorrar()
    },
    onError: (err) =>
      setError(mensajeDeError(err, 'No pudimos borrar la etiqueta.')),
  })

  // Al abrir la edición se relee la etiqueta en vez de confiar en el estado que quedó de
  // la vez anterior: entre medio la pudo haber cambiado otra pestaña.
  function abrirEdicion() {
    setNombre(etiqueta.nombre)
    setColor(etiqueta.color)
    setError(null)
    setConfirmando(false)
    setEditando(true)
  }

  return (
    <div className="border-borde bg-superficie-2 flex flex-col gap-2 rounded-lg border p-2">
      {editando ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label={`Color de ${etiqueta.nombre}`}
              className="border-borde h-11 w-14 cursor-pointer rounded-md border bg-transparent p-1"
            />
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={40}
              aria-label={`Nombre de ${etiqueta.nombre}`}
              className="border-borde bg-superficie text-tinta min-w-[8rem] flex-1 rounded-md border px-2 py-2.5 text-base"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* La insignia de verdad, con el color y el nombre que están puestos ahora. Es
                la única forma de ver cómo va a quedar sin guardar primero — y va con el
                anillo que la despega del fondo, que es justo lo que el cuadradito del
                selector de color no muestra. */}
            <span className="mr-auto">
              <InsigniaConNombre
                etiqueta={{
                  ...etiqueta,
                  nombre: nombre.trim() || etiqueta.nombre,
                  color,
                }}
              />
            </span>
            <span className="flex shrink-0 gap-2">
              <Button
                className="px-3 py-2 text-sm"
                disabled={!nombre.trim() || guardarMutation.isPending}
                onClick={() => guardarMutation.mutate()}
              >
                {guardarMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                variant="ghost"
                className="px-3 py-2 text-sm"
                disabled={guardarMutation.isPending}
                onClick={() => {
                  setEditando(false)
                  setError(null)
                }}
              >
                Cancelar
              </Button>
            </span>
          </div>
        </>
      ) : (
        // `justify-end` para cuando la fila envuelve: el `mr-auto` de la etiqueta
        // resuelve el caso de una sola línea, pero en dos deja los botones pegados al
        // margen izquierdo, debajo del texto y sin nada que los alinee.
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto flex min-w-0 flex-col items-start gap-0.5">
            <InsigniaConNombre etiqueta={etiqueta} />
            {/* La automática se marca para que borrarla no sea una sorpresa: si desaparece,
                los clientes nuevos dejan de marcarse solos. Renombrarla y recolorearla no
                rompe nada — el sistema la busca por su clave, no por su nombre. */}
            {etiqueta.clave && (
              <span className="text-tinta-tenue text-[11px]">
                Se pone sola a los clientes nuevos
              </span>
            )}
          </span>
          {/* Los dos botones van en su propio grupo `shrink-0`: sueltos dentro del
              `flex-wrap`, la etiqueta automática —que lleva un renglón más de texto— los
              partía en dos líneas distintas. */}
          <span className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              className="px-3 py-2 text-sm"
              onClick={abrirEdicion}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-2 text-sm"
              onClick={() => {
                setError(null)
                setConfirmando(true)
              }}
            >
              Borrar
            </Button>
          </span>
        </div>
      )}

      {/* ⚠️ La confirmación es una banda propia y no dos botones donde antes decía
          "Borrar". Con los botones apareciendo en el lugar del que se acaba de tocar, el
          gesto de Ariel —tocar "Borrar" y seguir— se comía el segundo paso sin que nada lo
          delatara: la etiqueta seguía ahí, y desde afuera eso se ve igual que un borrado
          que no funciona. Acá el paso que falta se lee, y dice qué se lleva puesto. */}
      {confirmando && !editando && (
        <div className="border-borde bg-superficie flex flex-wrap items-center gap-2 rounded-md border p-2">
          <span className="text-tinta mr-auto text-sm">
            ¿Borrar «{etiqueta.nombre}»?{' '}
            {etiqueta.clientes > 0
              ? `Se la vas a sacar a ${etiqueta.clientes} ${
                  etiqueta.clientes === 1 ? 'cliente' : 'clientes'
                }.`
              : 'No la tiene ningún cliente.'}
          </span>
          <span className="flex shrink-0 gap-2">
            <Button
              variant="danger"
              className="px-3 py-2 text-sm"
              disabled={borrarMutation.isPending}
              onClick={() => borrarMutation.mutate()}
            >
              {borrarMutation.isPending ? 'Borrando…' : 'Sí, borrar'}
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-2 text-sm"
              disabled={borrarMutation.isPending}
              onClick={() => setConfirmando(false)}
            >
              No
            </Button>
          </span>
        </div>
      )}

      {error && (
        <p className="border-vino bg-vino-suave text-vino rounded-md border px-2 py-1.5 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
