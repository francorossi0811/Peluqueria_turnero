/** Lo único que interesa loguear de un chunk de historial. */
export interface ResumenHistory {
  phase: string | null
  chunkOrder: number | null
  progress: number | null
}

/** Reduce un evento de sincronización de historial a tres números.
 *
 * ⚠️ Existe porque **llegan cientos de chunks**: loguear el payload entero de cada uno deja
 * el log de Render inservible justo el día que hay que mirarlo, que es el día en que se
 * hace la sincronización. Lo que sirve para seguir el avance es `phase`, `chunk_order` y
 * `progress`; el resto son los mensajes del historial, que además son datos de clientes.
 *
 * Devuelve `null` cuando el evento **no** es de historial, y de ahí sale la decisión del
 * webhook: si no es historial, se loguea como siempre.
 *
 * ⚠️ Camina el payload con chequeos en cada nivel a propósito. Esto corre sobre lo que
 * manda un tercero, en un endpoint público, y un `value.history[0].phase` optimista se
 * rompe con cualquier forma inesperada — justo en el handler que no puede tirar. */
export function resumirEventoHistory(payload: unknown): ResumenHistory | null {
  const historial = buscarHistorial(payload)
  if (!historial) return null

  // ⚠️ Meta mete los tres campos adentro de `metadata`, no en la raíz del chunk. Se
  // comprobó sobre un evento real enviado desde el panel de Meta:
  //   history: [{ metadata: { phase: 1, chunk_order: 131, progress: 30 }, threads: [...] }]
  // Se mira `metadata` primero y la raíz después, por si alguna versión los manda planos:
  // leer solo la raíz daba los tres en `null`, que es un resumen que no resume nada.
  const campos = esObjeto(historial.metadata) ? historial.metadata : historial

  return {
    phase: texto(campos.phase),
    chunkOrder: numero(campos.chunk_order),
    progress: numero(campos.progress),
  }
}

/** El `history` vive en `entry[].changes[].value.history[]`. Cualquier eslabón puede faltar
 * o venir con otra forma, así que cada uno se verifica antes de bajar al siguiente. */
function buscarHistorial(payload: unknown): Record<string, unknown> | null {
  if (!esObjeto(payload)) return null

  const entries = payload.entry
  if (!Array.isArray(entries)) return null

  for (const entry of entries) {
    if (!esObjeto(entry) || !Array.isArray(entry.changes)) continue

    for (const change of entry.changes) {
      if (!esObjeto(change) || !esObjeto(change.value)) continue

      const historial = change.value.history
      if (!Array.isArray(historial) || historial.length === 0) continue

      const primero = historial[0]
      if (esObjeto(primero)) return primero

      // Es historial, pero con una forma que no entendemos: devolver algo vacío es mejor
      // que devolver `null`, porque `null` haría que el webhook loguee el payload entero
      // y ese es justamente el problema que esta función viene a evitar.
      return {}
    }
  }

  return null
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** ⚠️ `phase` viene como **número** en los eventos reales de Meta (`"phase": 1`), aunque la
 * documentación lo muestre con nombres. Se acepta lo que venga y se pasa a texto: el valor
 * es para leerlo en el log, no para decidir nada. */
function texto(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return null
}

function numero(v: unknown): number | null {
  if (typeof v === 'number') return v
  // Meta manda varios numéricos como string; convertirlos acá evita que el log muestre
  // `"3"` en un chunk y `3` en el siguiente según de dónde venga.
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v)
  }
  return null
}
