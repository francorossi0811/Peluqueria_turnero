import { describe, expect, it } from 'vitest'
import { resumirCobros } from './cobros.service'

// HU-27 — De acá salen los números que Ariel compara contra la caja al cerrar el local,
// así que las propiedades que se fijan son las que harían que no cierre: qué suma, qué no
// suma, y qué queda contado aparte en vez de desaparecer.
//
// Se testea sin base a propósito: `resumirCobros` recibe filas y devuelve totales, así que
// la regla entera se puede escribir con dos campos por turno.

const efectivo = (montoCobrado: number) =>
  ({ medioPago: 'efectivo', montoCobrado }) as const
const transferencia = (montoCobrado: number) =>
  ({ medioPago: 'transferencia', montoCobrado }) as const
const sinCobro = { medioPago: null, montoCobrado: null } as const

describe('resumirCobros', () => {
  it('suma lo cobrado y lo agrupa por medio de pago', () => {
    const r = resumirCobros([
      efectivo(8000),
      efectivo(12000),
      transferencia(10000),
    ])

    expect(r.total).toBe(30000)
    expect(r.porMedio).toEqual([
      { medioPago: 'efectivo', total: 20000, turnos: 2 },
      { medioPago: 'transferencia', total: 10000, turnos: 1 },
    ])
  })

  it('ordena los medios de mayor a menor, no por orden de aparición', () => {
    const r = resumirCobros([transferencia(5000), efectivo(9000)])
    expect(r.porMedio.map((f) => f.medioPago)).toEqual([
      'efectivo',
      'transferencia',
    ])
  })

  it('cuenta aparte el turno realizado sin cobro, y no lo suma al total', () => {
    // Es LA propiedad de la pantalla: un total al que le faltan turnos sin decirlo no
    // cierra contra la caja y no hay forma de saber por qué.
    const r = resumirCobros([efectivo(8000), sinCobro, sinCobro])

    expect(r.total).toBe(8000)
    expect(r.sinRegistrar).toBe(2)
    // Y no aparece como un medio de pago fantasma en el desglose.
    expect(r.porMedio).toHaveLength(1)
  })

  it('no lo cuenta como cobro de $0: un pendiente no es un turno gratis', () => {
    const r = resumirCobros([sinCobro])
    expect(r.porMedio).toEqual([])
    expect(r.sinRegistrar).toBe(1)
  })

  it('un cobro de $0 sí es un cobro: cobrado y gratis no son lo mismo', () => {
    // El caso de Ariel: le corta el pelo a un amigo y no le cobra. Quedó registrado, así
    // que no tiene que aparecer en la lista de "me falta cobrar".
    const r = resumirCobros([efectivo(0)])

    expect(r.sinRegistrar).toBe(0)
    expect(r.porMedio).toEqual([{ medioPago: 'efectivo', total: 0, turnos: 1 }])
  })

  it('sobre un período sin turnos devuelve cero, no se rompe', () => {
    expect(resumirCobros([])).toEqual({
      total: 0,
      porMedio: [],
      sinRegistrar: 0,
    })
  })

  it('el total es siempre la suma del desglose', () => {
    // Si alguna vez se calcularan por separado, este test se cae — que es el punto: los
    // dos números están uno al lado del otro en pantalla y no pueden contradecirse.
    const r = resumirCobros([
      efectivo(8000),
      transferencia(12500),
      sinCobro,
      { medioPago: 'mercado_pago', montoCobrado: 7000 },
      { medioPago: 'tarjeta', montoCobrado: 3000 },
    ])

    expect(r.total).toBe(r.porMedio.reduce((acc, f) => acc + f.total, 0))
    expect(r.total).toBe(30500)
  })
})
