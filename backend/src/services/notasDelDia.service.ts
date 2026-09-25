import { prisma } from '../config/prisma'
import { fechaDesdeIso, formatearFecha } from '../utils/fechaHora'
import { registrarColorUsado } from './turnos.service'

/** La nota rápida de un día, como la ve el panel. */
export interface NotaDelDiaDto {
  /** `YYYY-MM-DD`. */
  fecha: string
  texto: string
  /** La prioridad que le puso Ariel, como el color de un turno (HU-34). `null` = sin color. */
  color: string | null
}

function notaADto(fila: {
  fecha: Date
  texto: string
  color: string | null
}): NotaDelDiaDto {
  return {
    fecha: formatearFecha(fila.fecha),
    texto: fila.texto,
    color: fila.color,
  }
}

/** Las notas de un rango de días, las que existan. Un día sin nota no aparece: el panel
 * dibuja el renglón vacío igual, así que devolver filas en blanco sería mandar datos que
 * no dicen nada. */
export async function listarNotasDelDia(
  desde: string,
  hasta: string,
): Promise<NotaDelDiaDto[]> {
  const filas = await prisma.notaDelDia.findMany({
    where: { fecha: { gte: fechaDesdeIso(desde), lte: fechaDesdeIso(hasta) } },
    orderBy: { fecha: 'asc' },
  })
  return filas.map(notaADto)
}

/**
 * Escribe la nota de un día, o la borra si el texto quedó vacío.
 *
 * Una sola puerta para las tres cosas —crear, cambiar y borrar— porque para Ariel es un
 * solo gesto: escribe en el renglón y sale. Partirlo en un `POST` y un `DELETE` obligaría a
 * la pantalla a decidir cuál mandar mirando si antes había algo, y esa decisión ya la toma
 * la base con el `upsert`.
 *
 * `deleteMany` y no `delete`: borrar la nota de un día que no tenía ninguna no es un error,
 * es lo mismo que ya estaba. `delete` tiraría P2025 justo en ese caso.
 */
export async function guardarNotaDelDia(
  fecha: string,
  texto: string,
): Promise<NotaDelDiaDto | null> {
  const dia = fechaDesdeIso(fecha)

  if (!texto) {
    await prisma.notaDelDia.deleteMany({ where: { fecha: dia } })
    return null
  }

  const fila = await prisma.notaDelDia.upsert({
    where: { fecha: dia },
    create: { fecha: dia, texto },
    update: { texto },
  })
  return notaADto(fila)
}

/**
 * Pinta la nota de un día, o le saca el color con `null`.
 *
 * Devuelve `null` si ese día no tiene nota: sin texto no hay casilla que pintar, y crear una
 * fila vacía solo para guardar un color rompería la regla de "no hay fila vacía". El `PUT`
 * del texto no toca el color, así que editar la nota lo conserva; borrarla se lo lleva.
 *
 * Comparte la paleta de recientes con los turnos a propósito: si Ariel usa el rojo para
 * "urgente" en un lado, lo tiene a un toque en el otro.
 */
export async function cambiarColorDeNota(
  fecha: string,
  color: string | null,
): Promise<NotaDelDiaDto | null> {
  const dia = fechaDesdeIso(fecha)
  const existe = await prisma.notaDelDia.findUnique({ where: { fecha: dia } })
  if (!existe) return null

  const fila = await prisma.notaDelDia.update({
    where: { fecha: dia },
    data: { color },
  })
  if (color) await registrarColorUsado(color)
  return notaADto(fila)
}
