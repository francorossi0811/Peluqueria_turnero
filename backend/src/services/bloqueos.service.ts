import { prisma } from '../config/prisma'
import { BloqueoNoEncontradoError } from './errores'
import { combinarFechaHora, seSolapan } from '../utils/fechaHora'
import type { BloqueoHorario, Turno } from '../../generated/prisma/client.ts'

export interface DatosBloqueo {
  fechaInicio: Date
  horaInicio: Date | null // null = desde el inicio del día
  fechaFin: Date
  horaFin: Date | null // null = hasta el cierre del día
  motivo?: string
}

// Límites de "día completo" para calcular turnos afectados — a propósito no dependen de
// horario_laboral (a diferencia de disponibilidad.service.ts): un bloqueo puede cubrir
// un día entero sin que importe cuándo abre/cierra ese día en particular.
const INICIO_DIA = new Date(Date.UTC(1970, 0, 1, 0, 0))
const FIN_DIA = new Date(Date.UTC(1970, 0, 1, 23, 59))

export async function listarBloqueos(
  desde: Date,
  hasta: Date,
): Promise<BloqueoHorario[]> {
  return prisma.bloqueoHorario.findMany({
    where: { fechaInicio: { lte: hasta }, fechaFin: { gte: desde } },
    orderBy: [{ fechaInicio: 'asc' }],
  })
}

/**
 * CU-03 — Turnos activos que quedarían dentro del bloqueo. El mismo horaInicio/horaFin
 * del bloqueo se aplica día por día dentro del rango (ver Docs/modelo-datos.md): una
 * "tarde libre" puntual o unas "vacaciones" de varios días con el mismo recorte diario.
 */
export async function obtenerTurnosAfectados(
  datos: DatosBloqueo,
): Promise<Turno[]> {
  const turnos = await prisma.turno.findMany({
    where: {
      fecha: { gte: datos.fechaInicio, lte: datos.fechaFin },
      estado: 'reservado',
    },
  })

  return turnos.filter((t) => {
    const inicioBloqueo = combinarFechaHora(
      t.fecha,
      datos.horaInicio ?? INICIO_DIA,
    )
    const finBloqueo = combinarFechaHora(t.fecha, datos.horaFin ?? FIN_DIA)
    const inicioTurno = combinarFechaHora(t.fecha, t.horaInicio)
    const finTurno = combinarFechaHora(t.fecha, t.horaFin)
    return seSolapan(inicioTurno, finTurno, inicioBloqueo, finBloqueo)
  })
}

/**
 * Crea el bloqueo y cancela los turnos afectados (motivo "bloqueado por el local",
 * `bloqueoCancelacionId` apuntando al bloqueo nuevo) en una sola transacción.
 * `turnosAfectados` se recalcula siempre server-side (ver controller) — no se confía en
 * una lista de ids que haya podido mandar el cliente.
 */
export async function crearBloqueoYCancelar(
  datos: DatosBloqueo,
  turnosAfectados: Turno[],
): Promise<BloqueoHorario> {
  return prisma.$transaction(async (tx) => {
    const bloqueo = await tx.bloqueoHorario.create({
      data: {
        fechaInicio: datos.fechaInicio,
        horaInicio: datos.horaInicio,
        fechaFin: datos.fechaFin,
        horaFin: datos.horaFin,
        motivo: datos.motivo,
      },
    })

    if (turnosAfectados.length > 0) {
      await tx.turno.updateMany({
        where: { id: { in: turnosAfectados.map((t) => t.id) } },
        data: {
          estado: 'cancelado',
          motivoCancelacion: 'Bloqueado por el local',
          bloqueoCancelacionId: bloqueo.id,
        },
      })
    }

    return bloqueo
  })
}

/**
 * Cambia el rango o el motivo de un bloqueo que ya existe, cancelando los turnos que el
 * rango nuevo se lleve puesto — mismo trato que al crearlo.
 *
 * ⚠️ Editar un bloqueo **puede cancelar turnos**, y por eso pasa por la misma confirmación
 * de dos pasos que `crearBloqueoYCancelar` y no por un update pelado: correr una tarde
 * libre de las 15:00 a las 14:00 agarra el turno de las 14:20 exactamente igual que si el
 * bloqueo se hubiera creado así. Sin esto, editar sería la puerta de atrás que se saltea
 * el aviso que la creación sí da.
 *
 * Lo que **no** hace es reabrir los turnos que el rango viejo había cancelado: es la misma
 * regla que ya tiene levantar un bloqueo (HU-11). Un turno cancelado se le avisó al
 * cliente, así que revivirlo por un cambio de rango sería devolverle un turno a alguien
 * que ya se enteró de que no lo tiene.
 */
export async function actualizarBloqueoYCancelar(
  id: string,
  datos: DatosBloqueo,
  turnosAfectados: Turno[],
): Promise<BloqueoHorario> {
  return prisma.$transaction(async (tx) => {
    const existente = await tx.bloqueoHorario.findUnique({ where: { id } })
    if (!existente) throw new BloqueoNoEncontradoError()

    const bloqueo = await tx.bloqueoHorario.update({
      where: { id },
      data: {
        fechaInicio: datos.fechaInicio,
        horaInicio: datos.horaInicio,
        fechaFin: datos.fechaFin,
        horaFin: datos.horaFin,
        motivo: datos.motivo ?? null,
      },
    })

    if (turnosAfectados.length > 0) {
      await tx.turno.updateMany({
        where: { id: { in: turnosAfectados.map((t) => t.id) } },
        data: {
          estado: 'cancelado',
          motivoCancelacion: 'Bloqueado por el local',
          bloqueoCancelacionId: bloqueo.id,
        },
      })
    }

    return bloqueo
  })
}

/** HU-11 — Levanta un bloqueo futuro. No reabre los turnos que ya canceló (ver especificacion-api.md);
 * el FK de esos turnos hacia este bloqueo queda en null por el ON DELETE SET NULL de la migración. */
export async function eliminarBloqueo(id: string): Promise<void> {
  const bloqueo = await prisma.bloqueoHorario.findUnique({ where: { id } })
  if (!bloqueo) throw new BloqueoNoEncontradoError()
  await prisma.bloqueoHorario.delete({ where: { id } })
}
