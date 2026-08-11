// HU-27 — Lo cobrado en un período: el total, el desglose por medio de pago y la lista
// de turnos que lo componen.
//
// Todo sale de `turnos`; no hay tabla de cobros (ver el comentario de `medioPago` en el
// esquema).
//
// **Quién filtra y quién suma.** El filtro —qué turnos entran— es de la base: es un
// índice y un rango de fechas. La suma es de acá, y a propósito: esta pantalla siempre
// devuelve la lista de turnos del período, así que las filas ya están en memoria cuando
// hay que totalizarlas. Un `groupBy` en SQL sería un segundo viaje a Neon para calcular
// algo que se deriva de lo que ya se trajo. Y de paso `resumirCobros` queda como función
// pura, que es lo único que se puede testear de verdad sin base.

import { prisma } from '../config/prisma'
import { INCLUDE_CLIENTE, type TurnoConCliente } from './clientes.service'
import type { MedioPago } from '../../generated/prisma/client.ts'

export interface TotalPorMedio {
  medioPago: MedioPago
  total: number
  turnos: number
}

export interface ResumenDeCobros {
  /** Suma de lo cobrado en el período. Solo entra lo que tiene el cobro registrado. */
  total: number
  porMedio: TotalPorMedio[]
  /**
   * Turnos realizados en el período a los que **todavía no se les registró el cobro**.
   *
   * Va explícito y no escondido: un total al que le faltan turnos sin decirlo es peor que
   * no tener total, porque no cierra contra la caja y no hay forma de saber por qué. Con
   * este número, Ariel sabe si lo que está mirando está completo.
   */
  sinRegistrar: number
}

/** Lo mínimo que necesita el resumen. Que no pida un `Turno` entero es lo que hace que el
 * test pueda escribir los casos a mano en dos líneas. */
type FilaCobrable = {
  medioPago: MedioPago | null
  montoCobrado: number | null
}

/**
 * Suma lo cobrado y lo agrupa por medio de pago.
 *
 * Recibe **solo turnos realizados**: quién entra al período lo decide `obtenerCobros`.
 * Un turno realizado sin cobro registrado no suma en ningún lado y se cuenta aparte —
 * meterlo en el total como `0` lo haría desaparecer.
 */
export function resumirCobros(filas: FilaCobrable[]): ResumenDeCobros {
  const acumulado = new Map<MedioPago, { total: number; turnos: number }>()
  let sinRegistrar = 0

  for (const fila of filas) {
    // Los tres campos del cobro se escriben juntos, así que en la práctica no existe uno
    // sin el otro; se chequean los dos igual porque de acá salen los números que Ariel
    // compara contra la caja, y un `null` colado sumaría `NaN` a todo el total.
    if (fila.medioPago === null || fila.montoCobrado === null) {
      sinRegistrar += 1
      continue
    }
    const previo = acumulado.get(fila.medioPago) ?? { total: 0, turnos: 0 }
    acumulado.set(fila.medioPago, {
      total: previo.total + fila.montoCobrado,
      turnos: previo.turnos + 1,
    })
  }

  const porMedio = [...acumulado.entries()]
    .map(([medioPago, datos]) => ({ medioPago, ...datos }))
    // De mayor a menor: lo primero que Ariel quiere ver es por dónde le entra la plata.
    .sort((a, b) => b.total - a.total)

  return {
    total: porMedio.reduce((acc, fila) => acc + fila.total, 0),
    porMedio,
    sinRegistrar,
  }
}

/**
 * `desde` y `hasta` son inclusivos en los dos extremos: "del 1 al 31" incluye el 31.
 * `fecha` es una columna `date`, así que la comparación no arrastra husos horarios.
 *
 * Solo cuentan los `realizado`. Un cancelado o un reprogramado nunca se cobró, y un
 * ausente no pagó — de hecho el service ni siquiera deja registrarle un cobro.
 */
export async function obtenerCobros(
  desde: Date,
  hasta: Date,
): Promise<ResumenDeCobros & { turnos: TurnoConCliente[] }> {
  const turnos = await prisma.turno.findMany({
    where: { estado: 'realizado', fecha: { gte: desde, lte: hasta } },
    include: INCLUDE_CLIENTE,
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })

  return { ...resumirCobros(turnos), turnos }
}
