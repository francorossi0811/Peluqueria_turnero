// HU-29 — Las fotos que sube Ariel.
//
// Dos usos con reglas distintas y una sola tabla: la galería de una ficha (varias, ordenadas) y
// la foto de un servicio (una sola, la que ve el cliente en la landing). Lo que los mantiene
// separados sin ambigüedad es el CHECK `imagenes_un_solo_dueno` de la base — acá arriba solo se
// escriben las reglas que la base no puede expresar.

import { prisma } from '../config/prisma'
import { decodificarDataUrl } from '../utils/dataUrl'
import {
  ClienteNoEncontradoError,
  ImagenDemasiadoGrandeError,
  ImagenInvalidaError,
  ImagenNoEncontradaError,
  ServicioNoEncontradoError,
} from './errores'

/** El presupuesto de espacio para las fotos, y el número que se le muestra a Ariel en
 * "Mi cuenta".
 *
 * ⚠️ Desde el 23/8/2026 es la **única** defensa que queda: hasta esa fecha había además un tope
 * de 5 fotos por ficha, y Ariel pidió sacarlo porque le cortaba el trabajo. De los dos números
 * que hacían viable guardar los archivos en Postgres queda uno solo —la compresión del
 * navegador, ~150 KB por foto— y este medidor, que dejó de ser informativo.
 *
 * Son 400 MB y no los 500 del plan gratuito de Neon a propósito: la misma base guarda turnos,
 * clientes e imágenes, y un medidor que recién llega al 100% cuando la base ya no acepta
 * escrituras no avisa nada. Con ~150 KB por foto son ~2.700 fotos de margen.
 *
 * Si algún día se llena, lo que hay que mover es **dónde viven los archivos** (un bucket) y eso
 * no toca ninguna pantalla: el frontend solo ve `/api/imagenes/<id>`. */
export const PRESUPUESTO_DE_FOTOS = 400 * 1024 * 1024

/** Lo que se devuelve de una foto: todo menos el binario.
 *
 * El blob **nunca** sale por estos listados: la galería dibuja `<img src="/api/imagenes/id">` y
 * el navegador lo pide aparte, cacheado. Mandarlo acá adentro significaría meter 750 KB de
 * base64 en el JSON de la ficha cada vez que Ariel la abre. */
const CAMPOS_SIN_BLOB = {
  id: true,
  mimeType: true,
  bytes: true,
  orden: true,
  createdAt: true,
} as const

export interface FotoDto {
  id: string
  url: string
  bytes: number
}

export function fotoDto(foto: { id: string; bytes: number }): FotoDto {
  return { id: foto.id, url: urlDeImagen(foto.id), bytes: foto.bytes }
}

/** La URL pública de una imagen. Una sola función porque la arman tres lugares distintos (la
 * galería, el DTO del servicio público y el de admin) y que uno quede desfasado sería una foto
 * rota que solo se ve en una pantalla. */
export function urlDeImagen(id: string): string {
  return `/api/imagenes/${id}`
}

/** Trae el binario para servirlo. Lo único que lee `datos`. */
export async function obtenerImagen(id: string) {
  const imagen = await prisma.imagen.findUnique({
    where: { id },
    select: { datos: true, mimeType: true },
  })
  if (!imagen) throw new ImagenNoEncontradaError()
  return imagen
}

export async function listarFotosDeCliente(clienteId: string) {
  return prisma.imagen.findMany({
    where: { clienteId },
    select: CAMPOS_SIN_BLOB,
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
  })
}

/** Suma una foto a la galería de una ficha (HU-29).
 *
 * El `orden` sale de la cantidad que ya hay: las fotos se muestran en el orden en que Ariel las
 * fue sacando, que es el orden en que pasaron las visitas. Reordenarlas a mano no se pidió.
 */
