import { Request, Response } from 'express'
import { z } from 'zod'
import {
  cancelarTurno,
  crearTurno,
  estaDentroDeVentanaDeCambio,
  listarTurnosEnRango,
  obtenerTurno,
  reprogramarTurno,
} from '../services/turnos.service'
import {
  FueraDeVentanaError,
  HorarioNoDisponibleError,
  ServicioNoDisponibleError,
  TurnoNoEncontradoError,
  TurnoNoModificableError,
} from '../services/errores'
import {
  ahoraArgentina,
  fechaDesdeIso,
  formatearFecha,
  formatearHora,
} from '../utils/fechaHora'
import type { Turno } from '../../generated/prisma/client.ts'

const horaSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido, esperado HH:mm.')

const bodySchema = z.object({
  servicioId: z.uuid(),
  fecha: z.iso.date(),
  hora: horaSchema,
  clienteNombre: z.string().trim().min(1, 'Falta el nombre.'),
  clienteTelefono: z.string().trim().min(6, 'Teléfono inválido.'),
})

const reprogramarSchema = z.object({
  servicioId: z.uuid().optional(),
  fecha: z.iso.date(),
  hora: horaSchema,
})

// HU-08: 'online' es exclusivo del flujo público, nunca de la carga manual de Ariel.
const bodyManualSchema = bodySchema.extend({
  origen: z.enum(['telefono', 'whatsapp']),
})

const idSchema = z.object({ id: z.uuid() })

const MAX_DIAS_RANGO = 31

const rangoSchema = z
  .object({
    desde: z.iso.date(),
    hasta: z.iso.date(),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: 'hasta debe ser posterior o igual a desde.',
    path: ['hasta'],
  })

function turnoADto(turno: Turno) {
  return {
    id: turno.id,
    estado: turno.estado,
    fecha: formatearFecha(turno.fecha),
    hora: formatearHora(turno.horaInicio),
    servicio: {
      nombre: turno.servicioNombreSnapshot,
      duracionMinutos: turno.servicioDuracionSnapshot,
    },
  }
}

// Vista de admin: además de lo público, Ariel necesita ver quién es y cómo contactarlo.
function turnoAdminDto(turno: Turno) {
  return {
    ...turnoADto(turno),
    horaFin: formatearHora(turno.horaFin),
    clienteNombre: turno.clienteNombre,
    clienteTelefono: turno.clienteTelefono,
    origen: turno.origen,
  }
}

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

function manejarErroresComunes(err: unknown, res: Response): boolean {
  if (err instanceof ServicioNoDisponibleError) {
    res.status(404).json({
      error: {
        codigo: 'SERVICIO_NO_ENCONTRADO',
        mensaje: 'El servicio no existe o no está activo.',
      },
    })
    return true
  }
  if (err instanceof HorarioNoDisponibleError) {
    res.status(409).json({
      error: {
        codigo: 'HORARIO_NO_DISPONIBLE',
        mensaje: 'Ese horario se acaba de ocupar.',
      },
    })
    return true
  }
  if (err instanceof TurnoNoEncontradoError) {
    res.status(404).json({
      error: {
        codigo: 'TURNO_NO_ENCONTRADO',
        mensaje: 'No encontramos ese turno.',
      },
    })
    return true
  }
  if (err instanceof TurnoNoModificableError) {
    res.status(409).json({
      error: {
        codigo: 'TURNO_NO_MODIFICABLE',
        mensaje: 'Este turno ya no está activo.',
      },
    })
    return true
  }
  if (err instanceof FueraDeVentanaError) {
    res.status(409).json({
      error: {
        codigo: 'FUERA_DE_VENTANA_CANCELACION',
        mensaje:
          'Ya no podés cancelar ni reprogramar online. Contactá directamente a Ariel.',
      },
    })
    return true
  }
  return false
}

export async function postTurno(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { servicioId, fecha, hora, clienteNombre, clienteTelefono } =
    parsed.data

  try {
    const turno = await crearTurno({
      servicioId,
      fecha: fechaDesdeIso(fecha),
      hora,
      clienteNombre,
      clienteTelefono,
    })
    res.status(201).json(turnoADto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-08 — Carga manual: mismas reglas que reservar (CU-01/CU-04), sin reimplementar
// nada; solo cambia quién la hace (Ariel, autenticado) y el origen guardado.
export async function postTurnoManual(req: Request, res: Response) {
  const parsed = bodyManualSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { servicioId, fecha, hora, clienteNombre, clienteTelefono, origen } =
    parsed.data

  try {
    const turno = await crearTurno({
      servicioId,
      fecha: fechaDesdeIso(fecha),
      hora,
      clienteNombre,
      clienteTelefono,
      origen,
    })
    res.status(201).json(turnoAdminDto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

export async function getTurno(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  try {
    const turno = await obtenerTurno(parsed.data.id)
    res.json({
      ...turnoADto(turno),
      puedeCancelar:
        turno.estado === 'reservado' &&
        estaDentroDeVentanaDeCambio(turno, ahoraArgentina()),
    })
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

export async function postCancelarTurno(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  try {
    const turno = await cancelarTurno(parsed.data.id)
    res.json(turnoADto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

export async function postReprogramarTurno(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  const bodyParsed = reprogramarSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { servicioId, fecha, hora } = bodyParsed.data

  try {
    const turno = await reprogramarTurno(idParsed.data.id, {
      servicioId,
      fecha: fechaDesdeIso(fecha),
      hora,
    })
    res.status(201).json(turnoADto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-06 (desde === hasta) / HU-07 (rango de 7 días) — misma ruta, ver especificacion-api.md.
export async function getAgenda(req: Request, res: Response) {
  const parsed = rangoSchema.safeParse(req.query)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { desde, hasta } = parsed.data
  const desdeFecha = fechaDesdeIso(desde)
  const hastaFecha = fechaDesdeIso(hasta)

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

  const turnos = await listarTurnosEnRango(desdeFecha, hastaFecha)
  res.json({ turnos: turnos.map(turnoAdminDto) })
}
