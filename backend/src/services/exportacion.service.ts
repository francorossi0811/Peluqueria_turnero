// HU-30 — La agenda como planilla: qué turnos entran y cómo se agrupan en semanas.
//
// Este archivo **no sabe nada de Excel**. Decide qué se exporta y cómo se totaliza; el
// archivo lo escribe `utils/excel.ts`. La separación es lo que permite testear la regla
// —en qué hoja cae cada turno, cuánto suma cada semana— sin generar un `.xlsx` ni abrirlo.
//
// Ariel venía de una planilla de Drive con una pestaña por semana. Esto la reemplaza, con
// la diferencia de que los números salen de la misma función que ya alimenta la pantalla
// de Cobros y por lo tanto no pueden contradecirla.

import { prisma } from '../config/prisma'
import { INCLUDE_CLIENTE, type TurnoConCliente } from './clientes.service'
import { resumirCobros, type ResumenDeCobros } from './cobros.service'
import { formatearFecha } from '../utils/fechaHora'

/** Un bloque de la hoja: los turnos de un día, bajo su encabezado.
 *
 * Existe para que la planilla se lea **agrupada por día** en vez de repetir la fecha en cada
 * fila. La fecha pasa a ser una banda que separa los bloques, que es como se leía la
 * planilla de Drive. */
export interface DiaExportado {
  /** `"YYYY-MM-DD"`. Ordena; no se muestra. */
  fecha: string
  /** La banda que encabeza el bloque: "martes 11 de agosto". */
  titulo: string
  turnos: TurnoConCliente[]
  /** Solo sobre los `realizado` del día — ver `resumirRealizados`. */
  resumen: ResumenDeCobros
}

/** Una hoja del libro: los turnos de una semana y lo que se facturó en ella. */
export interface SemanaExportada {
  /** El domingo que ancla la semana, `"YYYY-MM-DD"`. Ordena y da identidad; no se muestra. */
  ancla: string
  /** Cómo se titula la hoja adentro: "Semana del martes 11 al sábado 15 de agosto". */
  titulo: string
  /** Nombre corto de la pestaña: "Sem 3 (11-15 ago)". */
  nombreHoja: string
  /** Los turnos de la semana **en bloques por día**, que es como se dibuja la hoja. */
  dias: DiaExportado[]
  /** Los mismos turnos, planos. Lo usa el resumen para contar sin volver a aplanar. */
  turnos: TurnoConCliente[]
  /** Solo sobre los `realizado` de esta semana — ver `resumirRealizados`. */
  resumen: ResumenDeCobros
}

/**
 * Los turnos que entran en la exportación.
 *
 * **Todos menos los `reprogramado`**: un reprogramado es la copia vieja del turno que se
 * movió, y el bueno ya aparece por su cuenta en la fecha nueva. Listarlo sería mostrar dos
 * veces la misma visita, una de ellas en un horario que no ocurrió.
 *
 * ⚠️ **No se puede reusar `listarTurnosEnRango`** (`turnos.service.ts`), que es la consulta
 * de la agenda: aquella filtra `estado IN ('reservado','realizado','ausente')` y deja
 * afuera los **cancelados**, que acá sí se piden — Franco quiere ver también lo que se le
 * cayó. Es la misma tabla con otra regla, y parametrizar el filtro de la agenda para
 * compartirla metería un `if` en la pantalla que Ariel usa todo el día para servir a una
 * que abre una vez por mes.
 */
export async function turnosParaExportar(
  desde: Date,
  hasta: Date,
): Promise<TurnoConCliente[]> {
  return prisma.turno.findMany({
    where: { fecha: { gte: desde, lte: hasta }, estado: { not: 'reprogramado' } },
    include: INCLUDE_CLIENTE,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })
}

const DIA_MS = 24 * 60 * 60_000

/**
 * El domingo que ancla la semana de `fecha`.
 *
 * ⚠️ **Getters UTC, no locales.** `turnos.fecha` es una columna `date` y Postgres la
 * devuelve anclada a medianoche UTC: es un valor de pared, no un instante (ver
 * `combinarFechaHora` en `utils/fechaHora.ts`). Con `getDay()` a secas, un server en un
 * huso al oeste de UTC leería el sábado como viernes y correría la semana entera — andaría
 * en la notebook y no en Render, que es el peor de los errores posibles.
 *
 * Se ancla en **domingo** por la misma razón que `domingoDeLaSemana` en el frontend: es la
 * convención de `getDay()` y la que ya usa la vista Semana del panel, así que las hojas del
 * archivo cortan donde corta la pantalla.
 */
function domingoDeLaSemana(fecha: Date): Date {
  return new Date(fecha.getTime() - fecha.getUTCDay() * DIA_MS)
}

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

/** La banda que encabeza el bloque de un día: "martes 11 de agosto". Getters UTC por lo
 * mismo que `domingoDeLaSemana`. */
function tituloDelDia(fecha: Date): string {
  return `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`
}

/**
 * Cómo se lee cada hoja: **de martes a sábado**, que son los días que Ariel abre.
 *
 * ⚠️ Ojo con la distinción, que es la que evita perder datos: la semana se **agrupa** de
 * domingo a sábado, pero se **titula** por su martes y su sábado. Si el corte fuera de
 * martes a martes, un turno cargado un lunes —Ariel abre por excepción, o registra a
 * alguien de vidriera— no tendría hoja donde caer y desaparecería del archivo sin que nada
 * lo delatara. Así se lee compacto como pidió Franco y no se pierde nada: la hoja solo
 * dibuja los días que tienen algo, y un lunes aparece arriba de todo en su semana.
 */
