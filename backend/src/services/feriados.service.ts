import { prisma } from '../config/prisma'
import { FeriadoNoEncontradoError } from './errores'
import { FUENTE, obtenerFeriadosDelAnio } from './feriados/nager'
import type {
  Feriado,
  ModalidadFeriado,
} from '../../generated/prisma/client.ts'

export async function listarFeriados(anio?: number): Promise<Feriado[]> {
  if (!anio) {
    return prisma.feriado.findMany({ orderBy: { fecha: 'asc' } })
  }
  return prisma.feriado.findMany({
    where: { fecha: rangoDelAnio(anio) },
    orderBy: { fecha: 'asc' },
  })
}

export async function actualizarFeriado(
  id: number,
  modalidad: ModalidadFeriado,
): Promise<Feriado> {
  const feriado = await prisma.feriado.findUnique({ where: { id } })
  if (!feriado) throw new FeriadoNoEncontradoError()

  return prisma.feriado.update({ where: { id }, data: { modalidad } })
}

function rangoDelAnio(anio: number) {
  return {
    gte: new Date(Date.UTC(anio, 0, 1)),
    lte: new Date(Date.UTC(anio, 11, 31)),
  }
}

/** Trae los feriados de un año desde Nager.Date y los deja en la base (HU-24).
 *
 * ⚠️ **Nunca toca `modalidad`.** Es la única decisión que Ariel tomó sobre estos datos —
 * si marcó que un feriado lo trabaja completo, una resincronización que reescriba la fila
 * entera se la borra sin que se entere. Por eso el `update` del upsert se limita a
 * `nombre` y `fuente`, y el default `medio_dia` solo actúa al crear.
 *
 * Tampoco borra lo que ya no venga de la fuente, por el mismo motivo: un feriado que
 * desaparece de Nager pero que Ariel ya configuró es mejor dejarlo (y que él lo ajuste)
 * que hacerlo desaparecer de la agenda por decisión de un tercero.
 *
 * Devuelve cuántos feriados vinieron, para poder mostrarlo al resincronizar a mano. */
export async function sincronizarAnio(anio: number): Promise<number> {
  const feriados = await obtenerFeriadosDelAnio(anio)

  for (const feriado of feriados) {
    await prisma.feriado.upsert({
      where: { fecha: feriado.fecha },
      create: { fecha: feriado.fecha, nombre: feriado.nombre, fuente: FUENTE },
      update: { nombre: feriado.nombre, fuente: FUENTE },
    })
  }

  return feriados.length
}

/** Los años que nos interesa tener cargados: el actual y el siguiente.
 *
 * El que viene hace falta de verdad — en diciembre un cliente ya puede reservar para
 * enero, y sin los feriados cargados el sistema le ofrecería horarios de un día en el que
 * Ariel atiende medio día o no atiende. */
function aniosAMantener(hoy: Date): number[] {
  const anio = hoy.getUTCFullYear()
  return [anio, anio + 1]
}

/** Sincroniza los años que falten. Se llama al arrancar el servidor.
 *
 * ⚠️ **Solo sincroniza el año que no tenga ninguna fila.** Render duerme el plan gratuito
 * y vuelve a levantar muchas veces por día; sin esta guarda le estaríamos pegando a una
 * API pública y gratuita en cada arranque en frío, sin ningún motivo — los feriados de un
 * año no cambian de un rato a otro. Para el caso en que sí cambien (un feriado decretado
 * a mitad de año) está el botón "Actualizar feriados" del panel, que llama a
 * `sincronizarAnio` directo y sin guarda.
 *
 * Nunca lanza: los feriados son un dato de apoyo, no un requisito para atender. Si
 * Nager.Date está caído, el backend tiene que arrancar igual. */
export async function sincronizarFeriadosPendientes(
  hoy: Date = new Date(),
): Promise<void> {
  for (const anio of aniosAMantener(hoy)) {
    try {
      const cargados = await prisma.feriado.count({
        where: { fecha: rangoDelAnio(anio) },
      })
      if (cargados > 0) continue

      const total = await sincronizarAnio(anio)
      console.log(`[feriados] ${anio}: ${total} feriados importados de ${FUENTE}`)
    } catch (err) {
      console.error(`[feriados] no se pudieron sincronizar los de ${anio}:`, err)
    }
  }
}