export async function agregarFotoACliente(clienteId: string, dataUrl: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true },
  })
  if (!cliente) throw new ClienteNoEncontradoError()

  const decodificada = decodificarDataUrl(dataUrl)
  if (!decodificada.ok) {
    throw decodificada.motivo === 'peso'
      ? new ImagenDemasiadoGrandeError()
      : new ImagenInvalidaError()
  }

  // Sin tope de cantidad desde el 23/8/2026 (ver `PRESUPUESTO_DE_FOTOS`). El conteo se queda
  // igual: ahora su único trabajo es darle el `orden` a la foto nueva, así que no está huérfano.
  const cuantas = await prisma.imagen.count({ where: { clienteId } })

  return prisma.imagen.create({
    data: { ...decodificada.imagen, clienteId, orden: cuantas },
    select: CAMPOS_SIN_BLOB,
  })
}

/** Saca una foto de la galería.
 *
 * Pide el `clienteId` además del id de la foto y lo usa en el `where`: sin eso, el endpoint
 * borraría cualquier imagen del sistema con solo acertarle al uuid, incluida la foto de un
 * servicio. El id de la ruta no alcanza como autorización solo porque esté detrás de `requireAuth`.
 *
 * ⚠️ No se reacomoda el `orden` de las que quedan. Quedan huecos (0, 1, 3) y está bien: el
 * `orderBy` solo necesita que sea creciente, y renumerar sería escribir sobre filas que nadie
 * pidió tocar. */
export async function borrarFotoDeCliente(clienteId: string, fotoId: string) {
  const { count } = await prisma.imagen.deleteMany({
    where: { id: fotoId, clienteId },
  })
  if (count === 0) throw new ImagenNoEncontradaError()
}

/** Pone —o reemplaza— la foto de un servicio.
 *
 * Es un reemplazo y no un alta porque `imagenes.servicio_id` es unique: la regla "una foto por
 * servicio" la sostiene la base. Se borra la anterior en la misma transacción, si no un fallo en
 * el medio deja al servicio sin foto y al blob viejo ocupando lugar sin que nadie lo alcance. */
export async function ponerFotoDeServicio(servicioId: string, dataUrl: string) {
  const servicio = await prisma.servicio.findUnique({
    where: { id: servicioId },
    select: { id: true },
  })
  if (!servicio) throw new ServicioNoEncontradoError()

  const decodificada = decodificarDataUrl(dataUrl)
  if (!decodificada.ok) {
    throw decodificada.motivo === 'peso'
      ? new ImagenDemasiadoGrandeError()
      : new ImagenInvalidaError()
  }

  return prisma.$transaction(async (tx) => {
    await tx.imagen.deleteMany({ where: { servicioId } })
    return tx.imagen.create({
      data: { ...decodificada.imagen, servicioId },
      select: CAMPOS_SIN_BLOB,
    })
  })
}

/** Le saca la foto a un servicio: vuelve a su ruta estática si tenía una, y si no al stock. */
export async function borrarFotoDeServicio(servicioId: string) {
  const { count } = await prisma.imagen.deleteMany({ where: { servicioId } })
  if (count === 0) throw new ImagenNoEncontradaError()
}

export interface UsoDeAlmacenamiento {
  fotos: number
  bytes: number
  /** ⚠️ Viaja por la API en vez de estar hardcodeado en el frontend para que no haya dos
   * números que puedan divergir: el que la pantalla dibuja y el que el sistema aplica. Es el
   * mismo defecto de copia que este proyecto ya se comió con el `ausente` de dos colores. */
  presupuestoBytes: number
}

/** Cuánto se está ocupando (HU-29). Suma la columna `bytes` en vez de `length(datos)`: es
 * exactamente para esto que esa columna existe, y así el total no trae un solo blob a memoria. */
export async function usoDeAlmacenamiento(): Promise<UsoDeAlmacenamiento> {
  const r = await prisma.imagen.aggregate({
    _count: { _all: true },
    _sum: { bytes: true },
  })
  return {
    fotos: r._count._all,
    bytes: r._sum.bytes ?? 0,
    presupuestoBytes: PRESUPUESTO_DE_FOTOS,
  }
}
