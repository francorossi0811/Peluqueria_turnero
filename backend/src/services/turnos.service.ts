import { prisma } from '../config/prisma'
import {
  obtenerHorariosDelDia,
  obtenerServicioActivo,
} from './disponibilidad.service'
import {
  FueraDeVentanaError,
  HorarioNoDisponibleError,
  TurnoNoEncontradoError,
  TurnoNoModificableError,
} from './errores'
import {
  ahoraArgentina,
  combinarFechaHora,
  horaDesdeString,
} from '../utils/fechaHora'
import type { Turno } from '../../generated/prisma/client.ts'

export interface DatosNuevoTurno {
  servicioId: string
  fecha: Date
  hora: string // "HH:mm"
  clienteNombre: string
  clienteTelefono: string
}

export interface DatosReprogramacion {
  servicioId?: string
  fecha: Date
  hora: string // "HH:mm"
}

// CU-02: mismo límite de 60 min para cancelar y para reprogramar.
const VENTANA_MINIMA_MINUTOS = 60

// SQLSTATE de PostgreSQL para violación de un EXCLUDE constraint (nuestro anti
// doble-reserva, ver Docs/modelo-datos.md). No es un código que Prisma conozca de
// antemano — lo agregamos a mano en la migración — así que Prisma lo reporta envuelto
// en `meta.driverAdapterError.cause.code` (verificado a mano contra Neon, ver el plan
// de esta etapa), no en el `err.code` de Prisma (ese es un P-code genérico).
const SQLSTATE_EXCLUSION_VIOLATION = '23P01'

interface ErrorConDriverAdapter {
  meta?: { driverAdapterError?: { cause?: { code?: string } } }
}

function esViolacionDeSolapamiento(err: unknown): boolean {
  const meta = (err as ErrorConDriverAdapter)?.meta
  return meta?.driverAdapterError?.cause?.code === SQLSTATE_EXCLUSION_VIOLATION
}

/**
 * CU-01 — Reservar turno. Reusa `obtenerHorariosDelDia` (CU-04) para el paso "el
 * sistema valida que el horario siga libre" en vez de reimplementar las reglas.
 */
export async function crearTurno(input: DatosNuevoTurno): Promise<Turno> {
  const servicio = await obtenerServicioActivo(input.servicioId)

  const horariosDelDia = await obtenerHorariosDelDia(
    servicio,
    input.fecha,
    ahoraArgentina(),
  )
  if (!horariosDelDia.includes(input.hora)) {
    throw new HorarioNoDisponibleError()
  }

  const horaInicio = horaDesdeString(input.hora)
  const horaFin = new Date(
    horaInicio.getTime() + servicio.duracionMinutos * 60_000,
  )

  try {
    return await prisma.turno.create({
      data: {
        clienteNombre: input.clienteNombre,
        clienteTelefono: input.clienteTelefono,
        servicioId: servicio.id,
        servicioNombreSnapshot: servicio.nombre,
        servicioDuracionSnapshot: servicio.duracionMinutos,
        fecha: input.fecha,
        horaInicio,
        horaFin,
      },
    })
  } catch (err) {
    // Flujo alternativo de CU-01: otro cliente reservó ese horario en el medio. La
    // validación de arriba tiene una ventana de carrera de milisegundos — el EXCLUDE
    // constraint de la base es la que realmente lo impide.
    if (esViolacionDeSolapamiento(err)) throw new HorarioNoDisponibleError()
    throw err
  }
}

export async function obtenerTurno(id: string): Promise<Turno> {
  const turno = await prisma.turno.findUnique({ where: { id } })
  if (!turno) throw new TurnoNoEncontradoError()
  return turno
}

// Función pura: ¿todavía faltan >= 60 min para el turno? (CU-02, HU-03/HU-04).
export function estaDentroDeVentanaDeCambio(
  turno: Pick<Turno, 'fecha' | 'horaInicio'>,
  ahora: Date,
): boolean {
  const inicioTurno = combinarFechaHora(turno.fecha, turno.horaInicio)
  const minutosRestantes = (inicioTurno.getTime() - ahora.getTime()) / 60_000
  return minutosRestantes >= VENTANA_MINIMA_MINUTOS
}

function validarModificable(turno: Turno, ahora: Date): void {
  if (turno.estado !== 'reservado') throw new TurnoNoModificableError()
  if (!estaDentroDeVentanaDeCambio(turno, ahora))
    throw new FueraDeVentanaError()
}

/** CU-02 — Cancelar turno vía link, con la ventana de 60 min (a diferencia de HU-10). */
export async function cancelarTurno(id: string): Promise<Turno> {
  const turno = await obtenerTurno(id)
  validarModificable(turno, ahoraArgentina())

  return prisma.turno.update({
    where: { id },
    data: { estado: 'cancelado' },
  })
}

/**
 * CU-02 — Reprogramar. Valida la ventana sobre el turno original y la disponibilidad
 * del nuevo horario (misma función de siempre), y en una transacción: crea el turno
 * nuevo enlazado (`turnoOrigenId`) y marca el original `reprogramado`. Si el nuevo
 * horario se ocupa en el medio, el rollback deja el original intacto en `reservado`.
 */
export async function reprogramarTurno(
  id: string,
  input: DatosReprogramacion,
): Promise<Turno> {
  const original = await obtenerTurno(id)
  const ahora = ahoraArgentina()
  validarModificable(original, ahora)

  const servicio = await obtenerServicioActivo(
    input.servicioId ?? original.servicioId,
  )

  const horariosDelDia = await obtenerHorariosDelDia(
    servicio,
    input.fecha,
    ahora,
  )
  if (!horariosDelDia.includes(input.hora)) {
    throw new HorarioNoDisponibleError()
  }

  const horaInicio = horaDesdeString(input.hora)
  const horaFin = new Date(
    horaInicio.getTime() + servicio.duracionMinutos * 60_000,
  )

  try {
    return await prisma.$transaction(async (tx) => {
      const nuevo = await tx.turno.create({
        data: {
          clienteNombre: original.clienteNombre,
          clienteTelefono: original.clienteTelefono,
          servicioId: servicio.id,
          servicioNombreSnapshot: servicio.nombre,
          servicioDuracionSnapshot: servicio.duracionMinutos,
          fecha: input.fecha,
          horaInicio,
          horaFin,
          turnoOrigenId: original.id,
        },
      })
      await tx.turno.update({
        where: { id: original.id },
        data: { estado: 'reprogramado' },
      })
      return nuevo
    })
  } catch (err) {
    if (esViolacionDeSolapamiento(err)) throw new HorarioNoDisponibleError()
    throw err
  }
}

/**
 * HU-06/HU-07 — Agenda de Ariel. `desde === hasta` es la vista diaria, un rango de 7
 * días es la semanal (mismo endpoint, ver Docs/especificacion-api.md). Solo turnos que
 * todavía ocupan ese horario: `cancelado`/`reprogramado` ya lo liberaron.
 */
export async function listarTurnosEnRango(
  desde: Date,
  hasta: Date,
): Promise<Turno[]> {
  return prisma.turno.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      estado: { in: ['reservado', 'realizado', 'ausente'] },
    },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })
}
