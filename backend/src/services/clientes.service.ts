// HU-25 — Fichas de clientes.
//
// La identidad de una persona es su **teléfono normalizado**, no su nombre. Es la única
// decisión de fondo de esta etapa y vale explicarla: el nombre que tipea el cliente
// cambia de una reserva a la otra ("Juan", "juan perez", "Juan P."), y adivinar que esos
// tres son la misma persona es exactamente el tipo de heurística que se equivoca en
// silencio. El número, en cambio, es el mismo — una vez traducido a E.164, que es para lo
// que ya existe `utils/telefono.ts` desde la Etapa 2 de la v3.
//
// La contracara honesta: un turno sin teléfono no tiene ficha. Ariel puede cargar uno sin
// el número (HU-08), y en ese caso no hay identidad que reconocer. Se engancha solo en
// cuanto le carga el teléfono desde el panel.

import { prisma } from '../config/prisma'
import {
  ClienteNoEncontradoError,
  EtiquetaDuplicadaError,
  EtiquetaNoEncontradaError,
} from './errores'
import { aE164 } from '../utils/telefono'
import type { Cliente, Prisma } from '../../generated/prisma/client.ts'

/** La ficha con sus insignias resueltas, que es como la consume todo el resto. */
export type ClienteConEtiquetas = Prisma.ClienteGetPayload<{
  include: { etiquetas: { include: { etiqueta: true } } }
}>

/** Lo que hay que pedirle a Prisma para que un turno traiga la ficha de su cliente.
 *
 * Está acá y no repetido en cada consulta porque `turnoAdminDto` cuenta con que la
 * relación venga cargada: si una consulta se olvidara, la agenda mostraría turnos sin
 * insignias y sin apodo sin que nada falle. */
export const INCLUDE_CLIENTE = {
  cliente: { include: { etiquetas: { include: { etiqueta: true } } } },
} as const

/** Un turno con la ficha de su cliente resuelta. Es lo que devuelven las consultas de
 * admin, y lo que `turnoAdminDto` espera recibir. */
export type TurnoConCliente = Prisma.TurnoGetPayload<{
  include: typeof INCLUDE_CLIENTE
}>

const MAX_CLIENTES = 500

/**
 * Encuentra —o crea— la ficha de quien reserva, a partir del teléfono que dejó.
 *
 * Devuelve `null` cuando no hay teléfono o cuando no se puede interpretar como un número
 * de verdad: no hay identidad, así que no hay ficha. Crear una igual, con el nombre como
 * clave, uniría a dos personas distintas que se llaman igual — que es peor que no tener
 * ficha.
 *
 * El `nombre` se pisa en cada turno a propósito: es cómo se presenta el cliente hoy. El
 * `apodo` que le pone Ariel no se toca nunca desde acá, por el mismo motivo por el que la
 * sincronización de feriados no pisa la `modalidad`: es la única parte de la fila que
 * refleja una decisión suya.
 */
export async function vincularCliente(
  telefono: string | null | undefined,
  nombre: string,
): Promise<string | null> {
  if (!telefono) return null

  const e164 = aE164(telefono)
  if (!e164) return null

  // Se mira antes del upsert si la ficha ya existía: es la única forma de saber si esta
  // reserva es la primera de esa persona, porque el upsert devuelve lo mismo en los dos
  // casos. Es una consulta más sobre una columna única, en el alta de un turno.
  const yaExistia = await prisma.cliente.findUnique({
    where: { telefonoE164: e164 },
    select: { id: true },
  })

  const cliente = await prisma.cliente.upsert({
    where: { telefonoE164: e164 },
    create: { telefonoE164: e164, nombre },
    update: { nombre },
    select: { id: true },
  })

  if (!yaExistia) await marcarComoClienteNuevo(cliente.id)

  return cliente.id
}

/** La clave de la etiqueta que el sistema pone solo. Es una identidad estable, aparte del
 * nombre: Ariel puede renombrarla y recolorearla sin romper esto. */
export const CLAVE_CLIENTE_NUEVO = 'cliente_nuevo'

/**
 * Le pone la etiqueta "Nuevo" a una ficha recién creada (HU-25).
 *
 * Sirve para que Ariel sepa, mirando la agenda, que a esa persona no la tiene fichada
 * todavía —y que vale la pena ponerle el apodo o una observación cuando la atienda—. Se
 * pone **solo al crear la ficha**: la segunda reserva del mismo número no la vuelve a
 * poner, porque para entonces ya no es nueva.
 *
 * ⚠️ **No se saca sola.** Queda hasta que Ariel la borre desde la ficha, que es el gesto
 * de "ya la conozco, ya la fiché". Si con el tiempo resulta molesto que se acumulen, la
 * alternativa sería sacarla al primer turno marcado como realizado — pero eso es una regla
 * nueva y no está pedida.
 *
 * Si la etiqueta no existe (Ariel la borró), no pasa nada: no se marca y el turno se crea
 * igual. Un fallo acá nunca puede voltear una reserva ya validada.
 */
