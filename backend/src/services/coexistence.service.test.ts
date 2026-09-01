import { describe, expect, it } from 'vitest'
import { TIPOS_DE_SYNC, cuerpoDeSync } from './coexistence.service'

describe('cuerpoDeSync', () => {
  // ⚠️ Estos dos cuerpos son un contrato con Meta y **cada uno se puede mandar una sola vez
  // en la vida del número**. Equivocar el `sync_type` no da un error visible: ejecuta la
  // sincronización que no era y gasta la única oportunidad de la otra.
  it('arma el cuerpo exacto de cada sincronización', () => {
    expect(cuerpoDeSync('smb_app_state_sync')).toEqual({
      messaging_product: 'whatsapp',
      sync_type: 'smb_app_state_sync',
    })
    expect(cuerpoDeSync('history')).toEqual({
      messaging_product: 'whatsapp',
      sync_type: 'history',
    })
  })

  // ⚠️ El orden no es alfabético ni casual: `history` sin el estado de la app ya
  // sincronizado no tiene sentido. Invertirlo gastaría las dos oportunidades al pedo.
  it('mantiene el orden: primero el estado de la app, después el historial', () => {
    expect(TIPOS_DE_SYNC).toEqual(['smb_app_state_sync', 'history'])
  })
})
