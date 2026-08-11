import { Request, Response } from 'express'
import { z } from 'zod'
import { obtenerCobros } from '../services/cobros.service'
import { clienteDto, type TurnoConCliente } from '../services/clientes.service'
import {
  fechaDesdeIso,
  formatearFecha,
  formatearHora,
} from '../utils/fechaHora'

// HU-27 — Lo cobrado en un período.

// Un año y dos meses de margen. No es una regla de negocio: es el techo que evita que un
// `desde` mal tipeado (2016 en vez de 2026) se lleve la tabla entera. El rango de la
// agenda es más corto (31 días) porque ahí se dibuja día por día; acá se agrega.
const MAX_DIAS_RANGO = 425

const rangoSchema = z
  .object({
    desde: z.iso.date(),
    hasta: z.iso.date(),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: 'hasta debe ser posterior o igual a desde.',
    path: ['hasta'],
  })
  .refine(
    (q) =>
      (fechaDesdeIso(q.hasta).getTime() - fechaDesdeIso(q.desde).getTime()) /
        86_400_000 <=
      MAX_DIAS_RANGO,
    { message: 'El período es demasiado largo.' },
  )

/** Más chico que `TurnoAdmin`: esta pantalla es una lista de cobros, no la agenda. No
 * lleva teléfono ni email. Sí el apodo, que es como Ariel lo tiene guardado en la cabeza
 * (HU-25).
 *
 * `estado` viaja aunque acá sean todos `realizado`, y `servicio` viaja como objeto y no
 * como el nombre pelado, porque desde esta lista se abre el mismo modal de cobro que en la
 * agenda: necesita el id para leer el **precio de hoy**, y el estado para saber que ya
 * está marcado. Leerlos de la fila en vez de darlos por sentado evita que el día que esta
 * consulta cambie, el modal se coma una mentira. */
function turnoCobradoDto(turno: TurnoConCliente) {
  return {
    id: turno.id,
    fecha: formatearFecha(turno.fecha),
    hora: formatearHora(turno.horaInicio),
    estado: turno.estado,
    clienteNombre: turno.clienteNombre,
    cliente: turno.cliente ? clienteDto(turno.cliente) : null,
    // El **nombre** es el snapshot de cuando se reservó; el **id** apunta al servicio de
    // hoy, que es de donde sale el precio. No es una inconsistencia: es exactamente la
    // regla de HU-27 —el precio se toma al cobrar, la foto del servicio al reservar— con
    // los dos datos puestos donde corresponde.
    servicio: { id: turno.servicioId, nombre: turno.servicioNombreSnapshot },
    medioPago: turno.medioPago,
    montoCobrado: turno.montoCobrado,
  }
}

export async function getCobros(req: Request, res: Response) {
  const parsed = rangoSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
      },
    })
    return
  }

  const resumen = await obtenerCobros(
    fechaDesdeIso(parsed.data.desde),
    fechaDesdeIso(parsed.data.hasta),
  )

  res.json({
    total: resumen.total,
    porMedio: resumen.porMedio,
    sinRegistrar: resumen.sinRegistrar,
    turnos: resumen.turnos.map(turnoCobradoDto),
  })
}
