import { prisma } from '../config/prisma'
import { FranjaInvalidaError } from './errores'
import type { HorarioLaboral } from '../../generated/prisma/client.ts'

export interface DatosFranja {
  diaSemana: number // 0=domingo … 6=sábado
  horaInicio: Date
  horaFin: Date
}

export async function listarHorarioLaboral(): Promise<HorarioLaboral[]> {
  return prisma.horarioLaboral.findMany({
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  })
}

function seSolapanFranjas(a: DatosFranja, b: DatosFranja): boolean {
  return a.horaInicio < b.horaFin && b.horaInicio < a.horaFin
}

/**
 * HU-14 — Valida antes de reemplazar toda la config: cada franja bien formada
 * (inicio < fin) y sin dos franjas del mismo día solapadas entre sí. No valida nada
 * contra turnos ya reservados (caso borde de modelo-datos.md: los turnos existentes
 * fuera del horario nuevo se mantienen válidos, solo cambia lo que se ofrece de ahí
 * en más).
 */
function validarFranjas(franjas: DatosFranja[]): void {
  for (const franja of franjas) {
    if (franja.diaSemana < 0 || franja.diaSemana > 6) {
      throw new FranjaInvalidaError(
        'diaSemana debe estar entre 0 (domingo) y 6 (sábado).',
      )
    }
    if (franja.horaInicio >= franja.horaFin) {
      throw new FranjaInvalidaError('horaInicio debe ser anterior a horaFin.')
    }
  }

  for (let i = 0; i < franjas.length; i++) {
    for (let j = i + 1; j < franjas.length; j++) {
      if (franjas[i].diaSemana !== franjas[j].diaSemana) continue
      if (seSolapanFranjas(franjas[i], franjas[j])) {
        throw new FranjaInvalidaError(
          'Hay dos franjas del mismo día que se solapan.',
        )
      }
    }
  }
}

/** Reemplaza toda la configuración junta (más simple que altas/bajas por fila). */
export async function reemplazarHorarioLaboral(
  franjas: DatosFranja[],
): Promise<HorarioLaboral[]> {
  validarFranjas(franjas)

  return prisma.$transaction(async (tx) => {
    await tx.horarioLaboral.deleteMany()
    if (franjas.length > 0) {
      await tx.horarioLaboral.createMany({ data: franjas })
    }
    return tx.horarioLaboral.findMany({
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    })
  })
}
