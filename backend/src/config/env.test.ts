import { afterEach, describe, expect, it } from 'vitest'
import { configVapid } from './env'

// Fixtures sintéticos con el largo exacto que exige VAPID, construidos acá en vez de
// pegar un par real: lo único que valida `configVapid` es el tamaño decodificado, así
// que no hace falta una clave funcional — y no queremos claves de verdad en el repo,
// que es público. 65 bytes la pública, 32 la privada.
const PUBLICA_VALIDA = Buffer.alloc(65, 4).toString('base64url')
const PRIVADA_VALIDA = Buffer.alloc(32, 7).toString('base64url')

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

function configurar(publica?: string, privada?: string, subject?: string) {
  process.env.VAPID_PUBLIC_KEY = publica
  process.env.VAPID_PRIVATE_KEY = privada
  process.env.VAPID_SUBJECT = subject
}

describe('configVapid', () => {
  it('devuelve null si no hay ninguna de las tres (el push es opcional)', () => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT
    expect(configVapid()).toBeNull()
  })

  it('tira si está configurada a medias', () => {
    configurar(PUBLICA_VALIDA, undefined, 'mailto:a@b.com')
    expect(() => configVapid()).toThrow(/incompleta/)
  })

  it('acepta un par con los largos correctos', () => {
    configurar(PUBLICA_VALIDA, PRIVADA_VALIDA, 'mailto:a@b.com')
    expect(configVapid()?.publicKey).toBe(PUBLICA_VALIDA)
  })

  // El caso que se nos escapó a producción: la clave pública quedó cortada al pegarla en
  // Render y el push falló en silencio hasta que alguien miró los logs.
  it('tira si la clave pública está cortada', () => {
    configurar(PUBLICA_VALIDA.slice(0, 60), PRIVADA_VALIDA, 'mailto:a@b.com')
    expect(() => configVapid()).toThrow(/VAPID_PUBLIC_KEY inválida/)
  })

  it('dice cuántos bytes encontró y cuántos esperaba', () => {
    configurar(PRIVADA_VALIDA, PRIVADA_VALIDA, 'mailto:a@b.com')
    expect(() => configVapid()).toThrow(/se esperaban 65/)
  })

  it('tira si las dos claves están cruzadas', () => {
    configurar(PRIVADA_VALIDA, PUBLICA_VALIDA, 'mailto:a@b.com')
    expect(() => configVapid()).toThrow(/VAPID_PUBLIC_KEY inválida/)
  })

  it('tira si la clave privada tiene el largo equivocado', () => {
    configurar(PUBLICA_VALIDA, PUBLICA_VALIDA, 'mailto:a@b.com')
    expect(() => configVapid()).toThrow(/VAPID_PRIVATE_KEY inválida/)
  })
})
