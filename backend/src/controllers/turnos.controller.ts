import { Request, Response } from 'express'
import { z } from 'zod'
import {
  buscarTurnos,
  cancelarTurno,
  cancelarTurnoAdmin,
  contarNuevosDespuesDe,
  crearTurno,
  editarTurno,
  estaDentroDeVentanaDeCambio,
  guardarEmailDelCliente,
  listarTurnosEnRango,
  marcarTurno,
  marcarTurnosComoVistos,
  obtenerTurno,
  reprogramarTurno,
} from '../services/turnos.service'
import {
  FueraDeVentanaError,
  HorarioNoDisponibleError,
  ServicioNoDisponibleError,
  TurnoNoEncontradoError,
  TurnoNoModificableError,
  TurnoYaTieneEmailError,
} from '../services/errores'
import {
  enviarConfirmacionDeTurno,
  icsDeTurno,
  notificarNuevoTurno,
} from '../services/notificaciones.service'
import {
  ahoraArgentina,
  fechaDesdeIso,
  formatearFecha,
  formatearHora,
} from '../utils/fechaHora'
import {
  esTelefonoValido,
  MENSAJE_TELEFONO_INVALIDO,
} from '../utils/validaciones'
import type { Turno } from '../../generated/prisma/client.ts'

const horaSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido, esperado HH:mm.')

const bodySchema = z.object({
  servicioId: z.uuid(),
  fecha: z.iso.date(),
  hora: horaSchema,
  clienteNombre: z.string().trim().min(1, 'Falta el nombre.'),
  // El `min(6)` de antes dejaba pasar "abcdef": Ariel necesita este número para poder
  // llamar o escribir por WhatsApp, así que tiene que ser un teléfono de verdad.
  clienteTelefono: z
    .string()
    .trim()
    .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO),
  // HU-19 — Opcional. El `preprocess` es necesario porque un input de texto vacío llega
  // como `""`, que no pasa la validación de email; sin esto, dejar el campo en blanco
  // daría error en vez de significar "no dejó mail".
  clienteEmail: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.email('El email no parece válido.').optional(),
  ),
})

const reprogramarSchema = z.object({
  servicioId: z.uuid().optional(),
  fecha: z.iso.date(),
  hora: horaSchema,
})

// HU-08: 'online' es exclusivo del flujo público, nunca de la carga manual de Ariel.
//
// El teléfono se **sobrescribe** para hacerlo opcional. Es la única diferencia de
// validación entre los dos flujos, y va acá y no en `bodySchema` a propósito: al cliente
// que reserva por la web se le sigue exigiendo, porque es el único dato con el que Ariel
// lo puede ubicar si algo cambia. Ariel, en cambio, muchas veces está cargando un turno
// con la persona sentada enfrente y no se sabe el número de memoria.
//
// El `preprocess` es el mismo molde que usa `clienteEmail`: el input vacío del panel
// llega como `""`, y sin esto no pasaría la validación en vez de significar "no lo sé".
// Lo que **no** cambia: si escribió algo, tiene que ser un teléfono válido.
const bodyManualSchema = bodySchema.extend({
  origen: z.enum(['telefono', 'whatsapp']),
  clienteTelefono: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z
      .string()
      .trim()
      .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO)
      .optional(),
  ),
})

// HU-09: mismos fecha/hora que reprogramar, pero sin servicioId (no cambia el servicio).
const editarSchema = z.object({
  fecha: z.iso.date(),
  hora: horaSchema,
})

