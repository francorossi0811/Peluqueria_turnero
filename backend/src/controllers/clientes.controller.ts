import { Request, Response } from 'express'
import { z } from 'zod'
import {
  actualizarCliente,
  clienteDto,
  historialDeCliente,
  listarClientes,
  obtenerCliente,
} from '../services/clientes.service'
import {
  ClienteNoEncontradoError,
  EtiquetaNoEncontradaError,
} from '../services/errores'
import { formatearFecha, formatearHora } from '../utils/fechaHora'
import type { Turno } from '../../generated/prisma/client.ts'

const idSchema = z.object({ id: z.uuid() })

const filtrosSchema = z.object({
  buscar: z.string().trim().optional(),
  etiquetaId: z.uuid().optional(),
})

// El apodo y las observaciones aceptan string vacío: es como la interfaz dice "borralo".
// `nullable` además, porque el frontend puede mandar `null` explícito.
const bodySchema = z
  .object({
    apodo: z.string().trim().max(60).nullable().optional(),
    notas: z.string().trim().max(2000).nullable().optional(),
    etiquetaIds: z.array(z.uuid()).optional(),
  })
  .refine(
    (d) =>
      d.apodo !== undefined ||
      d.notas !== undefined ||
      d.etiquetaIds !== undefined,
    { message: 'No mandaste ningún cambio.' },
  )

function respondErrorParametrosInvalidos(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

function respondClienteNoEncontrado(res: Response) {
  res.status(404).json({
    error: {
      codigo: 'CLIENTE_NO_ENCONTRADO',
      mensaje: 'No encontramos esa ficha.',
    },
  })
}

/** El historial que se ve dentro de la ficha. Es más chico que `turnoAdminDto` a
 * propósito: acá el cliente ya se sabe quién es, así que repetir su nombre y su teléfono
 * en cada fila sería ruido. */
function turnoDeHistorialDto(turno: Turno) {
  return {
    id: turno.id,
    fecha: formatearFecha(turno.fecha),
    hora: formatearHora(turno.horaInicio),
    estado: turno.estado,
    origen: turno.origen,
    servicio: {
      id: turno.servicioId,
      nombre: turno.servicioNombreSnapshot,
      duracionMinutos: turno.servicioDuracionSnapshot,
    },
  }
}

export async function getClientes(req: Request, res: Response) {
  const parsed = filtrosSchema.safeParse(req.query)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Filtros inválidos.')
    return
  }

  const clientes = await listarClientes(parsed.data)
  res.json({ clientes })
}

export async function getCliente(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de cliente inválido.')
    return
  }

  try {
    const cliente = await obtenerCliente(parsed.data.id)
    const turnos = await historialDeCliente(cliente.id)
    res.json({
      ...clienteDto(cliente),
      turnos: turnos.map(turnoDeHistorialDto),
    })
  } catch (err) {
    if (err instanceof ClienteNoEncontradoError) {
      respondClienteNoEncontrado(res)
      return
    }
    throw err
  }
}

export async function patchCliente(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de cliente inválido.')
    return
  }

  const bodyParsed = bodySchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    const cliente = await actualizarCliente(idParsed.data.id, bodyParsed.data)
    res.json(clienteDto(cliente))
  } catch (err) {
    if (err instanceof ClienteNoEncontradoError) {
      respondClienteNoEncontrado(res)
      return
    }
    if (err instanceof EtiquetaNoEncontradaError) {
      res.status(404).json({
        error: {
          codigo: 'ETIQUETA_NO_ENCONTRADA',
          mensaje: 'Alguna de esas etiquetas ya no existe.',
        },
      })
      return
    }
    throw err
  }
}
