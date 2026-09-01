import { describe, expect, it } from 'vitest'
import { resolverVerificacion } from './verificacionWebhook'

const TOKEN = 'un-token-largo-que-invento-yo'

describe('resolverVerificacion', () => {
  it('devuelve el challenge cuando el modo y el token son los correctos', () => {
    const challenge = resolverVerificacion(
      { mode: 'subscribe', token: TOKEN, challenge: '1158201444' },
      TOKEN,
    )

    expect(challenge).toBe('1158201444')
  })

  // Es lo único que separa nuestro endpoint público de cualquiera que lo encuentre: sin
  // esta comparación, un tercero podría darse de alta como receptor de los eventos.
  it('rechaza un token que no coincide', () => {
    expect(
      resolverVerificacion(
        { mode: 'subscribe', token: 'otro', challenge: '123' },
        TOKEN,
      ),
    ).toBeNull()
  })

  it('rechaza un modo distinto de subscribe', () => {
    expect(
      resolverVerificacion(
        { mode: 'unsubscribe', token: TOKEN, challenge: '123' },
        TOKEN,
      ),
    ).toBeNull()
  })

  // ⚠️ Sin token configurado no hay con qué comparar. Devolver el challenge igual sería
  // dejar el alta abierta a cualquiera que adivine la URL.
  it('rechaza todo si no hay token configurado', () => {
    expect(
      resolverVerificacion(
        { mode: 'subscribe', token: TOKEN, challenge: '123' },
        null,
      ),
    ).toBeNull()
  })

  // `req.query` devuelve un array cuando el parámetro viene repetido y `undefined` cuando
  // falta. Un `===` sobre eso no explota, pero tampoco compara lo que uno cree.
  it('rechaza parámetros que no son un string', () => {
    expect(resolverVerificacion({}, TOKEN)).toBeNull()
    expect(
      resolverVerificacion(
        { mode: ['subscribe', 'subscribe'], token: TOKEN, challenge: '123' },
        TOKEN,
      ),
    ).toBeNull()
    expect(
      resolverVerificacion({ mode: 'subscribe', token: TOKEN }, TOKEN),
    ).toBeNull()
  })

  // Un challenge vacío pasaría los chequeos de tipo y nos haría responder 200 con el
  // cuerpo en blanco, que del lado de Meta se ve como una verificación fallida sin motivo.
  it('rechaza un challenge vacío', () => {
    expect(
      resolverVerificacion(
        { mode: 'subscribe', token: TOKEN, challenge: '' },
        TOKEN,
      ),
    ).toBeNull()
  })
})
