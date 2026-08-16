import { Request, Response } from 'express'
import { z } from 'zod'
import {
  agregarFotoACliente,
  borrarFotoDeCliente,
  borrarFotoDeServicio,
  fotoDto,
  listarFotosDeCliente,
  MAX_FOTOS_POR_FICHA,
  obtenerImagen,
  ponerFotoDeServicio,
  usoDeAlmacenamiento,
} from '../services/imagenes.service'
import {
  ClienteNoEncontradoError,
  ImagenDemasiadoGrandeError,
  ImagenInvalidaError,
  ImagenNoEncontradaError,
  LimiteDeFotosError,
  ServicioNoEncontradoError,
} from '../services/errores'
import { MAX_BYTES } from '../utils/dataUrl'

const idSchema = z.object({ id: z.uuid() })
const idsFotoSchema = z.object({ id: z.uuid(), fotoId: z.uuid() })

/** El cuerpo de una subida. `datos` es la data URL completa, tal como la deja el compresor del
 * navegador. El tope de largo es una red barata contra un cuerpo absurdo: el chequeo que vale
 * es el de bytes reales, después de decodificar. Base64 infla ~33%, de ahí el ×2. */
const subidaSchema = z.object({
  datos: z.string().min(1).max(MAX_BYTES * 2),
})

function manejarErroresDeImagen(err: unknown, res: Response): boolean {
  if (err instanceof ImagenInvalidaError) {
    res.status(400).json({
      error: {
        codigo: 'IMAGEN_INVALIDA',
        mensaje: 'Ese archivo no es una imagen que podamos usar. Probá con una foto JPG o PNG.',
      },
    })
    return true
  }
  if (err instanceof ImagenDemasiadoGrandeError) {
    res.status(400).json({
      error: {
        codigo: 'IMAGEN_DEMASIADO_GRANDE',
        mensaje: `La foto pesa demasiado (máximo ${Math.round(MAX_BYTES / 1024)} KB).`,
      },
    })
    return true
  }
  if (err instanceof LimiteDeFotosError) {
    res.status(409).json({
      error: {
        codigo: 'LIMITE_DE_FOTOS',
        mensaje: `Esta ficha ya tiene ${MAX_FOTOS_POR_FICHA} fotos. Borrá alguna para poder sumar otra.`,
      },
    })
    return true
  }
  if (err instanceof ImagenNoEncontradaError) {
    res.status(404).json({
      error: { codigo: 'IMAGEN_NO_ENCONTRADA', mensaje: 'No encontramos esa foto.' },
    })
    return true
  }
  if (err instanceof ClienteNoEncontradoError) {
    res.status(404).json({
      error: { codigo: 'CLIENTE_NO_ENCONTRADO', mensaje: 'No encontramos esa ficha.' },
    })
    return true
  }
  if (err instanceof ServicioNoEncontradoError) {
    res.status(404).json({
      error: { codigo: 'SERVICIO_NO_ENCONTRADO', mensaje: 'No encontramos ese servicio.' },
    })
    return true
  }
  return false
}

function respondErrorParametros(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

/**
 * HU-29 — Sirve el binario de una imagen.
 *
 * ⚠️ **Es pública, incluidas las fotos de las fichas, y la autorización es conocer el uuid.**
 * No es una omisión: un `<img src>` no puede mandar el header `Authorization`, así que
 * `requireAuth` acá rompería la galería del panel y la landing a la vez. Es el mismo criterio
 * con el que ya funciona el link del turno (`GET /api/turnos/:id`), donde el id *es* el token, y
 * es aceptable porque son fotos de cortes sin caras.
 *
 * Si algún día hay caras, la salida es traerlas por axios como blob y dibujarlas con
 * `URL.createObjectURL` — ahí sí viaja el header y el endpoint puede pedir auth para las de
 * ficha. Queda escrito acá para que sea una decisión que se revisa y no una que se hereda.
 *
 * El cache es agresivo a propósito: el id es inmutable —reemplazar una foto crea otra fila con
 * otro id—, así que la respuesta para un id dado no cambia nunca. Sin esto, cada visita a la
 * landing despierta a Render para volver a mandar los mismos bytes.
 */
export async function getImagen(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametros(res, 'Id inválido.')
    return
  }

  try {
    const imagen = await obtenerImagen(parsed.data.id)
    res.setHeader('Content-Type', imagen.mimeType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('ETag', `"${parsed.data.id}"`)
    res.send(Buffer.from(imagen.datos))
  } catch (err) {
    if (manejarErroresDeImagen(err, res)) return
    throw err
  }
}

export async function getFotosDeCliente(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametros(res, 'Id inválido.')
    return
  }

  const fotos = await listarFotosDeCliente(parsed.data.id)
  res.json({ fotos: fotos.map(fotoDto), maximo: MAX_FOTOS_POR_FICHA })
}

export async function postFotoDeCliente(req: Request, res: Response) {
  const params = idSchema.safeParse(req.params)
  const body = subidaSchema.safeParse(req.body)
  if (!params.success || !body.success) {
    respondErrorParametros(res, 'Falta la foto o el id es inválido.')
    return
  }

  try {
    const foto = await agregarFotoACliente(params.data.id, body.data.datos)
    res.status(201).json(fotoDto(foto))
  } catch (err) {
    if (manejarErroresDeImagen(err, res)) return
    throw err
  }
}

export async function deleteFotoDeCliente(req: Request, res: Response) {
  const parsed = idsFotoSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametros(res, 'Id inválido.')
    return
  }

  try {
    await borrarFotoDeCliente(parsed.data.id, parsed.data.fotoId)
    res.status(204).end()
  } catch (err) {
    if (manejarErroresDeImagen(err, res)) return
    throw err
  }
}

export async function putFotoDeServicio(req: Request, res: Response) {
  const params = idSchema.safeParse(req.params)
  const body = subidaSchema.safeParse(req.body)
  if (!params.success || !body.success) {
    respondErrorParametros(res, 'Falta la foto o el id es inválido.')
    return
  }

  try {
    const foto = await ponerFotoDeServicio(params.data.id, body.data.datos)
    res.json(fotoDto(foto))
  } catch (err) {
    if (manejarErroresDeImagen(err, res)) return
    throw err
  }
}

export async function deleteFotoDeServicio(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametros(res, 'Id inválido.')
    return
  }

  try {
    await borrarFotoDeServicio(parsed.data.id)
    res.status(204).end()
  } catch (err) {
    if (manejarErroresDeImagen(err, res)) return
    throw err
  }
}

/** HU-29 — Cuánto están ocupando las fotos. Es lo que hace que borrar sea una decisión y no un
 * reflejo: sin este número Ariel no tiene forma de saber si le conviene limpiar. */
export async function getUsoDeAlmacenamiento(_req: Request, res: Response) {
  res.json(await usoDeAlmacenamiento())
}
