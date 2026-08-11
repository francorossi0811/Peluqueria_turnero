import { describe, expect, it } from 'vitest'
import { mapearFeriados } from './nager'

// Recorte textual de la respuesta real de Nager.Date para AR/2026, capturada al elegir la
// fuente. Se deja tal cual viene (con los campos que no usamos) para que el test falle si
// algún día cambian la forma de la respuesta.
const RESPUESTA_REAL = [
  {
    date: '2026-01-01',
    localName: 'Año Nuevo',
    name: "New Year's Day",
    countryCode: 'AR',
    fixed: false,
    global: true,
    counties: null,
    launchYear: null,
    types: ['Public'],
  },
  {
    date: '2026-05-01',
    localName: 'Día del Trabajador',
    name: 'Labour Day',
    countryCode: 'AR',
    fixed: false,
    global: true,
    counties: null,
    launchYear: null,
    types: ['Public'],
  },
]

describe('mapearFeriados', () => {
  it('usa el nombre en español, no el inglés', () => {
    // `localName` es el que Ariel y sus clientes reconocen. Si ganara `name`, el panel
    // mostraría "Labour Day" y la pantalla del cliente también.
    const feriados = mapearFeriados(RESPUESTA_REAL)

    expect(feriados.map((f) => f.nombre)).toEqual([
      'Año Nuevo',
      'Día del Trabajador',
    ])
  })

  it('ancla las fechas a medianoche UTC', () => {
    // La columna es `DATE` y el resto del proyecto compara fechas ancladas en UTC. Un
    // Date construido con hora local correría el día para media Argentina.
    const [primero] = mapearFeriados(RESPUESTA_REAL)

    expect(primero.fecha.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('cae al nombre en inglés si no vino el local', () => {
    const feriados = mapearFeriados([{ date: '2026-01-01', name: 'Holiday' }])
    expect(feriados[0].nombre).toBe('Holiday')
  })

  it('descarta las filas sin fecha o sin ningún nombre', () => {
    // Mejor perder un feriado que guardar una fila rota que después bloquea un día sin
    // que se pueda entender por qué.
    const feriados = mapearFeriados([
      { date: '2026-01-01', localName: 'Año Nuevo' },
      { date: '', localName: 'Sin fecha' },
      { date: '2026-03-24', localName: '   ' },
      { date: 'no-es-fecha', localName: 'Basura' },
    ])

    expect(feriados).toHaveLength(1)
    expect(feriados[0].nombre).toBe('Año Nuevo')
  })

  it('no explota si la respuesta no es una lista', () => {
    expect(mapearFeriados(null)).toEqual([])
    expect(mapearFeriados({ error: 'algo' })).toEqual([])
  })
})