async function marcarComoClienteNuevo(clienteId: string): Promise<void> {
  try {
    const etiqueta = await prisma.etiqueta.findUnique({
      where: { clave: CLAVE_CLIENTE_NUEVO },
      select: { id: true },
    })
    if (!etiqueta) return

    await prisma.clienteEtiqueta.create({
      data: { clienteId, etiquetaId: etiqueta.id },
    })
  } catch (err) {
    console.error('[clientes] no se pudo marcar la ficha como nueva:', err)
  }
}

export interface FiltrosClientes {
  /** Busca en apodo, nombre y teléfono a la vez: Ariel no piensa en campos. */
  buscar?: string
  etiquetaId?: string
}

/** Un cliente en el listado: la ficha más lo que solo se puede saber contando turnos. */
export interface ClienteResumen {
  id: string
  telefono: string
  apodo: string | null
  nombre: string
  notas: string | null
  etiquetas: { id: string; nombre: string; color: string }[]
  /** Turnos que llegó a hacerse. Los cancelados y reprogramados no cuentan: son turnos
   * que nunca ocurrieron, y contarlos infla el número justo de los clientes que más
   * cancelan — al revés de lo que Ariel quiere ver. */
  visitas: number
  /** La última vez que vino, o `null` si todavía no vino ninguna. */
  ultimaVisita: string | null
  /** El próximo turno reservado, si tiene. */
  proximoTurno: string | null
}

function etiquetasDe(cliente: ClienteConEtiquetas) {
  return cliente.etiquetas.map((ce) => ({
    id: ce.etiqueta.id,
    nombre: ce.etiqueta.nombre,
    color: ce.etiqueta.color,
  }))
}

/** El teléfono de la ficha, presentado como se lee y no como se guarda.
 *
 * En la base vive en E.164 sin `+` porque es la forma canónica que hace única la
 * identidad; mostrárselo así a Ariel sería el peor de los dos mundos. */
function telefonoLegible(e164: string): string {
  return `+${e164}`
}

export async function listarClientes(
  filtros: FiltrosClientes = {},
): Promise<ClienteResumen[]> {
  const buscar = filtros.buscar?.trim()

  // Un solo campo de búsqueda que pega contra los tres, porque Ariel no piensa en campos:
  // escribe "flaco" o "459" y espera encontrarlo.
  const condiciones: Prisma.ClienteWhereInput[] = []
  if (buscar) {
    condiciones.push(
      { apodo: { contains: buscar, mode: 'insensitive' } },
      { nombre: { contains: buscar, mode: 'insensitive' } },
    )
    // El teléfono se guarda normalizado, así que buscar "351 459" tal cual no encontraría
    // nada: se le sacan los separadores. Si lo que escribió no tiene ningún dígito, no se
    // agrega la condición — un `contains: ''` matchea a todos los clientes.
    const digitos = buscar.replace(/\D/g, '')
    if (digitos) condiciones.push({ telefonoE164: { contains: digitos } })
  }

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(filtros.etiquetaId
        ? { etiquetas: { some: { etiquetaId: filtros.etiquetaId } } }
        : {}),
      ...(condiciones.length > 0 ? { OR: condiciones } : {}),
    },
    include: {
      etiquetas: { include: { etiqueta: true } },
      turnos: {
        select: { fecha: true, estado: true },
        orderBy: { fecha: 'desc' },
      },
    },
    orderBy: [{ apodo: 'asc' }, { nombre: 'asc' }],
    take: MAX_CLIENTES,
  })

  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)

  return clientes.map((cliente) => {
    const hechos = cliente.turnos.filter(
      (t) => t.estado === 'realizado' || (t.estado === 'reservado' && t.fecha < hoy),
    )
    const proximos = cliente.turnos
      .filter((t) => t.estado === 'reservado' && t.fecha >= hoy)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

    return {
      id: cliente.id,
      telefono: telefonoLegible(cliente.telefonoE164),
      apodo: cliente.apodo,
      nombre: cliente.nombre,
      notas: cliente.notas,
      etiquetas: etiquetasDe(cliente),
      visitas: hechos.length,
      ultimaVisita: hechos[0]?.fecha.toISOString().slice(0, 10) ?? null,
      proximoTurno: proximos[0]?.fecha.toISOString().slice(0, 10) ?? null,
    }
  })
}

