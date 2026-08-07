import { describe, expect, it } from 'vitest'
import { aE164 } from './telefono'

// Los casos de acá salieron de probar la librería contra números escritos como los escribe
// la gente de verdad, no de imaginarlos: cada bloque fija un comportamiento que se verificó
// a mano antes de escribir el código.

describe('aE164', () => {
  it('agrega el 9 de celular cuando el número viene sin el 15', () => {
    // El caso que importa: es el formato que sugiere el placeholder del formulario, y sin
    // este arreglo saldría `543514593325` (fijo) y el WhatsApp no llegaría nunca.
    expect(aE164('351 459 3325')).toBe('5493514593325')
    expect(aE164('3514593325')).toBe('5493514593325')
    expect(aE164('351-459-3325')).toBe('5493514593325')
    expect(aE164('(351) 459 3325')).toBe('5493514593325')
    expect(aE164('  351 459 3325  ')).toBe('5493514593325')
  })

  it('saca el 0 y el 15, que es lo que la librería ya hace bien', () => {
    expect(aE164('0351 15 459 3325')).toBe('5493514593325')
    expect(aE164('351 15 459 3325')).toBe('5493514593325')
    // Características de 4 dígitos: el motivo por el que esto no se escribe a mano.
    // Para sacar el `15` hay que saber dónde termina la característica, y las argentinas
    // van de 2 a 4 dígitos.
    expect(aE164('2954 15 456789')).toBe('5492954456789')
    expect(aE164('2657 15 412345')).toBe('5492657412345')
  })

  it('rechaza características que no existen, no solo longitudes raras', () => {
    // 10 dígitos, forma perfecta, pero `2954 123456` cae en un rango que no está asignado.
    // Es lo que distingue a la metadata `max` de la `min`, que solo mira el largo.
    expect(aE164('2954 15 123456')).toBeNull()
  })

  it('respeta los que ya vienen en formato internacional', () => {
    expect(aE164('+5493514593325')).toBe('5493514593325')
    expect(aE164('+54 9 351 459 3325')).toBe('5493514593325')
    // Con +54 pero sin el 9: sigue faltando, y hay que ponerlo igual.
    expect(aE164('+54 351 459 3325')).toBe('5493514593325')
  })

  it('maneja Buenos Aires, que tiene característica de 2 dígitos', () => {
    expect(aE164('011 15 1234 5678')).toBe('5491112345678')
    expect(aE164('1112345678')).toBe('5491112345678')
  })

  it('no toca los números de otros países', () => {
    // Un cliente uruguayo o brasileño que deja su número con prefijo internacional.
    expect(aE164('+598 99 123 456')).toBe('59899123456')
    expect(aE164('+55 11 91234 5678')).toBe('5511912345678')
  })

  it('devuelve null cuando no hay número que mandar', () => {
    expect(aE164('')).toBeNull()
    expect(aE164('   ')).toBeNull()
    expect(aE164('no tengo')).toBeNull()
    expect(aE164('123')).toBeNull()
  })

  it('devuelve null para lo que esTelefonoValido dejaría pasar pero no es un número real', () => {
    // `esTelefonoValido` solo cuenta dígitos (8 a 15): valida la *forma*, no la existencia.
    // Este pasa esa validación y aun así no hay a dónde mandarle nada, y por eso la rama de
    // WhatsApp tiene que caer al mail en vez de asumir que siempre hay destino.
    expect(aE164('00000000')).toBeNull()
  })
})