function tituloDeLaSemana(ancla: Date): string {
  const martes = new Date(ancla.getTime() + 2 * DIA_MS)
  const sabado = new Date(ancla.getTime() + 6 * DIA_MS)
  const mesMartes = MESES[martes.getUTCMonth()]
  const mesSabado = MESES[sabado.getUTCMonth()]

  const inicio =
    mesMartes === mesSabado
      ? `martes ${martes.getUTCDate()}`
      : `martes ${martes.getUTCDate()} de ${mesMartes}`

  return `Semana del ${inicio} al sábado ${sabado.getUTCDate()} de ${mesSabado} de ${sabado.getUTCFullYear()}`
}

/**
 * Nombre de la pestaña.
 *
 * ⚠️ Lleva el número de semana adelante por dos motivos que no son estéticos: Excel exige
 * que **los nombres de hoja sean únicos** y no acepta más de 31 caracteres, y con un rango
 * de hasta 425 días entran dos veces las mismas fechas de dos años distintos (agosto de
 * 2026 y agosto de 2027 están a 365 días). El número las separa siempre, y de paso es cómo
 * estaban nombradas las pestañas de la planilla de Drive que esto reemplaza.
 */
function nombreDeHoja(ancla: Date, numero: number): string {
  const martes = new Date(ancla.getTime() + 2 * DIA_MS)
  const sabado = new Date(ancla.getTime() + 6 * DIA_MS)
  const mesMartes = MESES_CORTOS[martes.getUTCMonth()]
  const mesSabado = MESES_CORTOS[sabado.getUTCMonth()]

  const rango =
    mesMartes === mesSabado
      ? `${martes.getUTCDate()}-${sabado.getUTCDate()} ${mesSabado}`
      : `${martes.getUTCDate()} ${mesMartes}-${sabado.getUTCDate()} ${mesSabado}`

  return `Sem ${numero} (${rango})`
}

/**
 * El resumen de plata de una tanda de turnos.
 *
 * ⚠️ **Solo entran los `realizado`**, y el filtro es acá y no adentro de `resumirCobros`:
 * esa función cuenta como `sinRegistrar` cualquier fila que le llegue sin cobro, así que si
 * pasaran los cancelados, un turno que nunca ocurrió aparecería en la planilla como plata
 * que Ariel se olvidó de cobrar. Es la misma regla que ya aplica `obtenerCobros` al filtrar
 * por estado en la consulta; acá el filtro no puede ir en la consulta porque la hoja
 * necesita también los que no se hicieron.
 */
export function resumirRealizados(turnos: TurnoConCliente[]): ResumenDeCobros {
  return resumirCobros(turnos.filter((turno) => turno.estado === 'realizado'))
}

/** Junta los turnos por una clave calculada, conservando el orden en que llegaron.
 *
 * Un `Map` y no un objeto: mantiene el orden de inserción con claves de string sin las
 * sorpresas de los índices numéricos, y no arrastra el prototipo. */
function agruparPor<T>(items: T[], clave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const item of items) {
    const k = clave(item)
    const acumulado = grupos.get(k)
    if (acumulado) acumulado.push(item)
    else grupos.set(k, [item])
  }
  return grupos
}

/**
 * Parte los turnos de una semana en bloques por día.
 *
 * Es lo que hace que la hoja se lea **agrupada**: cada día abre con una banda y abajo van
 * sus turnos, en vez de repetir la fecha en las siete columnas de cada fila. Un día sin
 * turnos no genera bloque, igual que una semana sin turnos no genera hoja.
 */
export function agruparPorDia(turnos: TurnoConCliente[]): DiaExportado[] {
  return [...agruparPor(turnos, (turno) => formatearFecha(turno.fecha)).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, turnosDelDia]) => ({
      fecha,
      titulo: tituloDelDia(new Date(`${fecha}T00:00:00.000Z`)),
      turnos: turnosDelDia,
      resumen: resumirRealizados(turnosDelDia),
    }))
}

/**
 * Agrupa los turnos en semanas, en orden.
 *
 * Es **pura**: recibe los turnos (ordenados por fecha, como los devuelve
 * `turnosParaExportar`) y devuelve una hoja por cada semana **que tenga algo**. Una semana
 * vacía no genera pestaña — un mes cerrado por vacaciones no tiene por qué dejar cuatro
 * hojas en blanco en el archivo.
 */
export function agruparPorSemana(turnos: TurnoConCliente[]): SemanaExportada[] {
  return [
    ...agruparPor(turnos, (turno) =>
      formatearFecha(domingoDeLaSemana(turno.fecha)),
    ).entries(),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ancla, turnosDeLaSemana], indice) => {
      const inicio = new Date(`${ancla}T00:00:00.000Z`)
      return {
        ancla,
        titulo: tituloDeLaSemana(inicio),
        nombreHoja: nombreDeHoja(inicio, indice + 1),
        dias: agruparPorDia(turnosDeLaSemana),
        turnos: turnosDeLaSemana,
        resumen: resumirRealizados(turnosDeLaSemana),
      }
    })
}
