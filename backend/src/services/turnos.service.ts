import { prisma } from '../config/prisma'
import {
  DIAS_FUTURO_PUBLICO,
  DIAS_PASADOS_ADMIN,
  obtenerHorariosDelDia,
  obtenerServicioActivo,
} from './disponibilidad.service'
import {
  INCLUDE_CLIENTE,
  vincularCliente,
  type TurnoConCliente,
} from './clientes.service'
import {
  FueraDeHorizonteError,
  FueraDeVentanaError,
  HorarioNoDisponibleError,
  LimiteSemanalError,
  TurnoNoCobrableError,
  TurnoNoEncontradoError,
  TurnoNoModificableError,
  TurnoSeSolapaConRealizadoError,
  TurnoYaTieneEmailError,
} from './errores'
import {
  ahoraArgentina,
  combinarFechaHora,
  horaDesdeString,
} from '../utils/fechaHora'
import type {
  EstadoTurno,
  MedioPago,
  OrigenTurno,
  Turno,
} from '../../generated/prisma/client.ts'

export interface DatosNuevoTurno {
  servicioId: string
  fecha: Date
  hora: string // "HH:mm"
  clienteNombre: string
  // HU-08: opcional solo en la carga manual — el flujo público lo sigue exigiendo, y eso
  // lo garantiza el schema de validación de cada endpoint, no este tipo.
  clienteTelefono?: string
  clienteEmail?: string // HU-19: opcional, muchos clientes de Ariel no usan mail
  origen?: OrigenTurno // HU-08: admin manda 'presencial'/'llamada'/'whatsapp'; público no manda nada -> 'online'
}

export interface DatosReprogramacion {
  servicioId?: string
  fecha: Date
  hora: string // "HH:mm"
}

// CU-02: mismo límite de 60 min para cancelar y para reprogramar.
const VENTANA_MINIMA_MINUTOS = 60

const DIA_MS = 24 * 60 * 60_000

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

/** HU-08 — ¿Ariel puede cargar un turno en esta fecha?
 *
 * Hacia adelante no hay límite (ya reserva a meses vista); hacia atrás, los días de
 * `DIAS_PASADOS_ADMIN`, para que pueda registrar a los clientes de vidriera cuando tenga
 * un rato libre.
 *
 * Pura y exportada por el mismo motivo que `esCobrable`: la usan el service y el
 * controller, y la regla tiene que estar en un solo lugar.
 *
 * ⚠️ El "hoy" se calcula con getters **UTC** y no locales. Todo el backend lee fechas en
 * UTC (`utils/fechaHora.ts`) y `ahoraArgentina()` ya viene corrido; mezclar getters
 * locales acá haría que la ventana se corra un día en Render y no en la máquina de
 * desarrollo, que es la peor combinación posible. */
export function fechaCargableComoAdmin(fecha: Date, ahora: Date): boolean {
  const hoy = Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    ahora.getUTCDate(),
  )
  const minimo = hoy - DIAS_PASADOS_ADMIN * DIA_MS
  return fecha.getTime() >= minimo
}

/** HU-28 — ¿Un cliente puede reservar en esta fecha, o está demasiado lejos?
 *
 * El espejo exacto de `fechaCargableComoAdmin`: aquella pone el piso de Ariel hacia atrás,
 * esta el techo del cliente hacia adelante. Pura y exportada por el mismo motivo — la usan
 * el service y el controller, y la regla tiene que estar en un solo lugar.
 *
 * ⚠️ Misma advertencia que su espejo: el "hoy" se calcula con getters **UTC** y no locales.
 * Todo el backend lee fechas en UTC (`utils/fechaHora.ts`) y `ahoraArgentina()` ya viene
 * corrido; mezclar getters locales acá haría que el tope se corra un día en Render y no en
 * la máquina de desarrollo, que es la peor combinación posible. */
export function fechaReservablePorCliente(fecha: Date, ahora: Date): boolean {
  const hoy = Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    ahora.getUTCDate(),
  )
  const maximo = hoy + DIAS_FUTURO_PUBLICO * DIA_MS
  return fecha.getTime() <= maximo
}

/** HU-28 — Cuántos turnos puede tener una misma persona en una semana, reservando por la
 * web. Ariel no tiene tope: él carga los que hagan falta. */
export const MAX_TURNOS_POR_SEMANA = 3

/** "Semana" es una ventana **móvil** de 7 días, no lunes a domingo. La diferencia no es
 * cosmética: con la semana del calendario se pueden tener 3 turnos viernes/sábado/domingo y
 * 3 más lunes/martes, o sea 6 en cinco días, que es exactamente lo que la regla quiere
 * evitar. */
