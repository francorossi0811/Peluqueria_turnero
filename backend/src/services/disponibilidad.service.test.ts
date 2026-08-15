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

  // La grilla de 20 minutos no es la única fuente de horarios: también se ofrece el
  // momento exacto en que termina un turno. Sin esto, entre que un turno termina y llega
  // el próximo múltiplo de 20 queda un rato libre que el sistema nunca ofrecía.
  describe('los horarios se re-anclan a lo que ya está agendado', () => {
    // Los dos casos que reportó Franco desde el uso real, con las duraciones reales de
    // Ariel (Barba 15, Corte clásico 20, Corte + Barba y Corte de Pelo mujer 30).
    it('después de una Barba de 15 min a las 17:00 se puede reservar a las 17:15', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 17, 0)),
          fin: new Date(Date.UTC(2026, 7, 4, 17, 15)),
        },
      ]
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados,
        feriadoBloquea: false,
        duracionMinutos: 20, // Corte clásico
        ahora: AHORA_MADRUGADA,
      })
      expect(horarios).toContain('17:15')
      expect(horarios).not.toContain('17:00') // sigue ocupado
    })

    it('después de un turno de 30 min a las 18:00 se puede reservar a las 18:30', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 18, 0)),
          fin: new Date(Date.UTC(2026, 7, 4, 18, 30)),
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
      expect(horarios).toContain('18:30')
      // El que se ofrecía antes sigue estando: 18:30 se suma, no reemplaza a nadie.
      expect(horarios).toContain('18:40')
    })

    // El encadenado es lo que hace que la agenda se compacte sola turno a turno.
    it('encadena: dos turnos seguidos corren el próximo horario dos veces', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 17, 0)),
          fin: new Date(Date.UTC(2026, 7, 4, 17, 15)),
        },
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 17, 15)),
          fin: new Date(Date.UTC(2026, 7, 4, 17, 35)),
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
      expect(horarios).toContain('17:35')
      expect(horarios).not.toContain('17:15')
      expect(horarios).not.toContain('17:20')
    })

    // El borde que importa: el horario pegado al final de otro turno pasa por la misma
    // regla de cierre que los de la grilla. Un turno de 30 min que termina 19:50 deja
    // libre 19:50-20:00, y ahí no entra nada.
    it('el horario pegado al final NO se ofrece si el turno no entra antes del cierre', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 19, 20)),
          fin: new Date(Date.UTC(2026, 7, 4, 19, 50)),
        },
      ]
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados,
        feriadoBloquea: false,
        duracionMinutos: 20, // 19:50 + 20 = 20:10, se pasa del cierre de las 20:00
        ahora: AHORA_MADRUGADA,
      })
      expect(horarios).not.toContain('19:50')
    })

    it('un bloqueo también re-ancla: termina 17:10 y ahí se puede reservar', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 17, 0)),
          fin: new Date(Date.UTC(2026, 7, 4, 17, 10)),
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
      expect(horarios).toContain('17:10')
    })

    it('no repite el horario cuando el turno termina justo sobre la grilla', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 17, 0)),
          fin: new Date(Date.UTC(2026, 7, 4, 17, 20)),
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
      expect(horarios.filter((h) => h === '17:20')).toHaveLength(1)
    })

    // Espejo defensivo: sin nada agendado, la grilla tiene que ser exactamente la de
    // antes. Es el que se rompe si alguien empieza a generar candidatos de la nada.
    it('sin turnos ni bloqueos, la grilla sigue siendo la de 20 minutos', () => {
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados: [],
        feriadoBloquea: false,
        duracionMinutos: 20,
        ahora: AHORA_MADRUGADA,
      })
      expect(horarios.every((h) => ['00', '20', '40'].includes(h.slice(3)))).toBe(
        true,
      )
    })
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

  // El cierre no tiene tolerancia: un turno que se pasa aunque sea un minuto no se
  // ofrece, y el que termina exactamente a la hora de cierre sí. Los dos bordes van
  // juntos en el mismo test a propósito — fijar solo uno deja lugar a "redondear" el
  // otro, que es justo lo que no queremos que le pase a Ariel a la hora de cerrar.
  it('el turno que termina justo al cierre se ofrece; el que se pasa, no', () => {
    const horarios = calcularHorariosDelDia({
      fecha: FECHA,
      franjas: FRANJAS,
      ocupados: [],
      feriadoBloquea: false,
      duracionMinutos: 60,
      ahora: AHORA_MADRUGADA,
    })
    expect(horarios).toContain('12:00') // 12:00 + 60min = 13:00, la hora de cierre exacta
    expect(horarios).not.toContain('12:20') // 12:20 + 60min = 13:20, se pasa
    expect(horarios).toContain('19:00') // 19:00 + 60min = 20:00, cierra justo
    expect(horarios).not.toContain('19:20') // 19:20 + 60min = 20:20, se pasa
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

  // HU-08 — Ariel atiende clientes de vidriera y los registra cuando tiene un rato libre,
  // así que necesita que le ofrezcan horarios que ya pasaron.
  describe('permitirPasado (carga manual de Ariel)', () => {
    // Hoy al mediodía: las 10:00 y las 11:40 ya pasaron.
    const MEDIODIA = new Date(Date.UTC(2026, 7, 4, 12, 0))

    // El más importante de todos: abrir el pasado no puede aflojar el cierre. Los dos
    // bordes van juntos por el mismo motivo que en el test de más arriba.
    it('NO afloja el cierre: el que termina justo entra, el que se pasa no', () => {
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados: [],
        feriadoBloquea: false,
        duracionMinutos: 60,
        ahora: MEDIODIA,
        permitirPasado: true,
      })
      expect(horarios).toContain('12:00') // 12:00 + 60min = 13:00, la hora de cierre exacta
      expect(horarios).not.toContain('12:20') // 12:20 + 60min = 13:20, se pasa
    })

    it('ofrece los horarios que ya pasaron', () => {
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados: [],
        feriadoBloquea: false,
        duracionMinutos: 20,
        ahora: MEDIODIA,
        permitirPasado: true,
      })
      expect(horarios).toContain('10:00')
      expect(horarios).toContain('11:40')
    })

    it('ignora margenMinutos: no hay antelación que exigirle a lo que ya pasó', () => {
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados: [],
        feriadoBloquea: false,
        duracionMinutos: 20,
        ahora: MEDIODIA,
        margenMinutos: 30,
        permitirPasado: true,
      })
      expect(horarios).toContain('11:40')
    })

    it('sigue respetando los ratos ocupados', () => {
      const ocupados: Intervalo[] = [
        {
          inicio: new Date(Date.UTC(2026, 7, 4, 10, 0)),
          fin: new Date(Date.UTC(2026, 7, 4, 10, 20)),
        },
      ]
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados,
        feriadoBloquea: false,
        duracionMinutos: 20,
        ahora: MEDIODIA,
        permitirPasado: true,
      })
      expect(horarios).not.toContain('10:00')
      expect(horarios).toContain('10:20')
    })

    // Espejo defensivo: es el que se rompe si alguien invierte el default del flag.
    it('sin el flag, un horario ya pasado no se ofrece ni con margen 0', () => {
      const horarios = calcularHorariosDelDia({
        fecha: FECHA,
        franjas: FRANJAS,
        ocupados: [],
        feriadoBloquea: false,
        duracionMinutos: 20,
        ahora: MEDIODIA,
        margenMinutos: 0,
      })
      expect(horarios).not.toContain('10:00')
      expect(horarios).not.toContain('11:40')
    })
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
