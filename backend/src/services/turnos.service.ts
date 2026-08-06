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
  TurnoYaTieneEmailError,
} from './errores'
import {
  ahoraArgentina,
  combinarFechaHora,
  horaDesdeString,
} from '../utils/fechaHora'
import type { OrigenTurno, Turno } from '../../generated/prisma/client.ts'

export interface DatosNuevoTurno {
  servicioId: string
  fecha: Date
  hora: string // "HH:mm"
  clienteNombre: string
  // HU-08: opcional solo en la carga manual — el flujo público lo sigue exigiendo, y eso
  // lo garantiza el schema de validación de cada endpoint, no este tipo.
  clienteTelefono?: string
  clienteEmail?: string // HU-19: opcional, muchos clientes de Ariel no usan mail
  origen?: OrigenTurno // HU-08: admin manda 'telefono'/'whatsapp'; público no manda nada -> 'online'
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

  // Sin origen = reserva pública (mantiene el margen); con origen = HU-08/admin (sin margen).
  const horariosDelDia = await obtenerHorariosDelDia(
    servicio,
    input.fecha,
    ahoraArgentina(),
    { margenMinutos: input.origen ? 0 : undefined },
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
        clienteEmail: input.clienteEmail,
        servicioId: servicio.id,
        servicioNombreSnapshot: servicio.nombre,
        servicioDuracionSnapshot: servicio.duracionMinutos,
        fecha: input.fecha,
        horaInicio,
        horaFin,
        origen: input.origen ?? 'online',
        // HU-17 — Los que carga Ariel nacen vistos: no tiene sentido marcarle como
        // "nuevo" un turno que acaba de tipear él mismo. `origen` ya distingue los dos
        // llamadores (ver el comentario de arriba), así que no hace falta nada más.
        vistoPorAdmin: Boolean(input.origen),
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

/** HU-17 — Marca turnos como vistos por Ariel. Recibe una lista porque el caso normal
 * es "ya miré la agenda, sacá el resaltado de todos". Idempotente. */
export async function marcarTurnosComoVistos(ids: string[]): Promise<number> {
  const { count } = await prisma.turno.updateMany({
    where: { id: { in: ids } },
    data: { vistoPorAdmin: true },
  })
  return count
}

/** HU-17 — Cuántos turnos sin ver hay más adelante, fuera de lo que Ariel está mirando.
 *
 * La agenda solo trae el rango visible, así que un turno que entra para dentro de tres
 * días es invisible hasta que Ariel navega hasta ahí. Esto cuenta los que quedan después
 * del rango que tiene en pantalla, para poder avisarle que están. */
export async function contarNuevosDespuesDe(
  hasta: Date,
  limite: Date,
): Promise<number> {
  return prisma.turno.count({
    where: {
      vistoPorAdmin: false,
      estado: 'reservado',
      fecha: { gt: hasta, lte: limite },
    },
  })
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

function validarEsReservado(turno: Turno): void {
  if (turno.estado !== 'reservado') throw new TurnoNoModificableError()
}

function validarVentana(turno: Turno, ahora: Date): void {
  if (!estaDentroDeVentanaDeCambio(turno, ahora))
    throw new FueraDeVentanaError()
}

// CU-02 (cliente): estado + ventana de 60 min. Las acciones de admin (HU-09/HU-10/
// HU-12, más abajo) solo validan `validarEsReservado` — Ariel no tiene ese límite.
function validarModificable(turno: Turno, ahora: Date): void {
  validarEsReservado(turno)
  validarVentana(turno, ahora)
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
          // Sin esto, el cliente que reprograma se queda sin forma de recibir el link
          // nuevo — y el que tenía apunta a un turno ya en estado `reprogramado`.
          clienteEmail: original.clienteEmail,
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
 * HU-19 — El cliente que reservó sin dejar mail lo carga después, desde la pantalla de
 * confirmación, para recibir ahí el link de gestión.
 *
 * **Se puede una sola vez por turno, y solo si todavía no tiene mail.** Ese límite no es
 * un capricho de producto: el id del turno *es* el token de acceso, así que cualquiera
 * con el link puede llamar a este endpoint. Sin el límite, el backend sería una máquina
 * de mandar mails a direcciones arbitrarias, todas las veces que se quiera. Con él, cada
 * turno dispara como mucho un mail extra, al que lo pidió.
 *
 * El `updateMany` con `clienteEmail: null` en el `where` hace que el chequeo y la
 * escritura sean una sola operación atómica: dos requests simultáneos no pueden pasar
 * los dos. El `obtenerTurno` de arriba está solo para poder decir *por qué* falló.
 */
export async function guardarEmailDelCliente(
  id: string,
  email: string,
): Promise<Turno> {
  const turno = await obtenerTurno(id)
  validarEsReservado(turno)
  if (turno.clienteEmail) throw new TurnoYaTieneEmailError()

  const { count } = await prisma.turno.updateMany({
    where: { id, estado: 'reservado', clienteEmail: null },
    data: { clienteEmail: email },
  })
  if (count === 0) throw new TurnoYaTieneEmailError()

  return obtenerTurno(id)
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

/** HU-10 — Cancelar como admin, sin la ventana de 60 min (a diferencia de CU-02). */
export async function cancelarTurnoAdmin(id: string): Promise<Turno> {
  const turno = await obtenerTurno(id)
  validarEsReservado(turno)

  return prisma.turno.update({
    where: { id },
    data: { estado: 'cancelado' },
  })
}

/**
 * HU-09 — Editar turno: mueve el mismo turno a otro horario (no crea uno nuevo como el
 * reprogramar del cliente en CU-02), sin ventana de 60 min. Sigue validando
 * disponibilidad real vía `obtenerHorariosDelDia` — no se pueden pisar turnos tampoco
 * acá — excluyéndose a sí mismo para no chocar contra su propio horario viejo. La
 * duración es la del snapshot: no cambia el servicio, solo cuándo.
 */
export async function editarTurno(
  id: string,
  input: { fecha: Date; hora: string },
): Promise<Turno> {
  const turno = await obtenerTurno(id)
  validarEsReservado(turno)

  const horariosDelDia = await obtenerHorariosDelDia(
    { duracionMinutos: turno.servicioDuracionSnapshot },
    input.fecha,
    ahoraArgentina(),
    { excluirTurnoId: turno.id, margenMinutos: 0 },
  )
  if (!horariosDelDia.includes(input.hora)) {
    throw new HorarioNoDisponibleError()
  }

  const horaInicio = horaDesdeString(input.hora)
  const horaFin = new Date(
    horaInicio.getTime() + turno.servicioDuracionSnapshot * 60_000,
  )

  try {
    return await prisma.turno.update({
      where: { id },
      data: { fecha: input.fecha, horaInicio, horaFin },
    })
  } catch (err) {
    if (esViolacionDeSolapamiento(err)) throw new HorarioNoDisponibleError()
    throw err
  }
}

/** HU-12 — Marcar si el cliente vino o no. */
export async function marcarTurno(
  id: string,
  estado: 'realizado' | 'ausente',
): Promise<Turno> {
  const turno = await obtenerTurno(id)
  validarEsReservado(turno)

  return prisma.turno.update({ where: { id }, data: { estado } })
}

const MAX_RESULTADOS_BUSQUEDA = 50

/**
 * Caso borde de historias-de-usuario-casos-de-uso.md: "cliente pierde su link único" —
 * Ariel busca por nombre y/o teléfono para reenviarlo. Sin filtro de estado a propósito
 * (puede necesitar encontrar uno ya cancelado/pasado, no solo los activos).
 */
export async function buscarTurnos(filtros: {
  nombre?: string
  telefono?: string
}): Promise<Turno[]> {
  return prisma.turno.findMany({
    where: {
      ...(filtros.nombre
        ? { clienteNombre: { contains: filtros.nombre, mode: 'insensitive' } }
        : {}),
      ...(filtros.telefono
        ? { clienteTelefono: { contains: filtros.telefono } }
        : {}),
    },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    take: MAX_RESULTADOS_BUSQUEDA,
  })
}
