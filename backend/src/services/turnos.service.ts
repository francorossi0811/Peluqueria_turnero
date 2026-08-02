import { prisma } from '../config/prisma'
import {
  obtenerHorariosDelDia,
  obtenerServicioActivo,
} from './disponibilidad.service'
import { HorarioNoDisponibleError } from './errores'
import { ahoraArgentina, horaDesdeString } from '../utils/fechaHora'
import type { Turno } from '../../generated/prisma/client.ts'

export interface DatosNuevoTurno {
  servicioId: string
  fecha: Date
  hora: string // "HH:mm"
  clienteNombre: string
  clienteTelefono: string
}

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
