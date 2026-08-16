import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { actualizarServicio, crearServicio } from '../../api/servicios'
import {
  borrarFotoDeServicio,
  subirFotoDeServicio,
  urlDeFoto,
} from '../../api/fotos'
import { comprimirImagen, ImagenNoLegibleError } from '../../utils/imagen'
import type { ErrorApi, ServicioAdmin } from '../../types/api'

interface ModalServicioProps {
  servicio?: ServicioAdmin
  onClose: () => void
}

export function ModalServicio({ servicio, onClose }: ModalServicioProps) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState(servicio?.nombre ?? '')
  const [duracionMinutos, setDuracionMinutos] = useState(
    servicio?.duracionMinutos ?? 30,
  )
  // HU-27 — Texto y no número: el campo vacío tiene que poder significar "sin precio",
  // y un `useState<number>` no sabe expresar eso sin inventar un 0.
  const [precio, setPrecio] = useState(
    servicio?.precio != null ? String(servicio.precio) : '',
  )
  const [error, setError] = useState<string | null>(null)
  // HU-29 — La foto elegida en este modal, todavía sin subir, y la intención de sacar la que
  // ya estaba. Son dos estados y no uno: "no toqué la foto" y "quiero que no tenga" son cosas
  // distintas, igual que con el precio.
  const [fotoNueva, setFotoNueva] = useState<string | null>(null)
  const [quitarFoto, setQuitarFoto] = useState(false)

  const precioAEnviar = precio.trim() === '' ? null : Number(precio)
  const precioInvalido =
    precioAEnviar !== null &&
    (!Number.isInteger(precioAEnviar) || precioAEnviar < 0)

  /** ⚠️ Si el servicio se guarda y la foto falla, el servicio **ya existe**. Sin esta bandera
   * el modal mostraría "no pudimos guardar el servicio" sobre uno que sí se guardó, y Ariel lo
   * cargaría de nuevo — quedándose con dos. */
  const servicioGuardado = useRef(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const datos = { nombre, duracionMinutos, precio: precioAEnviar }
      servicioGuardado.current = false

      const guardado = servicio
        ? await actualizarServicio(servicio.id, datos)
        : await crearServicio(datos)
      servicioGuardado.current = true

      // La foto va en un request aparte y después, porque necesita el id: en un servicio
      // nuevo ese id recién existe acá. Para Ariel sigue siendo un solo gesto.
      if (fotoNueva) await subirFotoDeServicio(guardado.id, fotoNueva)
      else if (quitarFoto) await borrarFotoDeServicio(guardado.id)

      return guardado
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['servicios-admin'] })
      onClose()
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null

      if (servicioGuardado.current) {
        void queryClient.invalidateQueries({ queryKey: ['servicios-admin'] })
        setError(
          `El servicio se guardó, pero la foto no: ${mensaje ?? 'probá de nuevo'}. Cerrá y volvé a entrar con "Editar" para intentarlo otra vez.`,
        )
        return
      }

      setError(mensaje ?? 'No pudimos guardar el servicio. Probá de nuevo.')
    },
  })

  return (
    <Modal
      titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Nombre
          </span>
          <input
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Duración (minutos)
          </span>
          <input
            required
            type="number"
            min={1}
            max={480}
            step={5}
            value={duracionMinutos}
            onChange={(e) => setDuracionMinutos(Number(e.target.value))}
            className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
          />
        </label>
        {/* HU-27 — Solo lo ve Ariel. Se aclara acá mismo porque el resto de esta pantalla
            configura cosas que el cliente sí ve, y la duda es razonable. */}
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Precio
          </span>
          <div className="flex items-center gap-2">
            <span className="text-tinta-suave">$</span>
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              placeholder="Sin precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel w-full rounded-md border px-3 py-2 outline-none"
            />
          </div>
          {/* ⚠️ Este texto decía "Es tuyo: el cliente no lo ve en ningún momento", y era
              falso desde el 14/8/2026: ese día el precio pasó a mostrarse en la landing y en
              todo el flujo de reserva (enmienda a HU-27). Le estaba diciendo a Ariel que
              podía escribir cualquier cosa en un campo que ve todo el mundo. */}
          <span className="text-tinta-tenue text-xs">
            El cliente lo ve en la web, al elegir el servicio. Dejalo vacío si todavía no
            querés mostrar un precio.
          </span>
        </label>

        <CampoFoto
          fotoActual={servicio?.foto ?? null}
          fotoNueva={fotoNueva}
          quitando={quitarFoto}
          onElegir={(dataUrl) => {
            setFotoNueva(dataUrl)
            setQuitarFoto(false)
            setError(null)
          }}
          onQuitar={() => {
            setFotoNueva(null)
            setQuitarFoto(true)
          }}
          onError={setError}
        />

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
            disabled={
              !nombre.trim() ||
              duracionMinutos < 1 ||
              precioInvalido ||
              mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * HU-29 — La foto del servicio, la que ve el cliente en la landing.
 *
 * Existe para que un servicio nuevo no quede con la foto de stock genérica. Antes la foto solo
 * se podía asignar desde la base o en una migración, así que Ariel no tenía forma de ponerle
 * una a un servicio que creaba él.
 *
 * No sube nada por su cuenta: deja la foto lista en el estado del modal y la subida ocurre al
 * guardar, que es cuando existe el id del servicio.
 */
function CampoFoto({
  fotoActual,
  fotoNueva,
  quitando,
  onElegir,
  onQuitar,
  onError,
}: {
  /** La que ya tiene, tal como la manda la API: puede ser una ruta estática o una subida. */
  fotoActual: string | null
  /** La elegida recién, ya comprimida y todavía sin subir. */
  fotoNueva: string | null
  quitando: boolean
  onElegir: (dataUrl: string) => void
  onQuitar: () => void
  onError: (mensaje: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [comprimiendo, setComprimiendo] = useState(false)

  // La nueva pisa a la actual en la vista previa: es lo que va a quedar si guarda.
  const aMostrar = fotoNueva ?? (quitando ? null : fotoActual)

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return

    setComprimiendo(true)
    try {
      onElegir(await comprimirImagen(archivo))
    } catch (err) {
      onError(
        err instanceof ImagenNoLegibleError
          ? 'No pudimos leer esa foto. Probá con otra.'
          : 'No pudimos preparar la foto.',
      )
    } finally {
      setComprimiendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-tinta-tenue text-xs tracking-wide uppercase">Foto</span>
      <div className="flex items-center gap-3">
        {aMostrar ? (
          <img
            src={fotoNueva ?? urlDeFoto(aMostrar)}
            alt=""
            className="border-borde h-20 w-16 rounded-md border object-cover"
          />
        ) : (
          // El hueco dice qué pasa si no pone nada. Un recuadro vacío y mudo deja pensando
          // que la foto no se cargó, cuando en realidad nunca hubo una.
          <div className="border-borde text-tinta-tenue flex h-20 w-16 items-center justify-center rounded-md border border-dashed px-1 text-center text-[10px] leading-tight">
            Sin foto propia
          </div>
        )}

        <div className="flex flex-col items-start gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={elegir}
            className="hidden"
          />
          <button
            type="button"
            disabled={comprimiendo}
            onClick={() => inputRef.current?.click()}
            className="text-miel text-sm font-semibold hover:underline disabled:opacity-50"
          >
            {comprimiendo ? 'Preparando…' : aMostrar ? 'Cambiar foto' : 'Elegir foto'}
          </button>
          {aMostrar && (
            <button
              type="button"
              onClick={onQuitar}
              className="text-tinta-tenue text-xs hover:underline"
            >
              Quitar
            </button>
          )}
          <span className="text-tinta-tenue text-xs">
            Sin foto propia se muestra una genérica.
          </span>
        </div>
      </div>
    </div>
  )
}
