import { describe, expect, it } from 'vitest'
import { esNombreValido, esTelefonoValido } from './validaciones'

describe('esTelefonoValido', () => {
  it('acepta los formatos que la gente escribe de verdad', () => {
    expect(esTelefonoValido('3514593325')).toBe(true)
    expect(esTelefonoValido('351 459 3325')).toBe(true)
    expect(esTelefonoValido('351-459-3325')).toBe(true)
    expect(esTelefonoValido('(351) 459 3325')).toBe(true)
    expect(esTelefonoValido('+54 351 459 3325')).toBe(true)
    expect(esTelefonoValido('  351 459 3325  ')).toBe(true)
  })

  it('rechaza texto: es el agujero que dejaba el min(6) de antes', () => {
    expect(esTelefonoValido('abcdef')).toBe(false)
    expect(esTelefonoValido('no tengo')).toBe(false)
    expect(esTelefonoValido('351 459 3325 casa')).toBe(false)
  })

  it('rechaza vacío o solo separadores', () => {
    expect(esTelefonoValido('')).toBe(false)
    expect(esTelefonoValido('   ')).toBe(false)
    expect(esTelefonoValido('---')).toBe(false)
  })

  it('exige al menos 8 dígitos', () => {
    expect(esTelefonoValido('1234567')).toBe(false)
    expect(esTelefonoValido('12345678')).toBe(true)
  })

  it('no acepta más de 15 dígitos (máximo de E.164)', () => {
    expect(esTelefonoValido('123456789012345')).toBe(true)
    expect(esTelefonoValido('1234567890123456')).toBe(false)
  })

  it('solo acepta el + como prefijo internacional, no en el medio', () => {
    expect(esTelefonoValido('351+4593325')).toBe(false)
  })
})

describe('esNombreValido', () => {
  it('acepta nombres reales, con espacios y acentos', () => {
    expect(esNombreValido('Juan')).toBe(true)
    expect(esNombreValido('Ana María')).toBe(true)
    expect(esNombreValido('José Muñoz')).toBe(true)
    expect(esNombreValido('  Martínez  ')).toBe(true)
  })

  // El motivo de que estos tres estén fijados: "solo letras" tomado al pie de la letra los
  // rechazaría, y con eso una persona no podría reservar con su propio nombre.
  it('acepta apellidos con guión y con apóstrofe, en sus dos formas', () => {
    expect(esNombreValido('Pérez-López')).toBe(true)
    expect(esNombreValido("O'Brien")).toBe(true)
    expect(esNombreValido('O’Brien')).toBe(true)
  })

  it('rechaza números y símbolos, que es lo que se pidió atajar', () => {
    expect(esNombreValido('Juan123')).toBe(false)
    expect(esNombreValido('Juan!')).toBe(false)
    expect(esNombreValido('juan@mail.com')).toBe(false)
    expect(esNombreValido('3514593325')).toBe(false)
  })

  it('rechaza vacío o solo separadores: los separadores no son un nombre', () => {
    expect(esNombreValido('')).toBe(false)
    expect(esNombreValido('   ')).toBe(false)
    expect(esNombreValido('---')).toBe(false)
    expect(esNombreValido("' '")).toBe(false)
  })
})
