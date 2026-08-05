import { describe, expect, it } from 'vitest'
import { generarIcs, paredArgentinaAUtc } from './ics'

// Turno el martes 4 de agosto de 2026, 15:00 a 15:30 (hora de pared argentina).
const BASE = {
  uid: 'abc-123@peluqueria-ariel',
  inicio: new Date(Date.UTC(2026, 7, 4, 15, 0)),
  fin: new Date(Date.UTC(2026, 7, 4, 15, 30)),
  titulo: 'Corte clásico',
  descripcion: 'Tu turno en la peluquería.',
  creadoEn: new Date(Date.UTC(2026, 7, 1, 10, 0)),
}

describe('paredArgentinaAUtc', () => {
  it('suma 3 horas porque Argentina es UTC-3 sin horario de verano', () => {
    const pared = new Date(Date.UTC(2026, 7, 4, 15, 0))
    expect(paredArgentinaAUtc(pared).toISOString()).toBe(
      '2026-08-04T18:00:00.000Z',
    )
  })
})

describe('generarIcs', () => {
  it('usa saltos de línea CRLF, no LF solo', () => {
    const ics = generarIcs(BASE)
    expect(ics).toContain('\r\n')
    // No debe haber ningún \n que no venga precedido de \r.
    expect(/[^\r]\n/.test(ics)).toBe(false)
  })

  it('abre y cierra el calendario y el evento', () => {
    const ics = generarIcs(BASE)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
  })

  it('convierte el horario de pared a UTC', () => {
    const ics = generarIcs(BASE)
    expect(ics).toContain('DTSTART:20260804T180000Z')
    expect(ics).toContain('DTEND:20260804T183000Z')
  })

  it('escapa punto y coma, coma y barra invertida en los textos', () => {
    const ics = generarIcs({
      ...BASE,
      titulo: 'Corte, barba; y color \\ extra',
    })
    expect(ics).toContain('SUMMARY:Corte\\, barba\\; y color \\\\ extra')
  })

  it('escapa los saltos de línea de la descripción', () => {
    const ics = generarIcs({ ...BASE, descripcion: 'Primera\nSegunda' })
    expect(ics).toContain('DESCRIPTION:Primera\\nSegunda')
  })

  it('pliega las líneas que superan los 75 octetos', () => {
    const linkLargo =
      'https://peluqueria-ariel.vercel.app/turno/6f9619ff-8b86-d011-b42d-00cf4fc964ff'
    const ics = generarIcs({
      ...BASE,
      descripcion: `Gestioná tu turno acá: ${linkLargo}`,
    })

    for (const linea of ics.split('\r\n')) {
      expect(Buffer.from(linea, 'utf8').length).toBeLessThanOrEqual(75)
    }
    // Las continuaciones empiezan con un espacio.
    expect(ics).toMatch(/\r\n /)
  })

  it('no parte un carácter multibyte al plegar', () => {
    const ics = generarIcs({
      ...BASE,
      descripcion: 'ñ'.repeat(80),
    })
    // Si cortara en el medio de un carácter UTF-8 aparecería el reemplazo U+FFFD.
    expect(ics).not.toContain('�')
  })

  it('incluye el UID y la secuencia', () => {
    const ics = generarIcs({ ...BASE, secuencia: 2 })
    expect(ics).toContain('UID:abc-123@peluqueria-ariel')
    expect(ics).toContain('SEQUENCE:2')
  })

  it('agrega un recordatorio cuando se piden minutos de aviso', () => {
    const ics = generarIcs({ ...BASE, minutosDeAviso: 120 })
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT120M')
    expect(ics).toContain('ACTION:DISPLAY')
    expect(ics).toContain('END:VALARM')
  })

  it('no agrega recordatorio si no se piden minutos de aviso', () => {
    expect(generarIcs(BASE)).not.toContain('VALARM')
  })

  it('no incluye invitados: el evento es solo del cliente', () => {
    const ics = generarIcs({ ...BASE, minutosDeAviso: 120 })
    expect(ics).not.toContain('ATTENDEE')
    expect(ics).not.toContain('ORGANIZER')
  })

  it('omite LOCATION si no hay ubicación', () => {
    expect(generarIcs(BASE)).not.toContain('LOCATION:')
    expect(generarIcs({ ...BASE, ubicacion: 'Pastor Taboada 10' })).toContain(
      'LOCATION:Pastor Taboada 10',
    )
  })
})
