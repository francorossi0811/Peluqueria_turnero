import { describe, expect, it } from 'vitest'
import {
  mensajeDeTurno,
  mensajeDeTurnosConfirmados,
  type DatosDelTurno,
} from './mensajesWhatsapp'

const ANA: DatosDelTurno = {
  nombre: 'Ana',
  servicio: 'Corte clásico',
  fecha: '2026-09-08',
  hora: '10:00',
  link: 'https://turnero.test/turno/aaa',
}
const TOTO: DatosDelTurno = {
  nombre: 'Toto',
  servicio: 'Corte clásico',
  fecha: '2026-09-08',
  hora: '10:20',
  link: 'https://turnero.test/turno/bbb',
}
const LUCA: DatosDelTurno = {
  nombre: 'Luca',
  servicio: 'Barba',
  fecha: '2026-09-08',
  hora: '10:40',
  link: 'https://turnero.test/turno/ccc',
}

describe('mensajeDeTurnosConfirmados', () => {
  // ⚠️ El test que protege el caso normal: reservando un turno solo, Ariel tiene que
  // recibir exactamente el mensaje de siempre.
  it('con un turno solo devuelve el mensaje de siempre, carácter por carácter', () => {
    expect(mensajeDeTurnosConfirmados([ANA])).toBe(
      mensajeDeTurno('confirmado', ANA),
    )
  })

  it('con varios los nombra a todos, con su nombre adelante del servicio', () => {
    const msg = mensajeDeTurnosConfirmados([ANA, TOTO, LUCA])
    expect(msg).toContain('soy Ana, reservé 3 turnos:')
    expect(msg).toContain('Ana · Corte clásico')
    expect(msg).toContain('Toto · Corte clásico')
    expect(msg).toContain('Luca · Barba')
  })

  it('lleva el link de cada turno, etiquetado con su nombre', () => {
    const msg = mensajeDeTurnosConfirmados([ANA, TOTO, LUCA])
    expect(msg).toContain('Ana: https://turnero.test/turno/aaa')
    expect(msg).toContain('Toto: https://turnero.test/turno/bbb')
    expect(msg).toContain('Luca: https://turnero.test/turno/ccc')
  })

  // El 👇 sobrevive porque `whatsappCon` va por api.whatsapp.com y no por wa.me, que lo
  // convierte en el rombito del signo de pregunta.
  it('conserva la manito que señala los links', () => {
    expect(mensajeDeTurnosConfirmados([ANA, TOTO])).toContain('👇')
  })

  it('no deja dos renglones en blanco seguidos', () => {
    const msg = mensajeDeTurnosConfirmados([ANA, TOTO, LUCA])
    expect(msg).not.toContain('\n\n\n')
  })

  it('lleva los datos para pagar una sola vez, aunque sean tres turnos', () => {
    const msg = mensajeDeTurnosConfirmados([ANA, TOTO, LUCA])
    expect(msg.split('Si querés pagar el turno por adelantado')).toHaveLength(2)
  })
})

// HU-33 — Los datos para transferir viajan en el mensaje (16/9/2026). El destino real es el
// chat del cliente: ahí le queda guardado el alias para cuando quiera pagar.
describe('los datos para pagar', () => {
  it('van al final del mensaje de confirmación, después del link', () => {
    const msg = mensajeDeTurno('confirmado', ANA)
    expect(msg).toContain(
      'Si querés pagar el turno por adelantado, acá tenés el alias 👇',
    )
    expect(msg).toContain('Alias: arielenrique22mp')
    expect(msg).toContain('CVU: 0000003100093653313742')
    expect(msg).toContain('Titular: Ariel Juan Domingo Enrique')
    // Después del link, que es lo que el cliente necesita primero.
    expect(msg.indexOf('Alias:')).toBeGreaterThan(msg.indexOf(ANA.link))
  })

  it('cierra pidiendo el comprobante, en mayúscula y al final de todo', () => {
    const msg = mensajeDeTurno('confirmado', ANA)
    expect(msg.endsWith('POR FAVOR MANDAR COMPROBANTE')).toBe(true)
    expect(mensajeDeTurnosConfirmados([ANA, TOTO])).toContain(
      'Titular: Ariel Juan Domingo Enrique\nPOR FAVOR MANDAR COMPROBANTE',
    )
  })

  it('van separados por un renglón vacío de lo que ya decía el mensaje', () => {
    expect(mensajeDeTurno('confirmado', ANA)).toContain(
      `${ANA.link}\n\nSi querés pagar el turno por adelantado`,
    )
  })

  // Los dos casos en que ofrecer el alias sería ruido, o peor: un turno cancelado no se
  // paga, y el que reprograma ya lo tenía reservado (y ya recibió los datos al sacarlo).
  it('no van en el mensaje de cancelación ni en el de reprogramación', () => {
    for (const motivo of ['cancelado', 'reprogramado', 'pedirReprogramar'] as const) {
      expect(mensajeDeTurno(motivo, ANA)).not.toContain('Alias:')
    }
  })

  it('no deja dos renglones en blanco seguidos', () => {
    expect(mensajeDeTurno('confirmado', ANA)).not.toContain('\n\n\n')
  })
})