const DIAS_VENTANA = 7

/**
 * HU-28 — ¿Agregar un turno el día `nueva` deja algún tramo de 7 días corridos con más de
 * `MAX_TURNOS_POR_SEMANA` turnos de esa persona?
 *
 * Pura y sin base a propósito: la regla es aritmética de días y así se puede fijar con
 * tests, que es donde viven los casos que importan (los bordes de la ventana).
 *
 * Solo mira las ventanas que **contienen al día nuevo**, y eso es exacto, no una
 * aproximación: el conjunto ya guardado cumple el invariante (se validó al insertar cada
 * uno), así que la única forma de romperlo es por una ventana que incluya al que entra.
 * Son 7 posiciones posibles, desde la que arranca 6 días antes hasta la que arranca ese
 * mismo día.
 */
export function excedeLimiteSemanal(
  fechasExistentes: Date[],
  nueva: Date,
): boolean {
  const dia = nueva.getTime()

  for (let i = 0; i < DIAS_VENTANA; i++) {
    const inicio = dia - i * DIA_MS
    const fin = inicio + (DIAS_VENTANA - 1) * DIA_MS

    const enLaVentana = fechasExistentes.filter(
      (f) => f.getTime() >= inicio && f.getTime() <= fin,
    ).length

    if (enLaVentana + 1 > MAX_TURNOS_POR_SEMANA) return true
  }

  return false
}

/** Las fechas de los turnos de esa persona que podrían compartir una ventana de 7 días con
 * `fecha` — o sea, los que caen entre 6 días antes y 6 días después.
 *
 * Solo `reservado`: son los que ocupan la agenda. Un `cancelado` o un `ausente` liberaron
 * el rato y un `realizado` ya pasó, así que ninguno de los tres tiene por qué gastarle un
 * cupo a nadie. Es la misma familia de decisión que la lista de estados que tapan un rato en
 * `obtenerDetalleDelDia`, tomada para esta regla: acá se cuenta lo que está agendado hacia
 * adelante, no lo que ocupó un horario alguna vez. */
async function fechasReservadasCerca(
  clienteId: string,
  fecha: Date,
  excluirTurnoId?: string,
): Promise<Date[]> {
  const margen = (DIAS_VENTANA - 1) * DIA_MS

  const turnos = await prisma.turno.findMany({
    where: {
      clienteId,
      estado: 'reservado',
      fecha: {
        gte: new Date(fecha.getTime() - margen),
        lte: new Date(fecha.getTime() + margen),
      },
      ...(excluirTurnoId ? { id: { not: excluirTurnoId } } : {}),
    },
    select: { fecha: true },
  })

  return turnos.map((t) => t.fecha)
}

/** HU-28 — Tira `LimiteSemanalError` si esta persona ya llegó a su tope de turnos en la
 * semana de `fecha`. Junta la consulta con la regla pura, que es lo que hace que los dos
 * llamadores (reservar y reprogramar) no puedan aplicarla distinto.
 *
 * ⚠️ Dos requests simultáneos pueden pasar el conteo a la vez y dejar uno de más. No se
 * resuelve con una transacción a propósito: el daño real —dos personas sobre el mismo
 * rato— ya lo impide el EXCLUDE de la base, y acá lo peor que pasa es un turno extra de
 * alguien que además tuvo que hacer el esfuerzo de mandar los dos requests juntos. */
async function validarLimiteSemanal(
  clienteId: string,
  fecha: Date,
  excluirTurnoId?: string,
): Promise<void> {
  const cercanas = await fechasReservadasCerca(clienteId, fecha, excluirTurnoId)
  if (excedeLimiteSemanal(cercanas, fecha)) throw new LimiteSemanalError()
}

/**
 * CU-01 — Reservar turno. Reusa `obtenerHorariosDelDia` (CU-04) para el paso "el
 * sistema valida que el horario siga libre" en vez de reimplementar las reglas.
 */
