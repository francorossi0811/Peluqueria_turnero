import { useEffect, useState } from 'react'

type Estado = 'listo' | 'copiado' | 'fallo'

/** El respaldo para cuando `navigator.clipboard` no está o no deja escribir: un `textarea`
 * fuera de pantalla, seleccionado, y `execCommand('copy')`. Está marcado como obsoleto pero
 * sigue andando en todos los navegadores, y es justo lo que cubre a los celulares viejos
 * (o a Samsung Internet) que traen la API moderna a medias. */
function copiarALaVieja(texto: string): boolean {
  const caja = document.createElement('textarea')
  caja.value = texto
  caja.setAttribute('readonly', '')
  caja.style.position = 'fixed'
  caja.style.top = '-1000px'
  document.body.appendChild(caja)
  caja.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(caja)
  }
}

/** Un botón chico que copia un texto al portapapeles y lo confirma en su propio rótulo.
 *
 * ⚠️ `navigator.clipboard` puede fallar (navegador viejo, permiso negado, página sin
 * HTTPS): en ese caso el botón lo dice en vez de quedarse callado, porque un "Copiar" que
 * no copia se descubre recién al pegar en el banco. El dato igual está a la vista para
 * copiarlo a mano.
 *
 * El `min-w` evita que la fila salte cuando el rótulo pasa de "Copiar" a "Copiado". */
export function BotonCopiar({
  texto,
  etiqueta,
}: {
  texto: string
  /** Qué se copia, para el lector de pantalla ("Copiar CVU"). */
  etiqueta: string
}) {
  const [estado, setEstado] = useState<Estado>('listo')

  useEffect(() => {
    if (estado === 'listo') return
    const t = setTimeout(() => setEstado('listo'), 2000)
    return () => clearTimeout(t)
  }, [estado])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setEstado('copiado')
    } catch {
      setEstado(copiarALaVieja(texto) ? 'copiado' : 'fallo')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      aria-label={`Copiar ${etiqueta}`}
      className="border-miel bg-superficie font-display text-miel hover:bg-miel-suave active:bg-miel/20 inline-flex min-w-[6.5rem] shrink-0 items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold tracking-wide whitespace-nowrap uppercase transition"
    >
      {estado === 'copiado'
        ? 'Copiado ✓'
        : estado === 'fallo'
          ? 'No se pudo'
          : 'Copiar'}
    </button>
  )
}
