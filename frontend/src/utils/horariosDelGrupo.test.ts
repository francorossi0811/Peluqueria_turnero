import { describe, expect, it } from 'vitest'
import { descontarHorariosDelGrupo } from './horariosDelGrupo'
import type { DisponibilidadDia } from '../types/api'

// La grilla real de un martes, en el paso de 20 minutos que usa el backend.
const dia = (fecha: string, horarios: string[]): DisponibilidadDia => ({
  fecha,
  horarios,
  estado: 'disponible',
  motivo: null,
})

const MARTES = dia('2026-09-08', ['10:00', '10:20', '10:40', '11:00'])
const MIERCOLES = dia('2026-09-09', ['10:00', '10:20', '10:40'])

describe('descontarHorariosDelGrupo', () => {
  // ⚠️ El que protege el caso normal: reservando un turno solo no hay nada tomado, y la
  // grilla tiene que llegar intacta.
  it('sin nada tomado devuelve la misma lista, sin tocar', () => {
    const dias = [MARTES, MIERCOLES]
    expect(descontarHorariosDelGrupo(dias, [], 20)).toBe(dias)
  })

  it('saca el horario exacto que el grupo ya tomó', () => {
    const [martes] = descontarHorariosDelGrupo(
      [MARTES],
      [{ fecha: '2026-09-08', hora: '10:20', duracionMinutos: 20 }],
      20,
    )
    expect(martes.horarios).toEqual(['10:00', '10:40', '11:00'])
  })

  // ⚠️ El que importa: un servicio largo tapa MÁS de un hueco de la grilla. Sacar solo el
  // horario exacto es el bug que llega hasta el EXCLUDE.
  it('saca los dos huecos que cubre un servicio de 30 sobre una grilla de 20', () => {
    const [martes] = descontarHorariosDelGrupo(
      [MARTES],
      [{ fecha: '2026-09-08', hora: '10:00', duracionMinutos: 30 }],
      20,
    )
    // El Corte + Barba va de 10:00 a 10:30, así que el Corte de 20 no entra ni a las 10:00
    // ni a las 10:20 (terminaría 10:40, pisando). A las 10:40 sí.
    expect(martes.horarios).toEqual(['10:40', '11:00'])
  })

  // El espejo del borde de arriba, y el caso que la mamá quiere: turnos seguidos.
  it('deja el horario que arranca justo cuando el otro termina', () => {
    const [martes] = descontarHorariosDelGrupo(
      [MARTES],
      [{ fecha: '2026-09-08', hora: '10:00', duracionMinutos: 20 }],
      20,
    )
    expect(martes.horarios).toContain('10:20')
  })

  // ⚠️ La duración del que se está eligiendo también cuenta: uno largo puede no entrar en un
  // hueco donde uno corto sí.
  it('usa la duración del turno que se está eligiendo, no solo la del tomado', () => {
    const tomado = [{ fecha: '2026-09-08', hora: '10:40', duracionMinutos: 20 }]
    // Un Corte de 20 a las 10:20 termina 10:40: entra justo.
    expect(descontarHorariosDelGrupo([MARTES], tomado, 20)[0].horarios).toContain(
      '10:20',
    )
    // Un Corte + Barba de 30 a las 10:20 terminaría 10:50: se pisa, no entra.
    expect(
      descontarHorariosDelGrupo([MARTES], tomado, 30)[0].horarios,
    ).not.toContain('10:20')
  })

  it('no toca los días en los que el grupo no tomó nada', () => {
    const [, miercoles] = descontarHorariosDelGrupo(
      [MARTES, MIERCOLES],
      [{ fecha: '2026-09-08', hora: '10:00', duracionMinutos: 20 }],
      20,
    )
    expect(miercoles.horarios).toEqual(['10:00', '10:20', '10:40'])
  })

  it('descuenta varios tomados del mismo día a la vez', () => {
    const [martes] = descontarHorariosDelGrupo(
      [MARTES],
      [
        { fecha: '2026-09-08', hora: '10:00', duracionMinutos: 20 },
        { fecha: '2026-09-08', hora: '10:40', duracionMinutos: 20 },
      ],
      20,
    )
    expect(martes.horarios).toEqual(['10:20', '11:00'])
  })
})
