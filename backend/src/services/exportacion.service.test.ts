import { describe, expect, it } from 'vitest'
import {
  agruparPorDia,
  agruparPorSemana,
  resumirRealizados,
  type SemanaExportada,
} from './exportacion.service'
import type { TurnoConCliente } from './clientes.service'

// HU-30 — En qué hoja cae cada turno y cuánto suma cada semana.
//
// Se testea sin base porque `agruparPorSemana` es pura: recibe turnos y devuelve hojas. Lo
// que se fija acá es lo que haría que la planilla mienta — un turno que se pierde entre dos
// hojas, o un total que no coincide con la pantalla de Cobros.

/** Lo mínimo que mira el agrupador. El resto de `TurnoConCliente` no participa, así que se
 * completa con un cast: pedirlo entero obligaría a inventar veinte campos por turno y
 * escondería cuáles son los que de verdad deciden. */
function turno(
  fechaIso: string,
  extra: Partial<Pick<TurnoConCliente, 'estado' | 'medioPago' | 'montoCobrado'>> = {},
): TurnoConCliente {
  return {
    fecha: new Date(`${fechaIso}T00:00:00.000Z`),
    estado: 'realizado',
    medioPago: null,
    montoCobrado: null,
    ...extra,
  } as TurnoConCliente
}

