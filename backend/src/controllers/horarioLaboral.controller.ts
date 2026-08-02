import { Request, Response } from 'express'
import { z } from 'zod'
import {
  listarHorarioLaboral,
  reemplazarHorarioLaboral,
} from '../services/horarioLaboral.service'
import { FranjaInvalidaError } from '../services/errores'
import { formatearHora, horaDesdeString } from '../utils/fechaHora'
import type { HorarioLaboral } from '../../generated/prisma/client.ts'

const horaSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido, esperado HH:mm.')

const putSchema = z.object({
  franjas: z.array(
    z.object({
      diaSemana: z.int().min(0).max(6),
      horaInicio: horaSchema,
      horaFin: horaSchema,
    }),
  ),
})

function franjaDto(franja: HorarioLaboral) {
  return {
    id: franja.id,
    diaSemana: franja.diaSemana,
    horaInicio: formatearHora(franja.horaInicio),
    horaFin: formatearHora(franja.horaFin),
  }
}

export async function getHorarioLaboral(_req: Request, res: Response) {
  const franjas = await listarHorarioLaboral()
  res.json({ franjas: franjas.map(franjaDto) })
}

export async function putHorarioLaboral(req: Request, res: Response) {
  const parsed = putSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
      },
    })
    return
  }

  try {
    const franjas = await reemplazarHorarioLaboral(
      parsed.data.franjas.map((f) => ({
        diaSemana: f.diaSemana,
        horaInicio: horaDesdeString(f.horaInicio),
        horaFin: horaDesdeString(f.horaFin),
      })),
    )
    res.json({ franjas: franjas.map(franjaDto) })
  } catch (err) {
    if (err instanceof FranjaInvalidaError) {
      res
        .status(400)
        .json({ error: { codigo: 'FRANJA_INVALIDA', mensaje: err.message } })
      return
    }
    throw err
  }
}
