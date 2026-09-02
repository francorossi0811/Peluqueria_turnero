import { describe, expect, it } from 'vitest'
import { resumirEventoHistory } from './eventoHistory'

/** Un chunk como los que manda Meta durante la sincronización de historial. */
function eventoHistory(historial: unknown) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '328067332270903',
        changes: [
          { value: { messaging_product: 'whatsapp', history: historial }, field: 'history' },
        ],
      },
    ],
  }
}

describe('resumirEventoHistory', () => {
  // ⚠️ ESTA es la forma real, copiada de un evento que mandó Meta desde su panel el
  // 1/9/2026. Los tres campos van adentro de `metadata`, no en la raíz del chunk, y `phase`
  // viene como número. Leer solo la raíz —que fue la primera implementación— daba los tres
  // en `null`: el resumen salía igual, pero sin el progreso que es su única razón de ser.
  it('lee los campos de `metadata`, que es donde Meta los manda de verdad', () => {
    const resumen = resumirEventoHistory(
      eventoHistory([
        {
          metadata: { phase: 1, chunk_order: 131, progress: 30 },
          threads: [{ messages: [{ text: { body: 'un mensaje de un cliente' } }] }],
        },
      ]),
    )

    expect(resumen).toEqual({ phase: '1', chunkOrder: 131, progress: 30 })
  })

  it('saca phase, chunk_order y progress de un chunk', () => {
    const resumen = resumirEventoHistory(
      eventoHistory([{ phase: 'initial_chunk', chunk_order: 3, progress: 42 }]),
    )

    expect(resumen).toEqual({ phase: 'initial_chunk', chunkOrder: 3, progress: 42 })
  })

  // Meta manda varios numéricos como string. Sin normalizar, el log mostraría `"3"` en un
  // chunk y `3` en el siguiente según de dónde venga.
  it('convierte los numéricos que vienen como string', () => {
    const resumen = resumirEventoHistory(
      eventoHistory([{ phase: 'incremental', chunk_order: '12', progress: '100' }]),
    )

    expect(resumen).toEqual({ phase: 'incremental', chunkOrder: 12, progress: 100 })
  })

  // ⚠️ Lo que decide que el webhook NO vuelque el payload entero es que esto devuelva algo
  // distinto de `null`. Un evento de historial con forma rara tiene que seguir contando
  // como historial: si devolviera `null`, se loguearían los cientos de chunks completos,
  // que es exactamente el problema que esta función existe para evitar.
  it('sigue reconociendo el historial aunque le falten los campos', () => {
    expect(resumirEventoHistory(eventoHistory([{}]))).toEqual({
      phase: null,
      chunkOrder: null,
      progress: null,
    })
    expect(resumirEventoHistory(eventoHistory(['una string suelta']))).toEqual({
      phase: null,
      chunkOrder: null,
      progress: null,
    })
  })

  // Un evento de estado de entrega no es historial: ese sí se loguea entero, que es poco y
  // es justo lo que hace falta para diagnosticar un mensaje que no llegó.
  it('devuelve null cuando el evento no es de historial', () => {
    const estado = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: { statuses: [{ id: 'wamid.ABC', status: 'delivered' }] },
              field: 'messages',
            },
          ],
        },
      ],
    }

    expect(resumirEventoHistory(estado)).toBeNull()
  })

  // Corre sobre lo que manda un tercero en un endpoint público, dentro de un handler que ya
  // respondió y no puede tirar.
  it('no se rompe con payloads inesperados', () => {
    expect(resumirEventoHistory(null)).toBeNull()
    expect(resumirEventoHistory('una string')).toBeNull()
    expect(resumirEventoHistory({})).toBeNull()
    expect(resumirEventoHistory({ entry: 'no es un array' })).toBeNull()
    expect(resumirEventoHistory({ entry: [null, 3] })).toBeNull()
    expect(resumirEventoHistory(eventoHistory([]))).toBeNull()
    expect(resumirEventoHistory({ entry: [{ changes: [{}] }] })).toBeNull()
  })
})
