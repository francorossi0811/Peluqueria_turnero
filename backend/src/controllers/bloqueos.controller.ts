import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarBloqueoYCancelar,
  crearBloqueoYCancelar,
  eliminarBloqueo,
  listarBloqueos,
  obtenerTurnosAfectados,
} from '../services/bloqueos.service'
import { BloqueoNoEncontradoError } from '../services/errores'
import {
  fechaDesdeIso,
  formatearFecha,
  formatearHora,
  horaDesdeString,
} from '../utils/fechaHora'
import type { BloqueoHorario, Turno } from '../../generated/prisma/client.ts'

const MAX_DIAS_RANGO = 31

const horaSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido, esperado HH:mm.')

const idSchema = z.object({ id: z.uuid() })

const rangoSchema = z
  .object({ desde: z.iso.date(), hasta: z.iso.date() })
  .refine((q) => q.hasta >= q.desde, {
    message: 'hasta debe ser posterior o igual a desde.',
    path: ['hasta'],
  })

const bloqueoSchema = z
  .object({
    fechaInicio: z.iso.date(),
    horaInicio: horaSchema.optional(),
    fechaFin: z.iso.date(),
    horaFin: horaSchema.optional(),
    motivo: z.string().trim().optional(),
    confirmarCancelaciones: z.boolean().optional(),
  })
  .refine((d) => d.fechaFin >= d.fechaInicio, {
    message: 'fechaFin debe ser posterior o igual a fechaInicio.',
    path: ['fechaFin'],
  })
  .refine((d) => !d.horaInicio || !d.horaFin || d.horaInicio < d.horaFin, {
    message: 'horaInicio debe ser anterior a horaFin.',
    path: ['horaFin'],
  })

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

function bloqueoDto(bloqueo: BloqueoHorario) {
  return {
    id: bloqueo.id,
    fechaInicio: formatearFecha(bloqueo.fechaInicio),
    horaInicio: bloqueo.horaInicio ? formatearHora(bloqueo.horaInicio) : null,
    fechaFin: formatearFecha(bloqueo.fechaFin),
    horaFin: bloqueo.horaFin ? formatearHora(bloqueo.horaFin) : null,
    motivo: bloqueo.motivo,
  }
}

function turnoAfectadoDto(turno: Turno) {
  return {
    id: turno.id,
    fecha: formatearFecha(turno.fecha),
    hora: formatearHora(turno.horaInicio),
    clienteNombre: turno.clienteNombre,
  }
}

export async function getBloqueos(req: Request, res: Response) {
  const parsed = rangoSchema.safeParse(req.query)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const desdeFecha = fechaDesdeIso(parsed.data.desde)
  const hastaFecha = fechaDesdeIso(parsed.data.hasta)
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

  const bloqueos = await listarBloqueos(desdeFecha, hastaFecha)
  res.json({ bloqueos: bloqueos.map(bloqueoDto) })
}

// CU-03 — flujo de dos pasos en un solo endpoint idempotente (ver especificacion-api.md).
export async function postBloqueo(req: Request, res: Response) {
  const parsed = bloqueoSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const datos = {
    fechaInicio: fechaDesdeIso(parsed.data.fechaInicio),
    horaInicio: parsed.data.horaInicio
      ? horaDesdeString(parsed.data.horaInicio)
      : null,
    fechaFin: fechaDesdeIso(parsed.data.fechaFin),
    horaFin: parsed.data.horaFin ? horaDesdeString(parsed.data.horaFin) : null,
    motivo: parsed.data.motivo,
  }

  const turnosAfectados = await obtenerTurnosAfectados(datos)

  if (turnosAfectados.length > 0 && !parsed.data.confirmarCancelaciones) {
    res.status(409).json({
      error: {
        codigo: 'BLOQUEO_AFECTA_TURNOS',
        mensaje: `Hay ${turnosAfectados.length} turno(s) en ese rango.`,
      },
      turnosAfectados: turnosAfectados.map(turnoAfectadoDto),
    })
    return
  }

  const bloqueo = await crearBloqueoYCancelar(datos, turnosAfectados)
  res.status(201).json(bloqueoDto(bloqueo))
}

/** Editar un bloqueo. Mismo cuerpo y **mismo flujo de dos pasos** que crearlo: un rango
 * nuevo puede llevarse turnos por delante igual que uno recién hecho, así que responde 409
 * con la lista hasta que venga `confirmarCancelaciones`. Sin eso, editar sería la puerta
 * de atrás que se saltea el aviso que la creación sí da. */
export async function patchBloqueo(req: Request, res: Response) {
  const parsedId = idSchema.safeParse(req.params)
  if (!parsedId.success) {
    respondErrorParametrosInvalidos(res, 'Id de bloqueo inválido.')
    return
  }

  const parsed = bloqueoSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const datos = {
    fechaInicio: fechaDesdeIso(parsed.data.fechaInicio),
    horaInicio: parsed.data.horaInicio
      ? horaDesdeString(parsed.data.horaInicio)
      : null,
    fechaFin: fechaDesdeIso(parsed.data.fechaFin),
    horaFin: parsed.data.horaFin ? horaDesdeString(parsed.data.horaFin) : null,
    motivo: parsed.data.motivo,
  }

  // Cuenta solo lo que sigue `reservado`, así que los turnos que este mismo bloqueo ya
  // canceló no vuelven a aparecer en el aviso.
  const turnosAfectados = await obtenerTurnosAfectados(datos)

  if (turnosAfectados.length > 0 && !parsed.data.confirmarCancelaciones) {
    res.status(409).json({
      error: {
        codigo: 'BLOQUEO_AFECTA_TURNOS',
        mensaje: `Hay ${turnosAfectados.length} turno(s) en ese rango.`,
      },
      turnosAfectados: turnosAfectados.map(turnoAfectadoDto),
    })
    return
  }

  try {
    const bloqueo = await actualizarBloqueoYCancelar(
      parsedId.data.id,
      datos,
      turnosAfectados,
    )
    res.json(bloqueoDto(bloqueo))
  } catch (err) {
    if (err instanceof BloqueoNoEncontradoError) {
      res.status(404).json({
        error: {
          codigo: 'BLOQUEO_NO_ENCONTRADO',
          mensaje: 'No encontramos ese bloqueo.',
        },
      })
      return
    }
    throw err
  }
}

export async function deleteBloqueo(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de bloqueo inválido.')
    return
  }

  try {
    await eliminarBloqueo(parsed.data.id)
    res.status(204).send()
  } catch (err) {
    if (err instanceof BloqueoNoEncontradoError) {
      res.status(404).json({
        error: {
          codigo: 'BLOQUEO_NO_ENCONTRADO',
          mensaje: 'No encontramos ese bloqueo.',
        },
      })
      return
    }
    throw err
  }
}
