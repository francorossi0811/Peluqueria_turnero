import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarServicio,
  crearServicio,
  listarServiciosActivos,
  listarTodosLosServicios,
} from '../services/servicios.service'
import { ServicioNoEncontradoError } from '../services/errores'
import type { Servicio } from '../../generated/prisma/client.ts'

const idSchema = z.object({ id: z.uuid() })

const DURACION_MAX_MINUTOS = 480 // 8hs — guarda razonable contra un typo, no una regla de negocio

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre.'),
  duracionMinutos: z
    .int()
    .positive()
    .max(DURACION_MAX_MINUTOS, 'Duración demasiado larga.'),
})

const actualizarSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    duracionMinutos: z.int().positive().max(DURACION_MAX_MINUTOS).optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'No mandaste ningún campo para editar.',
  })

function servicioDto(servicio: Servicio) {
  return {
    id: servicio.id,
    nombre: servicio.nombre,
    duracionMinutos: servicio.duracionMinutos,
    activo: servicio.activo,
  }
}

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

// HU-01 — público, sin auth: solo los activos, sin el campo `activo` (siempre true acá).
export async function getServiciosPublico(_req: Request, res: Response) {
  const servicios = await listarServiciosActivos()
  res.json({
    servicios: servicios.map(({ id, nombre, duracionMinutos }) => ({
      id,
      nombre,
      duracionMinutos,
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