// Referencia del calendario de 2026 usada en todos los casos:
//   domingo 9 · lunes 10 · martes 11 · miércoles 12 · jueves 13 · viernes 14 · sábado 15
//   domingo 16 · lunes 17 · martes 18 …
describe('agruparPorSemana', () => {
  it('pone el martes y el sábado de la misma semana en una sola hoja', () => {
    const semanas = agruparPorSemana([
      turno('2026-08-11'),
      turno('2026-08-15'),
    ])

    expect(semanas).toHaveLength(1)
    expect(semanas[0].turnos).toHaveLength(2)
  })

  // Los dos bordes juntos, que es la disciplina que el proyecto ya usa para el cierre y
  // para el límite semanal: fijar uno solo deja lugar a que el otro se corra sin que nada
  // falle.
  it('separa el sábado del martes siguiente en hojas distintas', () => {
    const semanas = agruparPorSemana([
      turno('2026-08-15'), // sábado
      turno('2026-08-18'), // martes de la semana que viene
    ])

    expect(semanas).toHaveLength(2)
    expect(semanas[0].ancla).toBe('2026-08-09')
    expect(semanas[1].ancla).toBe('2026-08-16')
  })

  /** ⚠️ El caso que justifica que la semana se agrupe de domingo a sábado aunque la hoja se
   * lea de martes a sábado. Si el corte empezara el martes, este turno no tendría hoja y
   * desaparecería del archivo sin que nada lo delatara. */
  it('no pierde un turno de lunes, aunque Ariel no abra los lunes', () => {
    const semanas = agruparPorSemana([
      turno('2026-08-17'), // lunes
      turno('2026-08-18'), // martes siguiente, misma semana
    ])

    expect(semanas).toHaveLength(1)
    expect(semanas[0].turnos).toHaveLength(2)
    expect(semanas[0].nombreHoja).toContain('18-22 ago')
  })

  it('no genera hoja para una semana sin turnos', () => {
    const semanas = agruparPorSemana([
      turno('2026-08-11'),
      turno('2026-09-01'), // tres semanas después
    ])

    expect(semanas).toHaveLength(2)
  })

  it('ordena las semanas de la más vieja a la más nueva, sin importar cómo entraron', () => {
    const semanas = agruparPorSemana([turno('2026-09-01'), turno('2026-08-11')])
    expect(semanas.map((s) => s.ancla)).toEqual(['2026-08-09', '2026-08-30'])
  })

  /** ⚠️ Excel rechaza el libro si dos pestañas se llaman igual, y con el tope de 425 días
   * entran dos agostos de años distintos. El número de semana es lo que las separa. */
  it('le da un nombre distinto a cada hoja aunque caigan las mismas fechas de otro año', () => {
    const semanas = agruparPorSemana([
      turno('2026-08-11'),
      turno('2027-08-10'),
    ])

    const nombres = semanas.map((s) => s.nombreHoja)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('titula la hoja por su martes y su sábado, no por el domingo que la ancla', () => {
    const [semana] = agruparPorSemana([turno('2026-08-11')])
    expect(semana.titulo).toBe('Semana del martes 11 al sábado 15 de agosto de 2026')
  })

  it('nombra el rango con los dos meses cuando la semana los cruza', () => {
    // martes 29 de septiembre al sábado 3 de octubre de 2026
    const [semana] = agruparPorSemana([turno('2026-09-29')])
    expect(semana.nombreHoja).toContain('29 sep-3 oct')
  })
})

describe('agruparPorDia', () => {
  it('junta en un bloque los turnos del mismo día y los separa de los de otro', () => {
    const dias = agruparPorDia([
      turno('2026-08-11'),
      turno('2026-08-11'),
      turno('2026-08-13'),
    ])

    expect(dias.map((d) => d.fecha)).toEqual(['2026-08-11', '2026-08-13'])
    expect(dias[0].turnos).toHaveLength(2)
    expect(dias[1].turnos).toHaveLength(1)
  })

  it('titula el bloque con el día en letras, que es la banda que abre el grupo', () => {
    const [dia] = agruparPorDia([turno('2026-08-11')])
    expect(dia.titulo).toBe('martes 11 de agosto')
  })

  /** El subtotal de la banda tiene que cerrar con las filas que quedan debajo: si no, la
   * planilla se contradice sola dentro de la misma pantalla. */
  it('le da a cada día su propio total, y la suma de los días da el de la semana', () => {
    const turnos = [
      turno('2026-08-11', { medioPago: 'efectivo', montoCobrado: 16000 }),
      turno('2026-08-11', { medioPago: 'efectivo', montoCobrado: 20000 }),
      turno('2026-08-13', { medioPago: 'transferencia', montoCobrado: 25000 }),
    ]
    const dias = agruparPorDia(turnos)

    expect(dias.map((d) => d.resumen.total)).toEqual([36000, 25000])
    expect(dias.reduce((acc, d) => acc + d.resumen.total, 0)).toBe(
      resumirRealizados(turnos).total,
    )
  })

  it('no genera bloque para un día sin turnos', () => {
    // Entre el 11 y el 15 hay tres días sin nada; no tienen por qué ocupar una banda.
    const dias = agruparPorDia([turno('2026-08-11'), turno('2026-08-15')])
    expect(dias).toHaveLength(2)
  })

  it('cuelga los días de su semana, en orden, dentro de la hoja', () => {
    const [semana] = agruparPorSemana([
      turno('2026-08-13'),
      turno('2026-08-11'),
    ])

    expect(semana.dias.map((d) => d.fecha)).toEqual([
      '2026-08-11',
      '2026-08-13',
    ])
  })
})

describe('resumirRealizados', () => {
  const cobrado = (fecha: string, monto: number) =>
    turno(fecha, { estado: 'realizado', medioPago: 'efectivo', montoCobrado: monto })

  /** ⚠️ La razón por la que el filtro por estado vive acá y no adentro de `resumirCobros`:
   * esa función cuenta como "sin cobrar" cualquier fila que le llegue sin monto. Sin este
   * filtro, un turno que el cliente canceló aparecería en la planilla como plata que Ariel
   * se olvidó de cobrar. */
  it('ignora a los cancelados en vez de contarlos como pendientes de cobro', () => {
    const r = resumirRealizados([
      cobrado('2026-08-11', 16000),
      turno('2026-08-12', { estado: 'cancelado' }),
      turno('2026-08-13', { estado: 'reservado' }),
    ])

    expect(r.total).toBe(16000)
    expect(r.sinRegistrar).toBe(0)
  })

  it('cuenta como pendiente al realizado que todavía no tiene cobro', () => {
    const r = resumirRealizados([
      cobrado('2026-08-11', 16000),
      turno('2026-08-12', { estado: 'realizado' }),
    ])

    expect(r.total).toBe(16000)
    expect(r.sinRegistrar).toBe(1)
  })

  /** El resumen del período y el pie de cada hoja van uno al lado del otro en el archivo:
   * si no cerraran entre sí, la planilla no serviría para nada. */
  it('da lo mismo sumar el período entero que sumar hoja por hoja', () => {
    const turnos = [
      cobrado('2026-08-11', 16000),
      cobrado('2026-08-15', 10000),
      cobrado('2026-08-18', 25000),
      turno('2026-08-19', { estado: 'realizado' }),
    ]

    const total = resumirRealizados(turnos)
    const semanas: SemanaExportada[] = agruparPorSemana(turnos)

    expect(semanas.reduce((acc, s) => acc + s.resumen.total, 0)).toBe(total.total)
    expect(semanas.reduce((acc, s) => acc + s.resumen.sinRegistrar, 0)).toBe(
      total.sinRegistrar,
    )
  })
})

/** HU-27, enmendada el 21/8/2026: `tarjeta` dejó de ofrecerse en el panel, pero el enum de la
 * base la conserva. Estos casos fijan que sacarla de la lista de opciones no borre plata que
 * ya se cobró — el desglose de la planilla tiene que seguir cerrando con su propio total. */
describe('un medio de pago que ya no se ofrece', () => {
  it('sigue sumando al total del período', () => {
    const r = resumirRealizados([
      turno('2026-08-11', { medioPago: 'efectivo', montoCobrado: 16000 }),
      turno('2026-08-12', { medioPago: 'tarjeta', montoCobrado: 9000 }),
    ])

    expect(r.total).toBe(25000)
    expect(r.porMedio).toContainEqual({
      medioPago: 'tarjeta',
      total: 9000,
      turnos: 1,
    })
  })

  it('la suma de los medios sigue dando el total', () => {
    const r = resumirRealizados([
      turno('2026-08-11', { medioPago: 'tarjeta', montoCobrado: 9000 }),
      turno('2026-08-11', { medioPago: 'transferencia', montoCobrado: 20000 }),
    ])

    expect(r.porMedio.reduce((acc, f) => acc + f.total, 0)).toBe(r.total)
  })
})
