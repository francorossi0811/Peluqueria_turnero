import { beforeEach, describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { firmarTokenDeReset } from './auth.service'
import { construirMailDeReset } from './recuperacion.service'

// HU-26 — El token de restablecimiento se firma con el secreto global **más el hash actual
// de la contraseña**, y de ahí sale la propiedad que hace que valga un solo uso: al
// restablecer cambia el hash, y el token viejo deja de verificar.
//
// Se testea sin base: `firmarTokenDeReset` recibe el hash, así que la propiedad se puede
// comprobar entera con dos strings. Verificar acá con `jwt.verify` y el secreto armado a
// mano es a propósito — si alguien cambiara la fórmula del secreto en el service, este
// test se cae, que es exactamente lo que queremos que pase.

const HASH_VIEJO = '$2b$10$hashviejodeejemplo000000000000000000000000000000000'
const HASH_NUEVO = '$2b$10$hashnuevodeejemplo00000000000000000000000000000000000'
const ADMIN = { id: '11111111-1111-4111-8111-111111111111', passwordHash: HASH_VIEJO }

function verificarCon(token: string, hash: string) {
  return jwt.verify(token, `${process.env.JWT_SECRET}.${hash}`)
}

describe('firmarTokenDeReset', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-de-prueba-para-los-tests'
  })

  it('produce un token que verifica contra el hash con el que se firmó', () => {
    const token = firmarTokenDeReset(ADMIN)
    const payload = verificarCon(token, HASH_VIEJO) as {
      sub: string
      tipo: string
    }
    expect(payload.sub).toBe(ADMIN.id)
    expect(payload.tipo).toBe('reset')
  })

  it('deja de verificar cuando cambia el hash — o sea, vale una sola vez', () => {
    // Es LA propiedad del diseño: sin ella habría que llevar una tabla de tokens usados.
    const token = firmarTokenDeReset(ADMIN)
    expect(() => verificarCon(token, HASH_NUEVO)).toThrow()
  })

  it('no verifica con el secreto pelado: un token de reset no es un token de sesión', () => {
    const token = firmarTokenDeReset(ADMIN)
    expect(() => jwt.verify(token, process.env.JWT_SECRET!)).toThrow()
  })

  it('vence: trae exp y no dura más de 30 minutos', () => {
    const token = firmarTokenDeReset(ADMIN)
    const { iat, exp } = verificarCon(token, HASH_VIEJO) as {
      iat: number
      exp: number
    }
    expect(exp - iat).toBe(30 * 60)
  })

  it('dos links pedidos seguidos siguen valiendo los dos', () => {
    // Pedir "reenviar" no puede matar el link que la persona ya tiene abierto: los dos se
    // firman con el mismo hash, así que los dos verifican.
    const primero = firmarTokenDeReset(ADMIN)
    const segundo = firmarTokenDeReset(ADMIN)
    expect(() => verificarCon(primero, HASH_VIEJO)).not.toThrow()
    expect(() => verificarCon(segundo, HASH_VIEJO)).not.toThrow()
  })
})

describe('construirMailDeReset', () => {
  it('mete el link tal cual en el texto plano y en el HTML', () => {
    const { html, texto } = construirMailDeReset(
      'Ariel',
      'http://localhost:5173/admin/restablecer/abc.def.ghi',
      30,
    )
    expect(texto).toContain('http://localhost:5173/admin/restablecer/abc.def.ghi')
    expect(html).toContain('http://localhost:5173/admin/restablecer/abc.def.ghi')
  })

  it('escapa el nombre, que lo escribe una persona y termina dentro de HTML', () => {
    const { html } = construirMailDeReset('<script>alert(1)</script>', 'x', 30)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('avisa que el link vence, para que no quede uno viejo dando vueltas en la bandeja', () => {
    const { texto } = construirMailDeReset('Ariel', 'x', 30)
    expect(texto).toContain('30 minutos')
  })
})
