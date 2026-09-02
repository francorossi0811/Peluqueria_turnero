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
})
