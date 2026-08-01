import { Request, Response } from 'express'
import { z } from 'zod'
import {
  calcularDisponibilidad,
  ServicioNoDisponibleError,
} from '../services/disponibilidad.service'

const MAX_DIAS_RANGO = 31

const querySchema = z
  .object({
    servicioId: z.uuid(),
    desde: z.iso.date(),
    hasta: z.iso.date(),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: 'hasta debe ser posterior o igual a desde.',
    path: ['hasta'],
  })

function aFechaUtc(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}

export async function getDisponibilidad(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
      },
    })
    return
  }

  const { servicioId, desde, hasta } = parsed.data
  const desdeFecha = aFechaUtc(desde)
  const hastaFecha = aFechaUtc(hasta)

  const dias =
    Math.round((hastaFecha.getTime() - desdeFecha.getTime()) / 86_400_000) + 1
  if (dias > MAX_DIAS_RANGO) {
    res.status(400).json({
      error: {
        codigo: 'RANGO_DEMASIADO_AMPLIO',
        mensaje: `El rango no puede superar los ${MAX_DIAS_RANGO} días.`,
      },
    })
    return
  }

  try {
    const disponibilidad = await calcularDisponibilidad(
      servicioId,
      desdeFecha,
      hastaFecha,
    )
    res.json({ disponibilidad })
  } catch (err) {
    if (err instanceof ServicioNoDisponibleError) {
      res.status(404).json({
        error: {
          codigo: 'SERVICIO_NO_ENCONTRADO',
          mensaje: 'El servicio no existe o no está activo.',
        },
      })
      return
    }
    throw err
  }
}
