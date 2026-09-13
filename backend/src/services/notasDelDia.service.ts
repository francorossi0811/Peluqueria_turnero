import { prisma } from '../config/prisma'
import { fechaDesdeIso, formatearFecha } from '../utils/fechaHora'

/** La nota rápida de un día, como la ve el panel. */
export interface NotaDelDiaDto {
  /** `YYYY-MM-DD`. */
  fecha: string
  texto: string
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
  return filas.map((f) => ({ fecha: formatearFecha(f.fecha), texto: f.texto }))
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
  return { fecha: formatearFecha(fila.fecha), texto: fila.texto }
}
