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
import { enviarAvisosDeCancelacionEnMasa } from '../services/notificaciones.service'
import {
  fechaDesdeIso,
  formatearFecha,
  formatearHora,
  horaDesdeString,
} from '../utils/fechaHora'
import {
  esquemaDeFecha,
  esquemaDeHora,
  FIN_ANTES_QUE_INICIO,
  HORA_FIN_ANTES_QUE_INICIO,
} from '../utils/esquemasFecha'
import type { BloqueoHorario, Turno } from '../../generated/prisma/client.ts'

const MAX_DIAS_RANGO = 31

const idSchema = z.object({ id: z.uuid() })

const rangoSchema = z
  .object({
    desde: esquemaDeFecha('la fecha de inicio'),
    hasta: esquemaDeFecha('la fecha de fin'),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: FIN_ANTES_QUE_INICIO,
    path: ['hasta'],
  })

const bloqueoSchema = z
  .object({
    fechaInicio: esquemaDeFecha('la fecha de inicio'),
    horaInicio: esquemaDeHora('la hora de inicio').optional(),
    fechaFin: esquemaDeFecha('la fecha de fin'),
    horaFin: esquemaDeHora('la hora de fin').optional(),
    motivo: z.string().trim().optional(),
    confirmarCancelaciones: z.boolean().optional(),
  })
  .refine((d) => d.fechaFin >= d.fechaInicio, {
    message: FIN_ANTES_QUE_INICIO,
    path: ['fechaFin'],
  })
  .refine((d) => !d.horaInicio || !d.horaFin || d.horaInicio < d.horaFin, {
    message: HORA_FIN_ANTES_QUE_INICIO,
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

  // CU-03 — Recién acá, después de responder y sin `await`: es el mismo criterio que el
  // resto de los avisos, un mensaje caído no puede hacer fallar un bloqueo ya guardado.
  //
  // Fuera de la transacción a propósito: mandar mensajes por HTTP adentro de una la
  // mantendría abierta todo lo que tarde Meta en contestar, por cada turno.
  void enviarAvisosDeCancelacionEnMasa(turnosAfectados)
}

/** Editar un bloqueo. Mismo cuerpo y **mismo flujo de dos pasos** que crearlo: un rango
 * nuevo puede llevarse turnos por delante igual que uno recién hecho, así que responde 409
 * con la lista hasta que venga `confirmarCancelaciones`. Sin eso, editar sería la puerta
 * de atrás que se saltea el aviso que la creación sí da. */
export async function patchBloqueo(req: Request, res: Response) {
  const parsedId = idSchema.safeParse(req.params)
  if (!parsedId.success) {
    respondErrorParametrosInvalidos(res, 'No encontramos ese bloqueo.')
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

    // Igual que al crear el bloqueo: editar el rango cancela turnos exactamente igual, así
    // que tiene que avisar exactamente igual. Sin esto, editar sería la puerta de atrás que
    // se saltea el aviso — el mismo argumento por el que ya pasa por la confirmación de dos
    // pasos.
    void enviarAvisosDeCancelacionEnMasa(turnosAfectados)
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
    respondErrorParametrosInvalidos(res, 'No encontramos ese bloqueo.')
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
