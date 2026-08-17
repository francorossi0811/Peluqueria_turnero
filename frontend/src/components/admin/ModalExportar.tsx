import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import {
  descargarAgendaExcel,
  guardarArchivo,
  mensajeDeErrorEnBlob,
} from '../../api/exportacion'
import { hoyIso, sumarDias } from '../../utils/fecha'

// HU-30 — Elegir qué período llevarse a la planilla.
//
// El atajo por defecto es "el último mes", que es lo que pidió Franco y lo que Ariel va a
// querer el 90% de las veces. Los otros dos existen para el cierre de trimestre y para
// llevarse el año entero a fin de año.

type Atajo = 'mes' | 'trimestre' | 'anio'

const ETIQUETA_ATAJO: Record<Atajo, string> = {
  mes: 'Último mes',
  trimestre: 'Últimos 3 meses',
  anio: 'Este año',
}

/** ⚠️ "Último mes" son los **últimos 30 días**, no el mes calendario — al revés que el
 * atajo "Este mes" de la sección Cobros. No es una inconsistencia: allá Ariel mira cómo
 * viene el mes en curso y necesita que empiece el día 1; acá se lleva el registro de lo que
 * pasó, y un 2 de septiembre "el último mes" tiene que traer agosto entero y no dos días. */
function rangoDeAtajo(atajo: Atajo): { desde: string; hasta: string } {
  const hoy = hoyIso()
  if (atajo === 'mes') return { desde: sumarDias(hoy, -30), hasta: hoy }
  if (atajo === 'trimestre') return { desde: sumarDias(hoy, -90), hasta: hoy }
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy }
}

export function ModalExportar({ onClose }: { onClose: () => void }) {
  const [atajo, setAtajo] = useState<Atajo | null>('mes')
  const [rango, setRango] = useState(() => rangoDeAtajo('mes'))
  const [error, setError] = useState<string | null>(null)

  function elegirAtajo(nuevo: Atajo) {
    setAtajo(nuevo)
    setRango(rangoDeAtajo(nuevo))
    setError(null)
  }

  // Tocar una fecha a mano apaga el atajo, igual que en Cobros: si quedara encendido diría
  // que estás exportando "el último mes" mientras el rango dice otra cosa.
  //
  // El guard contra el valor vacío es el mismo del selector de la agenda: el botón de
  // limpiar del `<input type="date">` nativo manda `''`, y sin frenarlo el rango queda roto.
  function cambiarFecha(campo: 'desde' | 'hasta', valor: string) {
    if (!valor) return
    setAtajo(null)
    setError(null)
    setRango((r) => ({ ...r, [campo]: valor }))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const blob = await descargarAgendaExcel(rango.desde, rango.hasta)
      // El nombre se arma acá con el mismo rango que se acaba de pedir, en vez de leerlo
      // del `Content-Disposition`: ese header no se puede leer entre dominios sin
      // exponerlo a mano en el CORS del backend, y sería un header más que mantener para
      // reconstruir una cadena que ya tenemos.
      guardarArchivo(blob, `agenda-${rango.desde}-a-${rango.hasta}.xlsx`)
    },
    onSuccess: onClose,
    onError: async (err) => {
      const mensaje = isAxiosError(err)
        ? await mensajeDeErrorEnBlob(err.response?.data)
        : null
      setError(mensaje ?? 'No pudimos armar la planilla. Probá de nuevo.')
    },
  })

  const rangoInvertido = rango.hasta < rango.desde

  return (
    <Modal titulo="Exportar la agenda" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-tinta-suave text-sm">
          Se baja un Excel con una hoja por semana y un resumen al final, con lo
          facturado y el desglose por medio de pago.
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(ETIQUETA_ATAJO) as Atajo[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => elegirAtajo(a)}
              aria-pressed={atajo === a}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                atajo === a
                  ? 'border-miel-fuerte bg-miel-fuerte text-sobre-acento'
                  : 'border-borde bg-superficie text-tinta hover:bg-superficie-2'
              }`}
            >
              {ETIQUETA_ATAJO[a]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Desde
            </span>
            <input
              type="date"
              value={rango.desde}
              onChange={(e) => cambiarFecha('desde', e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel min-w-0 rounded-md border px-3 py-2 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Hasta
            </span>
            <input
              type="date"
              value={rango.hasta}
              onChange={(e) => cambiarFecha('hasta', e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel min-w-0 rounded-md border px-3 py-2 outline-none"
            />
          </label>
        </div>

        {rangoInvertido && (
          <p className="text-tinta-tenue text-xs">
            La fecha de fin tiene que ser posterior a la de inicio.
          </p>
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
            disabled={rangoInvertido || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Armando la planilla…' : 'Descargar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
