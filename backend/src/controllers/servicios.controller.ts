import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarServicio,
  crearServicio,
  listarServiciosActivos,
  listarTodosLosServicios,
  type ServicioConImagen,
} from '../services/servicios.service'
import { ServicioNoEncontradoError } from '../services/errores'
import { urlDeImagen } from '../services/imagenes.service'

const idSchema = z.object({ id: z.uuid() })

const DURACION_MAX_MINUTOS = 480 // 8hs — guarda razonable contra un typo, no una regla de negocio

// HU-27 — Mismo espíritu que el máximo de duración: no es una regla de negocio (los
// precios los pone Ariel y la inflación los mueve), es una red contra el cero de más.
const PRECIO_MAX = 10_000_000

/** HU-27 — Pesos enteros. `null` no es "no lo mandes": es cómo Ariel le saca el precio a
 * un servicio que ya tenía uno. */
const precioSchema = z
  .int('El precio va en pesos enteros.')
  .nonnegative('El precio no puede ser negativo.')
  .max(PRECIO_MAX, 'Precio demasiado alto.')
  .nullable()

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre.'),
  duracionMinutos: z
    .int()
    .positive()
    .max(DURACION_MAX_MINUTOS, 'Duración demasiado larga.'),
  precio: precioSchema.optional(),
})

const actualizarSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    duracionMinutos: z.int().positive().max(DURACION_MAX_MINUTOS).optional(),
    activo: z.boolean().optional(),
    precio: precioSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No mandaste ningún campo para editar.',
  })

/**
 * HU-29 — Qué foto se muestra de un servicio. Hay tres orígenes posibles y esta función es el
 * único lugar donde se decide entre ellos:
 *
 * 1. La que **subió Ariel** desde el panel, si la subió. Gana siempre.
 * 2. La **ruta estática** de `servicios.foto` (`/imagenes/servicio-corte.jpg`), que es lo que
 *    tienen los 4 servicios originales. No se migran: esos archivos los sirve el CDN de Vercel,
 *    que es estrictamente mejor que servirlos desde Render.
 * 3. `null` — y ahí el frontend cae a su foto de stock.
 *
 * ⚠️ Se **calcula** en vez de escribir la URL dentro de `servicios.foto` al subir. Guardarla ahí
 * serían dos escrituras que pueden divergir: si la fila de la imagen se borra y el string queda,
 * el servicio apunta a una foto que ya no existe. Con esto hay un solo lugar donde está la
 * verdad, y el `onError` del `<img>` en la landing pasa a ser una red y no un parche necesario.
 */
export function fotoDeServicio(
  servicio: Pick<ServicioConImagen, 'foto' | 'imagen'>,
): string | null {
  return servicio.imagen ? urlDeImagen(servicio.imagen.id) : servicio.foto
}

function servicioDto(servicio: ServicioConImagen) {
  return {
    id: servicio.id,
    nombre: servicio.nombre,
    duracionMinutos: servicio.duracionMinutos,
    activo: servicio.activo,
    precio: servicio.precio,
    foto: fotoDeServicio(servicio),
  }
}

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

// HU-01 — público, sin auth: solo los activos, sin el campo `activo` (siempre true acá).
//
// ⚠️ El mapeo campo por campo de acá abajo **no** es un descuido de estilo: es lo que
// obliga a decidir, dato por dato, qué sale a la web. Reemplazarlo por `servicioDto` o por
// la fila entera publicaría cualquier columna interna futura sin que nada falle ni lo
// avise. Si algún día se agrega otro dato interno al servicio, este es el lugar donde no
// ponerlo.
//
// `precio` **sí** sale desde el 14/8/2026, y eso enmienda a HU-27: hasta entonces la regla
// era que el cliente no lo viera nunca. Franco lo cambió — quiere que sepa cuánto sale
// antes de reservar. Lo que sigue siendo interno es lo del cobro (`medioPago`,
// `montoCobrado`), que vive en el turno y solo viaja en el DTO de admin.
export async function getServiciosPublico(_req: Request, res: Response) {
  const servicios = await listarServiciosActivos()
  res.json({
    servicios: servicios.map((servicio) => ({
      id: servicio.id,
      nombre: servicio.nombre,
      duracionMinutos: servicio.duracionMinutos,
      precio: servicio.precio,
      // La única línea que no es una copia directa: la foto se resuelve entre la subida y la
      // estática (HU-29). Sigue siendo un mapeo campo por campo, que es el punto de arriba.
      foto: fotoDeServicio(servicio),
    })),
  })
}

// HU-13 — admin: todos, incluidos los inactivos.
export async function getServiciosAdmin(_req: Request, res: Response) {
  const servicios = await listarTodosLosServicios()
  res.json({ servicios: servicios.map(servicioDto) })
}

export async function postServicio(req: Request, res: Response) {
  const parsed = crearSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const servicio = await crearServicio(parsed.data)
  res.status(201).json(servicioDto(servicio))
}

export async function patchServicio(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de servicio inválido.')
    return
  }

  const bodyParsed = actualizarSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    const servicio = await actualizarServicio(idParsed.data.id, bodyParsed.data)
    res.json(servicioDto(servicio))
  } catch (err) {
    if (err instanceof ServicioNoEncontradoError) {
      res.status(404).json({
        error: {
          codigo: 'SERVICIO_NO_ENCONTRADO',
          mensaje: 'No encontramos ese servicio.',
        },
      })
      return
    }
    throw err
  }
}
