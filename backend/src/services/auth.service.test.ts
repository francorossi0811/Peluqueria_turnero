import { afterEach, describe, expect, it } from 'vitest'
import { jwtSecret } from '../config/env'
import {
  debeRenovarse,
  tokenPrecedeAlCambioDePassword,
} from './auth.service'

const DIA = 24 * 60 * 60
// Token emitido el 1 de agosto de 2026 a las 00:00 UTC, con 7 días de vida.
const IAT = Math.floor(Date.UTC(2026, 7, 1) / 1000)
const TOKEN = { iat: IAT, exp: IAT + 7 * DIA }

describe('debeRenovarse', () => {
  it('no renueva un token recién emitido', () => {
    expect(debeRenovarse(TOKEN, IAT)).toBe(false)
  })

  it('no renueva justo antes de la mitad de la vida', () => {
    expect(debeRenovarse(TOKEN, IAT + 3.5 * DIA - 1)).toBe(false)
  })

  it('renueva exactamente en la mitad de la vida', () => {
    expect(debeRenovarse(TOKEN, IAT + 3.5 * DIA)).toBe(true)
  })

  it('renueva pasada la mitad de la vida', () => {
    expect(debeRenovarse(TOKEN, IAT + 6 * DIA)).toBe(true)
  })

  it('no renueva si el payload no trae iat o exp', () => {
    expect(debeRenovarse({ exp: IAT + 7 * DIA }, IAT + 6 * DIA)).toBe(false)
    expect(debeRenovarse({ iat: IAT }, IAT + 6 * DIA)).toBe(false)
    expect(debeRenovarse({}, IAT + 6 * DIA)).toBe(false)
  })
})

describe('tokenPrecedeAlCambioDePassword', () => {
  it('vale si nunca se cambió la contraseña', () => {
    expect(tokenPrecedeAlCambioDePassword(IAT, null)).toBe(false)
  })

  it('vale si el token se emitió después del cambio', () => {
    const cambio = new Date((IAT - DIA) * 1000)
    expect(tokenPrecedeAlCambioDePassword(IAT, cambio)).toBe(false)
  })

  it('no vale si el token se emitió antes del cambio', () => {
    const cambio = new Date((IAT + DIA) * 1000)
    expect(tokenPrecedeAlCambioDePassword(IAT, cambio)).toBe(true)
  })

  // El caso que rompería el propio endpoint de cambio: firma el token nuevo en el mismo
  // segundo que hace el UPDATE, pero unos milisegundos antes. Si comparáramos con
  // precisión de milisegundos, ese token nacería inválido.
  it('vale si el cambio ocurrió en el mismo segundo, unos ms después', () => {
    const cambio = new Date(IAT * 1000 + 700)
    expect(tokenPrecedeAlCambioDePassword(IAT, cambio)).toBe(false)
  })

  it('vale si no hay iat', () => {
    expect(tokenPrecedeAlCambioDePassword(undefined, new Date())).toBe(false)
  })
})

describe('jwtSecret', () => {
  const original = process.env.JWT_SECRET

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })

  it('devuelve el secreto cuando está definido', () => {
    process.env.JWT_SECRET = 'un-secreto-cualquiera'
    expect(jwtSecret()).toBe('un-secreto-cualquiera')
  })

  it('lanza si falta, en vez de firmar con la cadena vacía', () => {
    delete process.env.JWT_SECRET
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/)
  })

  it('lanza también si está vacío', () => {
    process.env.JWT_SECRET = ''
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/)
  })
})
