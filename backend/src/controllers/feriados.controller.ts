import { Request, Response } from 'express'
import { z } from 'zod'
import { actualizarFeriado, listarFeriados } from '../services/feriados.service'
import { FeriadoNoEncontradoError } from '../services/errores'
import { formatearFecha } from '../utils/fechaHora'
import type { Feriado } from '../../generated/prisma/client.ts'

const querySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
})

const idSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({ bloquea: z.boolean() })

function feriadoDto(feriado: Feriado) {
  return {
    id: feriado.id,
    fecha: formatearFecha(feriado.fecha),
    nombre: feriado.nombre,
    bloquea: feriado.bloquea,
  }
}

export async function getFeriados(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: { codigo: 'PARAMETROS_INVALIDOS', mensaje: 'Año inválido.' },
    })
    return
  }

  const feriados = await listarFeriados(parsed.data.anio)
  res.json({ feriados: feriados.map(feriadoDto) })
}

export async function patchFeriado(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: 'Id de feriado inválido.',
      },
    })
    return
  }

  const bodyParsed = bodySchema.safeParse(req.body)
  if (!bodyParsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: 'Falta el campo bloquea (boolean).',
      },
    })
    return
  }

  try {
    const feriado = await actualizarFeriado(
      idParsed.data.id,
      bodyParsed.data.bloquea,
    )
    res.json(feriadoDto(feriado))
  } catch (err) {
    if (err instanceof FeriadoNoEncontradoError) {
      res.status(404).json({
        error: {
          codigo: 'FERIADO_NO_ENCONTRADO',
          mensaje: 'No encontramos ese feriado.',
        },
      })
      return
    }
    throw err
  }
}