export async function obtenerCliente(id: string): Promise<ClienteConEtiquetas> {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { etiquetas: { include: { etiqueta: true } } },
  })
  if (!cliente) throw new ClienteNoEncontradoError()
  return cliente
}

export interface DatosCliente {
  apodo?: string | null
  notas?: string | null
  /** La lista completa de insignias, no un delta: se reemplaza tal cual llega. Es el
   * mismo criterio que el PUT del horario laboral, y por el mismo motivo — evita tener
   * que exponer un alta y una baja por separado para algo que la interfaz siempre manda
   * entero. */
  etiquetaIds?: string[]
}

export async function actualizarCliente(
  id: string,
  datos: DatosCliente,
): Promise<ClienteConEtiquetas> {
  await obtenerCliente(id)

  if (datos.etiquetaIds) {
    const existentes = await prisma.etiqueta.count({
      where: { id: { in: datos.etiquetaIds } },
    })
    if (existentes !== new Set(datos.etiquetaIds).size) {
      throw new EtiquetaNoEncontradaError()
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({
      where: { id },
      data: {
        ...(datos.apodo !== undefined ? { apodo: datos.apodo || null } : {}),
        ...(datos.notas !== undefined ? { notas: datos.notas || null } : {}),
      },
    })

    if (datos.etiquetaIds) {
      await tx.clienteEtiqueta.deleteMany({ where: { clienteId: id } })
      await tx.clienteEtiqueta.createMany({
        data: datos.etiquetaIds.map((etiquetaId) => ({
          clienteId: id,
          etiquetaId,
        })),
        skipDuplicates: true,
      })
    }
  })

  return obtenerCliente(id)
}

/** El historial de una ficha: todos sus turnos, del más nuevo al más viejo.
 *
 * Sin filtrar por estado a propósito. Que un cliente haya cancelado tres veces es
 * justamente la clase de cosa que Ariel quiere ver al abrir su ficha — esconderlo dejaría
 * el historial más prolijo y menos útil. */
export async function historialDeCliente(id: string) {
  return prisma.turno.findMany({
    where: { clienteId: id },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })
}

// --- Etiquetas ---------------------------------------------------------------------

export async function listarEtiquetas() {
  return prisma.etiqueta.findMany({ orderBy: { nombre: 'asc' } })
}

/** Código de Prisma para violación de constraint único — acá, dos insignias con el mismo
 * nombre. Se traduce a un error propio para poder responder "ya tenés una etiqueta que se
 * llama así" en vez de un 500. */
const PRISMA_UNIQUE_VIOLATION = 'P2002'

function esNombreDuplicado(err: unknown): boolean {
  return (err as { code?: string })?.code === PRISMA_UNIQUE_VIOLATION
}

export async function crearEtiqueta(datos: { nombre: string; color: string }) {
  try {
    return await prisma.etiqueta.create({ data: datos })
  } catch (err) {
    if (esNombreDuplicado(err)) throw new EtiquetaDuplicadaError()
    throw err
  }
}

export async function actualizarEtiqueta(
  id: string,
  datos: { nombre?: string; color?: string },
) {
  const etiqueta = await prisma.etiqueta.findUnique({ where: { id } })
  if (!etiqueta) throw new EtiquetaNoEncontradaError()

  try {
    return await prisma.etiqueta.update({ where: { id }, data: datos })
  } catch (err) {
    if (esNombreDuplicado(err)) throw new EtiquetaDuplicadaError()
    throw err
  }
}

/**
 * Borra una insignia de verdad, a diferencia de los servicios (que se desactivan).
 *
 * La diferencia no es un descuido: un servicio no se puede borrar porque hay turnos
 * históricos que lo referencian y perderían su significado. Una insignia solo describe
 * cómo ve Ariel a un cliente hoy; si la deja de usar, no queda ningún registro incompleto
 * atrás. El `onDelete: Cascade` de la tabla de unión se lleva las asignaciones.
 */
export async function eliminarEtiqueta(id: string): Promise<void> {
  const etiqueta = await prisma.etiqueta.findUnique({ where: { id } })
  if (!etiqueta) throw new EtiquetaNoEncontradaError()

  await prisma.etiqueta.delete({ where: { id } })
}

export function clienteDto(cliente: Cliente & { etiquetas?: ClienteConEtiquetas['etiquetas'] }) {
  return {
    id: cliente.id,
    telefono: telefonoLegible(cliente.telefonoE164),
    apodo: cliente.apodo,
    nombre: cliente.nombre,
    notas: cliente.notas,
    etiquetas: cliente.etiquetas
      ? etiquetasDe(cliente as ClienteConEtiquetas)
      : [],
  }
}
