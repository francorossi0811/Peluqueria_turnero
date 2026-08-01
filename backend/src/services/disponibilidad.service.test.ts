import { describe, expect, it } from 'vitest'
import {
  calcularHorariosDelDia,
  type Franja,
  type Intervalo,
} from './disponibilidad.service'

// Martes 4 de agosto de 2026, franjas reales de Ariel: 10-13 y 17-20.
const FECHA = new Date(Date.UTC(2026, 7, 4))
const AHORA_MADRUGADA = new Date(Date.UTC(2026, 7, 4, 6, 0)) // bien antes de que abra

function hora(h: number, m = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m))
}

const FRANJAS: Franja[] = [
  { horaInicio: hora(10), horaFin: hora(13) },
  { horaInicio: hora(17), horaFin: hora(20) },
]

describe('calcularHorariosDelDia', () => {
  it('ofrece horarios cada 20 minutos dentro de las franjas, sin invadir el descanso', () => {
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 30,
      ahora: AHORA_MADRUGADA,
    })

    expect(horarios[0]).toBe('10:00')
    expect(horarios).toContain('10:20')
    expect(horarios).toContain('12:20') // 12:20 + 30min = 12:50, entra justo
    expect(horarios).not.toContain('12:40') // 12:40 + 30min = 13:10, no entra antes del cierre
    expect(horarios).toContain('17:00')
    expect(horarios.every((h) => h < '13:00' || h >= '17:00')).toBe(true) // nada en el descanso
  })

  it('día sin franjas (cerrado) no ofrece nada', () => {
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: [],
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 30,
      ahora: AHORA_MADRUGADA,
    })
    expect(horarios).toEqual([])
  })

  it('feriado bloqueado no ofrece nada aunque haya franjas', () => {
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: true,
      duracionMinutos: 30,
      ahora: AHORA_MADRUGADA,
    })
    expect(horarios).toEqual([])
  })

  it('un turno ya reservado bloquea el horario que solapa, pero no los demás', () => {
    const ocupados: Intervalo[] = [
      {
        inicio: new Date(Date.UTC(2026, 7, 4, 10, 0)),
        fin: new Date(Date.UTC(2026, 7, 4, 10, 30)),
      },
    ]
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados,
      feriadoBloquea: false,
      duracionMinutos: 20,
      ahora: AHORA_MADRUGADA,
    })
    expect(horarios).not.toContain('10:00')
    expect(horarios).not.toContain('10:20') // 10:20-10:40 solapa con 10:00-10:30
    expect(horarios).toContain('10:40')
  })

  it('un bloqueo parcial (ej. almuerzo largo) saca esos horarios', () => {
    const ocupados: Intervalo[] = [
      {
        inicio: new Date(Date.UTC(2026, 7, 4, 17, 0)),
        fin: new Date(Date.UTC(2026, 7, 4, 18, 0)),
      },
    ]
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados,
      feriadoBloquea: false,
      duracionMinutos: 20,
      ahora: AHORA_MADRUGADA,
    })
    expect(horarios).not.toContain('17:00')
    expect(horarios).not.toContain('17:40')
    expect(horarios).toContain('18:00')
  })

  it('un servicio largo (90 min) no se ofrece si no entra completo antes del cierre', () => {
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 90,
      ahora: AHORA_MADRUGADA,
    })
    expect(horarios).toContain('11:20') // 11:20+90min = 12:50, entra justo
    expect(horarios).not.toContain('11:40') // 11:40+90min = 13:10, no entra
    expect(horarios).toContain('18:20') // 18:20+90min = 19:50, entra justo
    expect(horarios).not.toContain('18:40') // 18:40+90min = 20:10, no entra
  })

  it('respeta el margen mínimo de 30 minutos desde ahora', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 10, 15)) // hoy a las 10:15
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 20,
      ahora,
    })
    // 10:20 empieza a 5 min de "ahora", menos que el margen de 30 -> no se ofrece
    expect(horarios).not.toContain('10:20')
    expect(horarios).not.toContain('10:40')
    // 10:45 no existe en la grilla de 20 min desde las 10:00; el primero >= 10:45 es 11:00
    expect(horarios).toContain('11:00')
  })
})
