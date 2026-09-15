import { describe, expect, it } from 'vitest'
import { luminancia, tintaSobre } from './color'

describe('tintaSobre', () => {
  it('pone texto negro sobre un fondo claro', () => {
    expect(tintaSobre('#ffffff')).toBe('#1b1b1b')
    // El amarillo del turno futuro: clarísimo, y con texto blanco no se leería nada.
    expect(tintaSobre('#f5d020')).toBe('#1b1b1b')
  })

  it('pone texto blanco sobre un fondo oscuro', () => {
    expect(tintaSobre('#000000')).toBe('#ffffff')
    // El rojo de `ausente` y el verde de `realizado`, que ya se usan con texto blanco.
    expect(tintaSobre('#c0392b')).toBe('#ffffff')
    expect(tintaSobre('#14682c')).toBe('#ffffff')
  })

  it('no se guía por el promedio de los canales: el verde pesa más que el azul', () => {
    // Los dos tienen el mismo promedio (85), pero el verde puro se ve claro y el azul
    // puro oscuro. Un promedio simple les daría el mismo texto y a uno lo dejaría ilegible.
    expect(tintaSobre('#00ff00')).toBe('#1b1b1b')
    expect(tintaSobre('#0000ff')).toBe('#ffffff')
  })

  it('acepta el color con mayúsculas, que es como puede venir de la base', () => {
    expect(tintaSobre('#FFFFFF')).toBe('#1b1b1b')
  })
})

describe('luminancia', () => {
  it('va de 0 en el negro a 1 en el blanco', () => {
    expect(luminancia('#000000')).toBe(0)
    expect(luminancia('#ffffff')).toBeCloseTo(1, 5)
  })
})