// HU-12
const estadoSchema = z.object({
  estado: z.enum(['realizado', 'ausente']),
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
      // id del servicio (no del snapshot) — lo necesita el frontend para pedir
      // disponibilidad real al reprogramar (CU-02). No es sensible: el token es el id
      // del turno, no el del servicio.
      id: turno.servicioId,
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
    clienteEmail: turno.clienteEmail,
    origen: turno.origen,
    vistoPorAdmin: turno.vistoPorAdmin,
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

  const {
    servicioId,
    fecha,
    hora,
    clienteNombre,
    clienteTelefono,
    clienteEmail,
  } = parsed.data

  try {
    const turno = await crearTurno({
      servicioId,
      fecha: fechaDesdeIso(fecha),
      hora,
      clienteNombre,
      clienteTelefono,
      clienteEmail,
    })
    res.status(201).json(turnoADto(turno))

    // Avisos, después de responder y sin `await`: la reserva ya está guardada, y ni un
    // push ni un mail caído pueden hacerla fallar. Va acá y no dentro de `crearTurno`
    // para que la carga manual de Ariel (postTurnoManual) no dispare nada — es la ruta,
    // y no un flag, la que expresa "esto vino de un cliente".
    void notificarNuevoTurno(turno)
    void enviarConfirmacionDeTurno(turno)
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

/** HU-19 — Descarga del turno como archivo de calendario.
 *
 * Es pública y sin auth por el mismo motivo que `GET /api/turnos/:id`: el id del turno
 * ES el token de acceso. Tener la generación acá (y no en el navegador) permite que el
 * mail de confirmación apunte a esta misma URL, sin duplicar la lógica. */
export async function getTurnoIcs(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  try {
    const turno = await obtenerTurno(parsed.data.id)
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="turno.ics"')
    res.send(icsDeTurno(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

const emailSchema = z.object({
  email: z.email('El email no parece válido.'),
})

/** HU-19 — El cliente que reservó sin dejar mail lo carga desde la pantalla de
 * confirmación y recibe ahí mismo su link.
 *
 * Público, sin auth, igual que el resto de `/turnos/:id`: el id es el token. El límite
 * de un solo uso por turno —el motivo por el que esto no es un relay de mails abierto—
 * está explicado en `guardarEmailDelCliente`. */
export async function postEnviarConfirmacion(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  const bodyParsed = emailSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { email } = bodyParsed.data

  try {
    const turno = await guardarEmailDelCliente(idParsed.data.id, email)
    res.json({ email })

    void enviarConfirmacionDeTurno(turno)
  } catch (err) {
    if (err instanceof TurnoYaTieneEmailError) {
      res.status(409).json({
        error: {
          codigo: 'TURNO_YA_TIENE_EMAIL',
          mensaje: 'Este turno ya tiene un email cargado.',
        },
      })
      return
    }
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

  const {
    servicioId,
    fecha,
    hora,
    clienteNombre,
    clienteTelefono,
    clienteEmail,
    origen,
  } = parsed.data

  try {
    const turno = await crearTurno({
      servicioId,
      fecha: fechaDesdeIso(fecha),
      hora,
      clienteNombre,
      clienteTelefono,
      clienteEmail,
      origen,
    })
    res.status(201).json(turnoAdminDto(turno))

    // También cuando lo carga Ariel: si el cliente le dictó un mail, merece la
    // confirmación con su link igual que si hubiera reservado él mismo por la web.
    void enviarConfirmacionDeTurno(turno)
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

    // Reprogramar crea un turno nuevo, o sea un link nuevo: sin este mail, el único
    // link que le queda al cliente apunta a un turno ya en estado `reprogramado`.
    void enviarConfirmacionDeTurno(turno, { esReprogramacion: true })
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

  // HU-17 — Además de los del rango visible, cuántos turnos sin ver hay más adelante.
  // El horizonte es el mismo largo que el rango que está mirando: parado en un día
  // cuenta la semana siguiente, y parado en una semana cuenta la que viene. Así el
  // aviso siempre habla de "lo que sigue" en la unidad en la que Ariel está pensando.
  const largoRangoMs = hastaFecha.getTime() - desdeFecha.getTime() + 86_400_000
  const horizonte = new Date(
    hastaFecha.getTime() + Math.max(largoRangoMs, 7 * 86_400_000),
  )
  const nuevosMasAdelante = await contarNuevosDespuesDe(hastaFecha, horizonte)

  res.json({
    turnos: turnos.map(turnoAdminDto),
    nuevosMasAdelante,
    hastaMasAdelante: formatearFecha(horizonte),
  })
}

// HU-09 — Mover un turno a otro horario, sin la ventana de 60 min del cliente.
export async function patchTurno(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  const bodyParsed = editarSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    const turno = await editarTurno(idParsed.data.id, {
      fecha: fechaDesdeIso(bodyParsed.data.fecha),
      hora: bodyParsed.data.hora,
    })
    res.json(turnoAdminDto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-10 — Cancelar como admin, sin la ventana de 60 min del cliente.
export async function postCancelarTurnoAdmin(req: Request, res: Response) {
  const parsed = idSchema.safeParse(req.params)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  try {
    const turno = await cancelarTurnoAdmin(parsed.data.id)
    res.json(turnoAdminDto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-12 — Marcar Realizado o Ausente.
export async function patchEstadoTurno(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  const bodyParsed = estadoSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    const turno = await marcarTurno(idParsed.data.id, bodyParsed.data.estado)
    res.json(turnoAdminDto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-17
const marcarVistosSchema = z.object({
  ids: z.array(z.uuid()).min(1, 'Mandá al menos un turno.'),
})

export async function postMarcarVistos(req: Request, res: Response) {
  const parsed = marcarVistosSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const marcados = await marcarTurnosComoVistos(parsed.data.ids)
  res.json({ marcados })
}

const buscarSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    telefono: z.string().trim().min(1).optional(),
  })
  .refine((q) => q.nombre || q.telefono, {
    message: 'Mandá al menos nombre o teléfono para buscar.',
  })

// Caso borde: cliente perdió su link único — Ariel busca el turno para reenviárselo.
export async function getBuscarTurnos(req: Request, res: Response) {
  const parsed = buscarSchema.safeParse(req.query)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const turnos = await buscarTurnos(parsed.data)
  res.json({ turnos: turnos.map(turnoAdminDto) })
}
