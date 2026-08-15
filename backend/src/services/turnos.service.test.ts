import { describe, expect, it } from 'vitest'
import {
  esCobrable,
  estaDentroDeVentanaDeCambio,
  fechaCargableComoAdmin,
} from './turnos.service'

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

// HU-27 — A qué turno se le puede registrar un cobro.
describe('esCobrable', () => {
  it('deja cobrar un turno realizado', () => {
    expect(esCobrable('realizado')).toBe(true)
  })

  it('no deja cobrar un ausente: el que no vino no pagó', () => {
    // Es la regla que evita que entren al total pesos que nunca existieron. La usan el
    // schema del request y los dos caminos del service, así que fijarla acá las cubre.
    expect(esCobrable('ausente')).toBe(false)
  })

  it('no deja cobrar lo que nunca llegó a ocurrir', () => {
    expect(esCobrable('reservado')).toBe(false)
    expect(esCobrable('cancelado')).toBe(false)
    expect(esCobrable('reprogramado')).toBe(false)
  })
})

// HU-08 — Hasta dónde para atrás puede Ariel registrar un turno que ya atendió. Los dos
// bordes van juntos por el mismo motivo que en el test del cierre: fijar solo el de
// adentro deja lugar a que el de afuera se corra un día sin que nada avise.
describe('fechaCargableComoAdmin', () => {
  // Martes 4 de agosto de 2026 a las 15:30. La hora del día importa: si "ahora" fuera
  // medianoche, un borde mal calculado pasaría de casualidad.
  const AHORA = new Date(Date.UTC(2026, 7, 4, 15, 30))
  const dia = (n: number) => new Date(Date.UTC(2026, 7, n))

  it('deja cargar hoy, aunque la hora ya haya pasado', () => {
    expect(fechaCargableComoAdmin(dia(4), AHORA)).toBe(true)
  })

  it('deja cargar el día más viejo de la ventana', () => {
    expect(fechaCargableComoAdmin(dia(4 - 7), AHORA)).toBe(true)
  })

  it('no deja cargar el día anterior a la ventana', () => {
    expect(fechaCargableComoAdmin(dia(4 - 8), AHORA)).toBe(false)
  })

  it('hacia adelante no hay límite: Ariel ya reserva a meses vista', () => {
    expect(fechaCargableComoAdmin(dia(30), AHORA)).toBe(true)
  })
})
