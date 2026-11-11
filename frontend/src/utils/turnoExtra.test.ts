import { describe, expect, it } from 'vitest'
import {
  botonesExtraDelDia,
  FIN_DEL_DIA_MINUTOS,
  huecosExtraDelDia,
  proximaHoraExtra,
} from './turnoExtra'
import type { Bloqueo, EstadoTurno, Feriado, FranjaHorario } from '../types/api'

// Martes con las franjas reales de Ariel: 10-13 y 17-20.
const DIA = '2026-11-10'
const FRANJAS: FranjaHorario[] = [
  { diaSemana: 2, horaInicio: '10:00', horaFin: '13:00' },
  { diaSemana: 2, horaInicio: '17:00', horaFin: '20:00' },
]
const MANANA = { desde: 13 * 60, hasta: 17 * 60 }
const NOCHE = { desde: 20 * 60, hasta: FIN_DEL_DIA_MINUTOS }

function feriado(modalidad: Feriado['modalidad']): Feriado {
  return { id: 1, fecha: DIA, nombre: 'Feriado', modalidad }
}

function turno(hora: string, horaFin: string, estado: EstadoTurno = 'reservado') {
  return { hora, horaFin, estado }
}

describe('huecosExtraDelDia', () => {
  it('la mañana sigue hasta que abre la tarde; la noche, hasta la medianoche', () => {
    expect(huecosExtraDelDia(FRANJAS, undefined)).toEqual([MANANA, NOCHE])
  })

  it('en un feriado de medio día queda solo el de la mañana, con el mismo tope', () => {
    expect(huecosExtraDelDia(FRANJAS, feriado('medio_dia'))).toEqual([MANANA])
  })

  it('en un feriado cerrado no hay ninguno', () => {
    expect(huecosExtraDelDia(FRANJAS, feriado('cerrado'))).toEqual([])
  })
})

describe('proximaHoraExtra', () => {
  it('sin turnos extra, propone el cierre', () => {
    expect(proximaHoraExtra(MANANA, [])).toBe(13 * 60)
  })

  it('se pega al último turno extra, para poder seguir agregando', () => {
    const turnos = [turno('13:00', '13:20'), turno('13:20', '13:50')]
    expect(proximaHoraExtra(MANANA, turnos)).toBe(13 * 60 + 50)
  })

  it('un ausente o un cancelado no empujan: ese rato quedó libre', () => {
    const turnos = [
      turno('13:00', '13:20', 'ausente'),
      turno('13:20', '13:40', 'cancelado'),
    ]
    expect(proximaHoraExtra(MANANA, turnos)).toBe(13 * 60)
  })

  it('los turnos de dentro del horario no cuentan', () => {
    expect(proximaHoraExtra(MANANA, [turno('12:40', '13:00')])).toBe(13 * 60)
  })

  it('sigue la cadena desde el cierre: un extra suelto más tarde no esconde el hueco del medio', () => {
    const turnos = [turno('16:40', '17:00'), turno('13:00', '13:20')]
    expect(proximaHoraExtra(MANANA, turnos)).toBe(13 * 60 + 20)
  })

  it('cuando el rato está lleno hasta el tope, ya no hay botón', () => {
    expect(proximaHoraExtra(MANANA, [turno('13:00', '17:00')])).toBeNull()
  })
})

describe('botonesExtraDelDia', () => {
  it('un botón por rato, cada uno con su hora', () => {
    const botones = botonesExtraDelDia(
      DIA,
      FRANJAS,
      undefined,
      [turno('20:00', '20:30')],
      [],
    )
    expect(botones).toEqual([
      { cierre: 13 * 60, hora: 13 * 60, tope: 17 * 60 },
      { cierre: 20 * 60, hora: 20 * 60 + 30, tope: FIN_DEL_DIA_MINUTOS },
    ])
  })

  it('un bloqueo de todo el día se come también los botones', () => {
    const vacaciones: Bloqueo = {
      id: 'b',
      fechaInicio: '2026-11-09',
      fechaFin: '2026-11-15',
      horaInicio: null,
      horaFin: null,
      motivo: 'Vacaciones',
    }
    expect(botonesExtraDelDia(DIA, FRANJAS, undefined, [], [vacaciones])).toEqual([])
  })
})
