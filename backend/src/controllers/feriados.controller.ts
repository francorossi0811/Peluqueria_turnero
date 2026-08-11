import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarFeriado,
  listarFeriados,
  sincronizarAnio,
} from '../services/feriados.service'
import { FeriadoNoEncontradoError } from '../services/errores'
import { formatearFecha } from '../utils/fechaHora'
import type { Feriado } from '../../generated/prisma/client.ts'

const querySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
})

const idSchema = z.object({ id: z.coerce.number().int().positive() })

// HU-24 — Tres estados, no dos. El booleano de antes no podía expresar "medio día", que
// es justamente lo que Ariel hace en la mayoría de los feriados.
const MODALIDADES = ['cerrado', 'medio_dia', 'dia_completo'] as const

const bodySchema = z.object({ modalidad: z.enum(MODALIDADES) })

function feriadoDto(feriado: Feriado) {
  return {
    id: feriado.id,
    fecha: formatearFecha(feriado.fecha),
    nombre: feriado.nombre,
    modalidad: feriado.modalidad,
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

/** HU-24 — Vuelve a traer los feriados de la fuente externa, ahora mismo.
 *
 * El arranque solo sincroniza los años que están vacíos (ver
 * `sincronizarFeriadosPendientes`), así que sin este botón un feriado decretado a mitad
 * de año no entraría nunca. Es un endpoint y no un job programado porque el plan gratuito
 * de Render no tiene cron, y porque que Ariel decida cuándo refrescar es más predecible
 * que adivinar un intervalo. */
export async function postSincronizarFeriados(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: { codigo: 'PARAMETROS_INVALIDOS', mensaje: 'Año inválido.' },
    })
    return
  }

  const anio = parsed.data.anio ?? new Date().getUTCFullYear()

  try {
    const importados = await sincronizarAnio(anio)
    res.json({ anio, importados })
  } catch (err) {
    console.error('[feriados] falló la sincronización manual:', err)
    res.status(502).json({
      error: {
        codigo: 'FUENTE_NO_DISPONIBLE',
        mensaje:
          'No pudimos consultar el calendario de feriados. Probá de nuevo en un rato.',
      },
    })
  }
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
        mensaje: `El campo modalidad tiene que ser uno de: ${MODALIDADES.join(', ')}.`,
      },
    })
    return
  }

  try {
    const feriado = await actualizarFeriado(
      idParsed.data.id,
      bodyParsed.data.modalidad,
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
