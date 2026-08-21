import { describe, expect, it } from 'vitest'
import { esquemaDeFecha, esquemaDeHora } from './esquemasFecha'
import { formatearHora, horaDesdeString } from './fechaHora'

// Los mensajes de estos schemas los lee **Ariel**, no un programador, así que lo que se fija
// acá es de las dos clases: que no entre una hora que no existe, y que el cartel se entienda.

const hora = esquemaDeHora('la hora del turno')
const fecha = esquemaDeFecha('la fecha del turno')

describe('esquemaDeHora', () => {
  it('acepta las horas del día, incluidos los dos bordes', () => {
    for (const valor of ['00:00', '09:30', '13:45', '23:59']) {
      expect(hora.safeParse(valor).success).toBe(true)
    }
  })

  /**
   * ⚠️ El caso que motivó todo esto. La validación vieja era `^\d{2}:\d{2}$`, que solo mira
   * la **forma**: `25:00` pasaba, y `horaDesdeString` la desbordaba al día siguiente dejando
   * el turno a las `01:00`. La validación decía una hora y el sistema guardaba otra, sin que
   * nada lo delatara.
   *
   * El test lo fija por los dos lados: que el schema lo rechace, y que la interpretación que
   * lo hacía peligroso siga siendo la misma (si algún día `horaDesdeString` empezara a tirar
   * error por su cuenta, este test avisa que la red de abajo cambió).
   */
  it('rechaza una hora que no existe, en vez de correrla al día siguiente', () => {
    expect(hora.safeParse('25:00').success).toBe(false)
    expect(hora.safeParse('07:75').success).toBe(false)
    expect(hora.safeParse('99:99').success).toBe(false)

    expect(formatearHora(horaDesdeString('25:00'))).toBe('01:00')
    expect(formatearHora(horaDesdeString('07:75'))).toBe('08:15')
  })

  it('rechaza la hora sin el cero adelante, que es la que rompe el orden alfabético', () => {
    expect(hora.safeParse('9:30').success).toBe(false)
  })

  it('explica el rango en vez del formato, y nombra el campo', () => {
    const r = hora.safeParse('25:00')
    expect(r.success).toBe(false)
    if (r.success) return

    const mensaje = r.error.issues[0].message
    expect(mensaje).toContain('la hora del turno')
    expect(mensaje).toContain('00:00 y 23:59')
    // Lo que NO tiene que decir: el formato interno ni el nombre del campo de la API.
    expect(mensaje).not.toContain('HH:mm')
  })
})

describe('esquemaDeFecha', () => {
  it('acepta una fecha ISO y rechaza cualquier otra cosa', () => {
    expect(fecha.safeParse('2026-08-21').success).toBe(true)
    for (const valor of ['21/08/2026', 'chirimbolo', '', 123, undefined]) {
      expect(fecha.safeParse(valor).success).toBe(false)
    }
  })

  /** El campo que falta y el campo mal escrito son dos códigos distintos en zod
   * (`invalid_type` e `invalid_format`) pero un solo problema para Ariel, así que le tienen
   * que decir lo mismo. */
  it('da el mismo mensaje entendible falte el dato o venga mal escrito', () => {
    const falta = fecha.safeParse(undefined)
    const malEscrita = fecha.safeParse('21/08/2026')
    expect(falta.success).toBe(false)
    expect(malEscrita.success).toBe(false)
    if (falta.success || malEscrita.success) return

    expect(falta.error.issues[0].message).toBe(
      malEscrita.error.issues[0].message,
    )
    expect(falta.error.issues[0].message).toContain('la fecha del turno')
    expect(falta.error.issues[0].message).not.toMatch(/ISO|Invalid/i)
  })
})
