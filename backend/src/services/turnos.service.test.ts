import { describe, expect, it } from 'vitest'
import { estaDentroDeVentanaDeCambio } from './turnos.service'

// Turno el martes 4 de agosto de 2026 a las 15:00.
const TURNO = {
  fecha: new Date(Date.UTC(2026, 7, 4)),
  horaInicio: new Date(Date.UTC(1970, 0, 1, 15, 0)),
}

describe('estaDentroDeVentanaDeCambio', () => {
  it('permite cambiar si faltan más de 60 minutos', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 13, 0)) // faltan 120 min
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(true)
  })

  it('permite cambiar si faltan exactamente 60 minutos', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 14, 0)) // faltan 60 min justos
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(true)
  })

  it('no permite cambiar si falta un minuto menos de la ventana', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 14, 1)) // faltan 59 min
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(false)
  })

  it('no permite cambiar un turno que ya pasó', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 16, 0)) // el turno era a las 15:00
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(false)
  })
})
