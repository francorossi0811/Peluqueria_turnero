import { describe, expect, it } from 'vitest'
import {
  calcularHorariosDelDia,
  franjasSegunFeriado,
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

  it('con margenMinutos: 0 (acciones de admin) ofrece horarios inmediatos', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 10, 15)) // hoy a las 10:15
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 20,
      ahora,
      margenMinutos: 0,
    })
    // Sin margen, 10:20 (5 min después de "ahora") ya es válido.
    expect(horarios).toContain('10:20')
  })

  it('sin margenMinutos explícito, sigue aplicando el default de 30', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 10, 15))
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 20,
      ahora,
    })
    expect(horarios).not.toContain('10:20')
  })
})

describe('franjasSegunFeriado', () => {
  it('deja el día entero cuando Ariel decidió trabajarlo completo', () => {
    expect(franjasSegunFeriado(FRANJAS, 'dia_completo')).toEqual(FRANJAS)
  })

  it('no toca nada cuando el día no es feriado', () => {
    expect(franjasSegunFeriado(FRANJAS, null)).toEqual(FRANJAS)
  })

  it('medio día deja solo la primera franja', () => {
    // La regla es "la primera franja", no "la mañana": si Ariel cambia sus horarios en
    // el panel, esto lo sigue sin tocar código.
    expect(franjasSegunFeriado(FRANJAS, 'medio_dia')).toEqual([FRANJAS[0]])
  })

  it('elige la franja más temprana aunque vengan desordenadas', () => {
    // `horario_laboral` no garantiza orden: son filas de una tabla, no una lista.
    const alReves = [FRANJAS[1], FRANJAS[0]]
    expect(franjasSegunFeriado(alReves, 'medio_dia')).toEqual([FRANJAS[0]])
  })

  it('con una sola franja, medio día es el día entero', () => {
    const unaSola = [FRANJAS[0]]
    expect(franjasSegunFeriado(unaSola, 'medio_dia')).toEqual(unaSola)
  })

  it('un día sin franjas sigue sin franjas: el feriado no puede abrir nada', () => {
    // Es lo que hace que la regla valga "solo los días que trabaja". Un feriado que cae
    // domingo o lunes no convierte ese día en laborable.
    expect(franjasSegunFeriado([], 'medio_dia')).toEqual([])
    expect(franjasSegunFeriado([], 'dia_completo')).toEqual([])
  })
})
