import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../ui/Button'
import { Insignia } from './Insignia'
import { actualizarCliente, obtenerCliente } from '../../api/clientes'
import { obtenerEtiquetas } from '../../api/etiquetas'
import {
  borrarFotoDeFicha,
  obtenerFotosDeFicha,
  subirFotoDeFicha,
  urlDeFoto,
} from '../../api/fotos'
import { fechaLegible } from '../../utils/fecha'
import { comprimirImagen, ImagenNoLegibleError } from '../../utils/imagen'
import { ESTILO_ESTADO, ETIQUETA_ESTADO } from '../../utils/estadoTurno'
import type { ErrorApi, TurnoDeHistorial } from '../../types/api'

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

      <Galeria clienteId={clienteId} />

      {conHistorial && <Historial turnos={ficha.turnos} />}
    </div>
  )
}

/**
 * HU-29 — Las fotos de la ficha: cómo le quedó el corte las veces anteriores.
 *
 * Es lo que resuelve el "quiero el mismo de la otra vez", que en la planilla de papel no tenía
 * dónde vivir. Las fotos se comprimen **en el navegador** antes de subirse (ver
 * `utils/imagen.ts`): sin eso, cada foto del celular son 3 MB y el plan gratuito de Neon se
 * llena con un puñado de fichas.
 *
 * Consulta propia y no parte de la ficha a propósito: al subir o borrar se invalida solo esto y
 * no vuelve a traerse el historial de turnos entero.
 */
function Galeria({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const galeriaQuery = useQuery({
    queryKey: ['fotos-ficha', clienteId],
    queryFn: () => obtenerFotosDeFicha(clienteId),
  })

  function refrescar() {
    void queryClient.invalidateQueries({ queryKey: ['fotos-ficha', clienteId] })
    // El uso de almacenamiento se muestra en "Mi cuenta" y acaba de cambiar.
    void queryClient.invalidateQueries({ queryKey: ['almacenamiento'] })
  }

  // Por cuál foto va la subida, para que el botón diga "Subiendo 2 de 5…" y no un
  // "Subiendo…" que con diez fotos parece colgado.
  const [progreso, setProgreso] = useState<{ va: number; total: number } | null>(null)

  /**
   * Sube las fotos elegidas **de a una, en fila** (13/9/2026: antes se podía elegir una sola).
   *
   * ⚠️ En fila y no en paralelo, a propósito. Cada foto ya viaja comprimida a ~150 KB y el
   * endpoint acepta una por request, así que no hizo falta tocar el backend; y diez subidas
   * a la vez contra Render free es el mismo chorro de requests que rompió el selector de
   * color de las etiquetas.
   *
   * Una foto que falla **no corta las demás**: se anota y se sigue. Es el caso de una foto
   * que el navegador no puede leer en el medio de un lote — perder las otras nueve por esa
   * sería peor que avisar cuál no entró. Y la galería se refresca después de cada una, así
   * las fotos van apareciendo mientras sube el resto.
   */
  const subirMutation = useMutation({
    mutationFn: async (archivos: File[]) => {
      const fallidas: { nombre: string; motivo: string }[] = []
      for (const [i, archivo] of archivos.entries()) {
        setProgreso({ va: i + 1, total: archivos.length })
        try {
          await subirFotoDeFicha(clienteId, await comprimirImagen(archivo))
          refrescar()
        } catch (err) {
          fallidas.push({ nombre: archivo.name, motivo: motivoDelFallo(err) })
        }
      }
      return { fallidas, total: archivos.length }
    },
    onMutate: () => setError(null),
    onSettled: () => setProgreso(null),
    onSuccess: ({ fallidas, total }) => {
      if (fallidas.length === 0) return
      if (total === 1) {
        setError(fallidas[0].motivo)
        return
      }
      const cuantas =
        fallidas.length === 1 ? 'entró 1 foto' : `entraron ${fallidas.length} fotos`
      setError(
        `No ${cuantas} de ${total}: ` +
          fallidas.map((f) => `${f.nombre} (${f.motivo})`).join(' · '),
      )
    },
  })

  const borrarMutation = useMutation({
    mutationFn: (fotoId: string) => borrarFotoDeFicha(clienteId, fotoId),
    onSuccess: () => {
      setError(null)
      refrescar()
    },
    onError: () => setError('No pudimos borrar la foto.'),
  })

  const galeria = galeriaQuery.data
  const fotos = galeria?.fotos ?? []

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    // ⚠️ Se copia la lista ANTES de limpiar el input: `files` es la lista viva del input, y
    // vaciar `value` la deja en cero.
    const archivos = Array.from(e.target.files ?? [])
    // Se limpia el input siempre: si no, elegir la misma foto dos veces seguidas no dispara
    // `change` la segunda vez y parece que el botón dejó de andar.
    e.target.value = ''
    if (archivos.length > 0) subirMutation.mutate(archivos)
  }

  return (
    <div className="border-borde border-t pt-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-tinta-suave text-sm">
          Fotos
          {galeria && (
            <span className="text-tinta-tenue">
              {' '}
              · {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
            </span>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={elegir}
          className="hidden"
        />
        <button
          type="button"
          disabled={subirMutation.isPending}
          onClick={() => inputRef.current?.click()}
          className="text-miel text-sm font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
        >
          {progreso
            ? progreso.total > 1
              ? `Subiendo ${progreso.va} de ${progreso.total}…`
              : 'Subiendo…'
            : '+ Agregar fotos'}
        </button>
      </div>

      {error && <p className="text-vino mb-2 text-sm">{error}</p>}

      {fotos.length === 0 ? (
        <p className="text-tinta-tenue text-sm">
          Todavía no tiene fotos. Sacale una al corte terminado y la vas a tener acá la próxima
          vez.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {fotos.map((foto) => (
            <li key={foto.id} className="relative">
              <a href={urlDeFoto(foto.url)} target="_blank" rel="noopener noreferrer">
                <img
                  src={urlDeFoto(foto.url)}
                  alt="Foto del corte"
                  loading="lazy"
                  className="border-borde h-24 w-24 rounded-md border object-cover"
                />
              </a>
              <button
                type="button"
                aria-label="Borrar foto"
                disabled={borrarMutation.isPending}
                onClick={() => {
                  // Borrar una foto no se deshace, y el botón es chico y está pegado a la
                  // imagen: sin la confirmación, un toque de más en el celular la pierde.
                  if (confirm('¿Borrar esta foto?')) borrarMutation.mutate(foto.id)
                }}
                className="bg-superficie border-borde text-tinta absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border text-sm leading-none shadow-sm"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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

/** Por qué no entró una foto, en palabras de Ariel. El mensaje del backend manda cuando lo
 * hay: sabe si el problema fue el formato o el peso, y cada uno pide hacer algo distinto. */
function motivoDelFallo(err: unknown): string {
  const mensaje = isAxiosError<ErrorApi>(err)
    ? err.response?.data.error.mensaje
    : null
  if (mensaje) return mensaje
  return err instanceof ImagenNoLegibleError
    ? 'No pudimos leer esa foto. Probá con otra.'
    : 'No pudimos subir la foto. Probá de nuevo.'
}
