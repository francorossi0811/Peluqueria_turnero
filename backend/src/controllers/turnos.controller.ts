import { Request, Response } from 'express'
import { z } from 'zod'
import { crearTurno } from '../services/turnos.service'
import {
  HorarioNoDisponibleError,
  ServicioNoDisponibleError,
} from '../services/errores'
import { fechaDesdeIso } from '../utils/fechaHora'

const bodySchema = z.object({
  servicioId: z.uuid(),
  fecha: z.iso.date(),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido, esperado HH:mm.'),
  clienteNombre: z.string().trim().min(1, 'Falta el nombre.'),
  clienteTelefono: z.string().trim().min(6, 'Teléfono inválido.'),
})

export async function postTurno(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
      },
    })
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

    res.status(201).json({
      id: turno.id,
      estado: turno.estado,
      fecha,
      hora,
      servicio: {
        nombre: turno.servicioNombreSnapshot,
        duracionMinutos: turno.servicioDuracionSnapshot,
      },
    })
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
    if (err instanceof HorarioNoDisponibleError) {
      res.status(409).json({
        error: {
          codigo: 'HORARIO_NO_DISPONIBLE',
          mensaje: 'Ese horario se acaba de ocupar.',
        },
      })
      return
    }
    throw err
  }
}
