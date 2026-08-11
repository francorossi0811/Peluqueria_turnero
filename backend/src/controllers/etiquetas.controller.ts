import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarEtiqueta,
  crearEtiqueta,
  eliminarEtiqueta,
  listarEtiquetas,
} from '../services/clientes.service'
import {
  EtiquetaDuplicadaError,
  EtiquetaNoEncontradaError,
} from '../services/errores'

const idSchema = z.object({ id: z.uuid() })

// Hexadecimal de seis dígitos. Ariel elige el color libremente —la insignia es un círculo
// pleno, no texto sobre un fondo, así que ningún valor la vuelve ilegible— pero el formato
// sí se valida: lo que se guarde acá termina como `background-color` en el navegador, y
// aceptar cualquier string sería aceptar que Ariel escriba algo que no pinta nada.
const COLOR = /^#[0-9a-fA-F]{6}$/

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'Ponele un nombre a la etiqueta.').max(40),
  color: z.string().regex(COLOR, 'El color tiene que ser un hexadecimal, ej: #c05621.'),
})

const editarSchema = crearSchema.partial().refine(
  (d) => d.nombre !== undefined || d.color !== undefined,
  { message: 'No mandaste ningún cambio.' },
)

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

function manejarErrores(err: unknown, res: Response): boolean {
  if (err instanceof EtiquetaNoEncontradaError) {
    res.status(404).json({
      error: {
        codigo: 'ETIQUETA_NO_ENCONTRADA',
        mensaje: 'No encontramos esa etiqueta.',
      },
    })
    return true
  }
  if (err instanceof EtiquetaDuplicadaError) {
    res.status(409).json({
      error: {
        codigo: 'ETIQUETA_DUPLICADA',
        mensaje: 'Ya tenés una etiqueta con ese nombre.',
      },
    })
    return true
  }
  return false
}

export async function getEtiquetas(_req: Request, res: Response) {
  res.json({ etiquetas: await listarEtiquetas() })
}

export async function postEtiqueta(req: Request, res: Response) {
  const parsed = crearSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    res.status(201).json(await crearEtiqueta(parsed.data))
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}

export async function patchEtiqueta(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de etiqueta inválido.')
    return
  }

  const bodyParsed = editarSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    res.json(await actualizarEtiqueta(idParsed.data.id, bodyParsed.data))
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}

/** A diferencia de los servicios, acá sí hay DELETE: ver el comentario de
 * `eliminarEtiqueta` en el service. */
export async function deleteEtiqueta(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de etiqueta inválido.')
    return
  }

  try {
    await eliminarEtiqueta(parsed.data.id)
    res.status(204).end()
  } catch (err) {
    if (manejarErrores(err, res)) return
    throw err
  }
}
