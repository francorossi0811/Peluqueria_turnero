import { describe, expect, it } from 'vitest'
import {
  esNombreValido,
  esTelefonoUtilizable,
  esTelefonoValido,
} from './validaciones'

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

// La regla que se le exige al número en las tres puertas (reserva, carga manual y el
// PATCH de la ficha). Lo que fija este describe es la **diferencia** con la de arriba: la
// laxa mira cómo está escrito, esta mira si el número puede existir.
describe('esTelefonoUtilizable', () => {
  it('acepta los formatos que la gente escribe de verdad', () => {
    expect(esTelefonoUtilizable('3514593325')).toBe(true)
    expect(esTelefonoUtilizable('351 459 3325')).toBe(true)
    expect(esTelefonoUtilizable('0351 15 459 3325')).toBe(true)
    expect(esTelefonoUtilizable('+54 351 459 3325')).toBe(true)
  })

  // Los dos casos que motivaron el cambio: bien escritos, imposibles de usar. Antes
  // entraban en la reserva, el turno quedaba sin ficha, y después Ariel no los podía
  // cargar a mano porque el PATCH sí los rechazaba.
  it('rechaza números bien escritos que no existen', () => {
    expect(esTelefonoValido('99999999')).toBe(true)
    expect(esTelefonoUtilizable('99999999')).toBe(false)

    expect(esTelefonoValido('2954123456')).toBe(true)
    expect(esTelefonoUtilizable('2954123456')).toBe(false)
  })

  it('sigue rechazando lo que ya rechazaba la regla de escritura', () => {
    expect(esTelefonoUtilizable('abcdef')).toBe(false)
    expect(esTelefonoUtilizable('')).toBe(false)
    expect(esTelefonoUtilizable('351 459 3325 casa')).toBe(false)
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