export async function crearTurno(
  input: DatosNuevoTurno,
): Promise<TurnoConCliente> {
  const servicio = await obtenerServicioActivo(input.servicioId)

  // Sin origen = reserva pública: margen de 30 minutos y nada de pasado.
  // Con origen = HU-08, lo carga Ariel: sin margen (no tiene sentido protegerlo de sí
  // mismo) y hasta DIAS_PASADOS_ADMIN días para atrás.
  const esAdmin = Boolean(input.origen)
  const ahora = ahoraArgentina()

  // Red del controller, que ya rechaza esto con un 400 explicativo. Acá el error correcto
  // es el mismo que para cualquier horario que no existe para quien pregunta.
  if (esAdmin && !fechaCargableComoAdmin(input.fecha, ahora)) {
    throw new HorarioNoDisponibleError()
  }

  // HU-28 — El techo del cliente, y va antes que todo lo demás a propósito: `vincularCliente`
  // crea la ficha (y le pone la etiqueta "Nuevo"), así que rechazar después de ese punto
  // dejaría una ficha fantasma por una reserva que nunca existió.
  if (!esAdmin && !fechaReservablePorCliente(input.fecha, ahora)) {
    throw new FueraDeHorizonteError()
  }

  const horariosDelDia = await obtenerHorariosDelDia(servicio, input.fecha, ahora, {
    margenMinutos: esAdmin ? 0 : undefined,
    permitirPasado: esAdmin,
  })
  if (!horariosDelDia.includes(input.hora)) {
    throw new HorarioNoDisponibleError()
  }

  const horaInicio = horaDesdeString(input.hora)
  const horaFin = new Date(
    horaInicio.getTime() + servicio.duracionMinutos * 60_000,
  )

  // HU-25 — La ficha se resuelve acá, en el único lugar por el que pasan las reservas de
  // la web y las que carga Ariel a mano. Devuelve `null` si no hay teléfono o si no se
  // puede interpretar: sin identidad no hay ficha, y el turno se guarda igual.
  const clienteId = await vincularCliente(
    input.clienteTelefono,
    input.clienteNombre,
  )

  // HU-28 — El tope de turnos por semana, solo para quien reserva por la web. Necesita la
  // ficha, así que va después de resolverla; para entonces ya existía igual, porque para
  // pasarse del límite hacen falta turnos anteriores.
  //
  // El `clienteId` no puede ser null por este camino —el schema público exige un teléfono
  // que `aE164` sepa normalizar (`esTelefonoUtilizable`)— pero se chequea igual: si esa
  // regla se aflojara algún día, el límite se apagaría en silencio en vez de romperse.
  if (!esAdmin && clienteId) {
    await validarLimiteSemanal(clienteId, input.fecha)
  }

  try {
    return await prisma.turno.create({
      include: INCLUDE_CLIENTE,
      data: {
        clienteNombre: input.clienteNombre,
        clienteTelefono: input.clienteTelefono,
        clienteEmail: input.clienteEmail,
        clienteId,
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

/** HU-17 — Los turnos sin ver que hay más adelante, fuera de lo que Ariel está mirando.
 *
 * La agenda solo trae el rango visible, así que un turno que entra para dentro de tres
 * días es invisible hasta que Ariel navega hasta ahí.
 *
 * Devuelve los **ids** y no un contador para que pueda marcarlos como vistos desde donde
 * está, sin tener que ir hasta esa semana solo para apagar el aviso. Son los turnos sin
 * ver de los próximos días: en la práctica un puñado, no una lista que valga paginar. */
export async function idsNuevosDespuesDe(
  hasta: Date,
  limite: Date,
): Promise<string[]> {
  const turnos = await prisma.turno.findMany({
    where: {
      vistoPorAdmin: false,
      estado: 'reservado',
      fecha: { gt: hasta, lte: limite },
    },
    select: { id: true },
  })
  return turnos.map((t) => t.id)
}

// Trae las relaciones igual que las consultas de admin: el DTO público también necesita el
// precio del servicio desde que el cliente lo ve (enmienda a HU-27), y tener una sola forma
// de "un turno cargado" evita que un camino devuelva menos que otro sin que nada falle.
export async function obtenerTurno(id: string): Promise<TurnoConCliente> {
  const turno = await prisma.turno.findUnique({
    where: { id },
    include: INCLUDE_CLIENTE,
  })
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
export async function cancelarTurno(id: string): Promise<TurnoConCliente> {
  const turno = await obtenerTurno(id)
  validarModificable(turno, ahoraArgentina())

  return prisma.turno.update({
    where: { id },
    include: INCLUDE_CLIENTE,
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
): Promise<TurnoConCliente> {
  const original = await obtenerTurno(id)
  const ahora = ahoraArgentina()
  validarModificable(original, ahora)

  // HU-28 — Los dos topes valen igual acá: este es el otro camino por el que un cliente
  // elige una fecha. Sin el horizonte se reprograma a 2028, y sin el límite semanal queda
  // un bypass real de la regla de densidad — reservar 3 turnos en una semana y 3 en la
  // otra, y después mudar los segundos encima de los primeros.
  if (!fechaReservablePorCliente(input.fecha, ahora)) {
    throw new FueraDeHorizonteError()
  }

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

  // El turno que se está moviendo no se cuenta contra sí mismo: sin excluirlo, mover uno
  // **dentro** de su propia semana fallaría siempre que esa semana estuviera en el límite,
  // que es justo el caso en el que reprogramar no cambia nada.
  if (original.clienteId) {
    await validarLimiteSemanal(original.clienteId, input.fecha, original.id)
  }

  const horaInicio = horaDesdeString(input.hora)
  const horaFin = new Date(
    horaInicio.getTime() + servicio.duracionMinutos * 60_000,
  )

  try {
    return await prisma.$transaction(async (tx) => {
      const nuevo = await tx.turno.create({
        include: INCLUDE_CLIENTE,
        data: {
          clienteNombre: original.clienteNombre,
          clienteTelefono: original.clienteTelefono,
          // Sin esto, el cliente que reprograma se queda sin forma de recibir el link
          // nuevo — y el que tenía apunta a un turno ya en estado `reprogramado`.
          clienteEmail: original.clienteEmail,
          // HU-25 — La ficha se hereda del turno original en vez de resolverse de nuevo:
          // es la misma persona, y volver a normalizar el teléfono para llegar al mismo
          // resultado sería trabajo de más con una chance de discrepar.
          clienteId: original.clienteId,
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
): Promise<TurnoConCliente[]> {
  return prisma.turno.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      estado: { in: ['reservado', 'realizado', 'ausente'] },
    },
    include: INCLUDE_CLIENTE,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })
}

/** HU-10 — Cancelar como admin, sin la ventana de 60 min (a diferencia de CU-02). */
export async function cancelarTurnoAdmin(
  id: string,
): Promise<TurnoConCliente> {
  const turno = await obtenerTurno(id)
  validarEsReservado(turno)

  return prisma.turno.update({
    where: { id },
    include: INCLUDE_CLIENTE,
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
): Promise<TurnoConCliente> {
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
      include: INCLUDE_CLIENTE,
      data: { fecha: input.fecha, horaInicio, horaFin },
    })
  } catch (err) {
    if (esViolacionDeSolapamiento(err)) throw new HorarioNoDisponibleError()
    throw err
  }
}

/**
 * HU-27 — A qué turno se le puede registrar un cobro.
 *
 * Solo al que se hizo. Un ausente no pagó, y un cancelado o un reprogramado nunca llegó a
 * ocurrir: aceptarles un cobro dejaría entrar plata que no existe, y los totales de la
 * sección Cobros dejarían de cerrar contra la caja sin poder explicar por qué.
 *
 * Vive acá y no repetido en el controller para que la regla tenga un solo lugar: la usan
 * el schema que valida el request, `marcarTurno` y `registrarCobro`.
 */
export function esCobrable(estado: EstadoTurno): boolean {
  return estado === 'realizado'
}

/** HU-27 — El cobro de un turno. Los tres campos del esquema se escriben juntos, así que
 * acá se piden juntos: no hay forma de guardar un medio de pago sin monto ni al revés. */
export interface DatosCobro {
  medioPago: MedioPago
  /** Pesos enteros. Lo prellena el panel con el precio actual del servicio, pero manda
   * lo que Ariel confirmó: puede haberle hecho un descuento. */
  montoCobrado: number
}

/**
 * HU-12 + HU-27 — Marcar si el cliente vino o no, y de paso cómo pagó.
 *
 * El cobro viaja acá y no en una llamada aparte porque para Ariel es **un solo gesto**:
 * toca "Realizado", elige el medio y listo. Partirlo en dos requests dejaría la puerta
 * abierta a que el segundo falle y el turno quede marcado sin cobro sin que nadie se
 * entere.
 *
 * Es opcional a propósito: se puede marcar Realizado sin registrar el cobro (el cliente
 * paga después, o Ariel está apurado). Ese turno queda visible como "sin registrar" en la
 * sección Cobros y se completa con `registrarCobro`.
 */
export async function marcarTurno(
  id: string,
  estado: 'realizado' | 'ausente',
  cobro?: DatosCobro,
): Promise<TurnoConCliente> {
  const turno = await obtenerTurno(id)
  validarEsReservado(turno)

  // Que el controller ya lo rechace no vuelve redundante esta línea: la regla es del
  // negocio y tiene que valer para cualquiera que llame al service, no solo para el que
  // entra por esa ruta.
  if (cobro && !esCobrable(estado)) throw new TurnoNoCobrableError()

  try {
    return await prisma.turno.update({
      where: { id },
      include: INCLUDE_CLIENTE,
      data: {
        estado,
        ...(cobro && {
          medioPago: cobro.medioPago,
          montoCobrado: cobro.montoCobrado,
          cobradoEn: ahoraArgentina(),
        }),
      },
    })
  } catch (err) {
    // Desde que `realizado` entró al EXCLUDE (HU-08), este UPDATE puede violarlo. El
    // camino es real aunque suene raro: Ariel marca Ausente un turno (lo que libera el
    // rato), mete a otro cliente en ese hueco, lo atiende, y después se acuerda de que al
    // primero sí lo había atendido y lo marca Realizado. Ahí se pisarían dos realizados.
    //
    // Sin este catch, Ariel vería un error de Postgres crudo sobre una restricción cuyo
    // nombre no le dice nada.
    if (esViolacionDeSolapamiento(err))
      throw new TurnoSeSolapaConRealizadoError()
    throw err
  }
}

/**
 * HU-27 — Cargarle (o corregirle) el cobro a un turno ya realizado.
 *
 * Es la contracara de que el cobro sea opcional al marcar Realizado, y existe por el
 * mismo motivo que `cargarTelefonoDelTurno` (HU-25): sin esto, un turno marcado a las
 * apuradas quedaría fuera de los totales para siempre, y la sección Cobros mostraría
 * números que no cierran contra la caja sin poder explicar por qué.
 *
 * Endpoint propio y no dentro del PATCH de estado: aquel cambia el estado del turno y
 * exige que esté `reservado`; este toca un turno que ya está `realizado`, que es
 * justamente el que aquel rechaza.
 *
 * Registrar dos veces es corregir, no duplicar: se pisa el cobro anterior. No hay
 * historial de cobros por la misma razón por la que no hay tabla de auditoría de turnos.
 */
export async function registrarCobro(
  id: string,
  cobro: DatosCobro,
): Promise<TurnoConCliente> {
  const turno = await obtenerTurno(id)
  if (!esCobrable(turno.estado)) throw new TurnoNoCobrableError()

  return prisma.turno.update({
    where: { id },
    include: INCLUDE_CLIENTE,
    data: {
      medioPago: cobro.medioPago,
      montoCobrado: cobro.montoCobrado,
      cobradoEn: ahoraArgentina(),
    },
  })
}

/**
 * HU-25 — Cargarle el teléfono a un turno que se guardó sin él, y engancharlo a su ficha.
 *
 * Es la contracara de que el teléfono sea opcional en la carga manual (HU-08): sin esto,
 * todos los turnos que Ariel carga con la persona enfrente —que son muchos— quedarían
 * fuera de las fichas para siempre, y las fichas cubrirían solo lo que entra por la web.
 *
 * Va en un endpoint propio y no dentro de `editarTurno` a propósito: aquel mueve el turno
 * en el tiempo y tiene que revalidar disponibilidad; esto solo completa un dato de
 * contacto y no puede pisarle el horario a nadie. Mezclarlos obligaría a mandar fecha y
 * hora para corregir un número.
 *
 * Sin filtro por estado: un turno ya realizado es justamente donde más ganas hay de
 * completar el número, porque la persona ya vino y Ariel la quiere en su lista.
 */
export async function cargarTelefonoDelTurno(
  id: string,
  telefono: string,
): Promise<TurnoConCliente> {
  const turno = await obtenerTurno(id)

  // ⚠️ `vincularCliente` devuelve null cuando `aE164` no puede convertir el número, y eso
  // acá dejaría el teléfono escrito con `clienteId` en null: un guardado a medias que
  // devuelve 200 y se ve como "no se guardó". Lo ataja `telefonoSchema` en el controller,
  // que es el único que llama a esta función — ahí un número inconvertible es un 400 y no
  // llega hasta acá. Si alguna vez se la llama desde otro lado, hay que repetir ese
  // chequeo: este endpoint existe para armar la ficha, así que quedarse sin ella no es un
  // resultado aceptable (a diferencia de `crearTurno`, donde sí lo es).
  const clienteId = await vincularCliente(telefono, turno.clienteNombre)

  return prisma.turno.update({
    where: { id },
    include: INCLUDE_CLIENTE,
    data: { clienteTelefono: telefono, clienteId },
  })
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
}): Promise<TurnoConCliente[]> {
  return prisma.turno.findMany({
    include: INCLUDE_CLIENTE,
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
