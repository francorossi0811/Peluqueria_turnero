import { Request, Response } from 'express'
import { z } from 'zod'
import {
  esquemaDeFecha,
  FIN_ANTES_QUE_INICIO,
  periodoDemasiadoLargo,
} from '../utils/esquemasFecha'
import {
  calcularDisponibilidad,
  DIAS_FUTURO_PUBLICO,
  DIAS_PASADOS_ADMIN,
  type OpcionesDisponibilidad,
} from '../services/disponibilidad.service'
import { ServicioNoDisponibleError } from '../services/errores'
import { TECHO_TECNICO_DE_BLOQUE } from '../services/turnos.service'
import { ahoraArgentina, fechaDesdeIso, formatearFecha } from '../utils/fechaHora'

const MAX_DIAS_RANGO = 31

/** Cuántos servicios se pueden pedir en una consulta.
 *
 * ⚠️ Es el techo **técnico** y no el de negocio: el tope del cliente (`MAX_TURNOS_POR_GRUPO`)
 * lo aplica el endpoint que crea los turnos, y **Ariel no tiene ninguno**, así que esta
 * misma ruta le sirve a los dos. Acá solo se frena el pedido absurdo. */
const MAX_SERVICIOS_POR_CONSULTA = TECHO_TECNICO_DE_BLOQUE

/** HU-31 — `servicioIds` es una lista separada por comas: los servicios del bloque, en
 * orden. La duración que se busca es la suma.
 *
 * ⚠️ `servicioId` (singular) se mantiene y hace exactamente lo de siempre. No es cortesía
 * con un cliente externo —no hay ninguno—: lo usan la reprogramación y el panel de Ariel,
 * que piden por **un** servicio y a los que un parámetro en plural no les dice nada. */
const querySchema = z
  .object({
    servicioId: z.uuid().optional(),
    servicioIds: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(z.uuid()).min(1).max(MAX_SERVICIOS_POR_CONSULTA).optional()),
    desde: esquemaDeFecha('la fecha de inicio'),
    hasta: esquemaDeFecha('la fecha de fin'),
  })
  .refine((q) => q.servicioId ?? q.servicioIds, {
    message: 'Falta el servicio.',
    path: ['servicioId'],
  })
  .refine((q) => q.hasta >= q.desde, {
    message: FIN_ANTES_QUE_INICIO,
    path: ['hasta'],
  })

/** Lo común a los dos endpoints: validar, acotar el rango y responder. Lo único que los
 * separa son las `opciones` con las que se calcula, que es exactamente la diferencia
 * entre "pregunta un cliente" y "pregunta Ariel". */
async function responderDisponibilidad(
  req: Request,
  res: Response,
  opciones: OpcionesDisponibilidad,
  desdeMinimo: string,
  hastaMaximo?: string,
) {
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

  const { servicioId, servicioIds, desde, hasta } = parsed.data
  // Piso duro del lado del servidor. Se **recorta** en vez de rechazar a propósito: el
  // frontend no tiene que adivinar dónde está el borde, y un 400 por pedir un día de más
  // dejaría la grilla vacía sin explicar nada. Si el recorte deja el rango dado vuelta
  // (pidió solo días demasiado viejos), la comparación de abajo lo atrapa.
  const desdeEfectivo = desde < desdeMinimo ? desdeMinimo : desde
  // HU-28 — El techo, exactamente la operación simétrica del piso de arriba y por el mismo
  // motivo: recortar en vez de rechazar. Solo lo pasa el endpoint público; Ariel no tiene
  // tope hacia adelante. Sin esto la grilla del cliente ofrecería días que `crearTurno` va
  // a rechazar, que es justo el despegue que este archivo ya evita del otro lado.
  const hastaEfectivo =
    hastaMaximo && hasta > hastaMaximo ? hastaMaximo : hasta
  if (hastaEfectivo < desdeEfectivo) {
    res.json({ disponibilidad: [] })
    return
  }

  const desdeFecha = fechaDesdeIso(desdeEfectivo)
  const hastaFecha = fechaDesdeIso(hastaEfectivo)

  const dias =
    Math.round((hastaFecha.getTime() - desdeFecha.getTime()) / 86_400_000) + 1
  if (dias > MAX_DIAS_RANGO) {
    res.status(400).json({
      error: {
        codigo: 'RANGO_DEMASIADO_AMPLIO',
        mensaje: periodoDemasiadoLargo(MAX_DIAS_RANGO),
      },
    })
    return
  }

  try {
    const disponibilidad = await calcularDisponibilidad(
      servicioIds ?? [servicioId!],
      desdeFecha,
      hastaFecha,
      opciones,
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

/** CU-04 — La disponibilidad que ve el cliente: con la antelación mínima de 30 minutos,
 * sin nada del pasado y sin nada más allá del horizonte de HU-28. No recibe opciones y no
 * puede recibirlas: la ruta es la que dice quién pregunta. */
export async function getDisponibilidad(req: Request, res: Response) {
  const hoy = ahoraArgentina()
  const hastaMaximo = new Date(hoy.getTime())
  hastaMaximo.setUTCDate(hastaMaximo.getUTCDate() + DIAS_FUTURO_PUBLICO)

  await responderDisponibilidad(
    req,
    res,
    {},
    formatearFecha(hoy), // nunca antes de hoy
    formatearFecha(hastaMaximo), // ni más allá del horizonte
  )
}

/** HU-08 — La misma disponibilidad, pero con las reglas de Ariel:
 *
 *  - **margen 0 siempre.** La antelación de 30 minutos es una regla para el cliente que
 *    reserva por la web, no para el dueño que está parado en el local. Hasta acá el panel
 *    consumía el endpoint público, así que el `margenMinutos: 0` que `crearTurno` y
 *    `editarTurno` ya aceptaban era inalcanzable desde la pantalla: se podía por API y no
 *    desde la UI.
 *  - **`incluirPasado`** abre los últimos `DIAS_PASADOS_ADMIN` días, para registrar a los
 *    clientes de vidriera. Lo manda la carga manual; el reprogramar lo deja apagado —
 *    mover un turno a un horario que ya pasó es otra cosa y no es lo que se pidió.
 *
 * Va detrás de `requireAuth` y **no** como un query param de la ruta pública: es la ruta
 * la que expresa quién pregunta, igual que con `POST /turnos` vs `POST /admin/turnos`. Un
 * flag en la ruta pública despegaría la grilla del cliente de lo que puede reservar, y
 * dejaría un parámetro invitando a que alguien lo cablee a la creación más adelante.
 */
export async function getDisponibilidadAdmin(req: Request, res: Response) {
  const incluirPasado = req.query.incluirPasado === 'true'

  const hoy = ahoraArgentina()
  const desdeMinimo = new Date(hoy.getTime())
  if (incluirPasado) {
    desdeMinimo.setUTCDate(desdeMinimo.getUTCDate() - DIAS_PASADOS_ADMIN)
  }

  await responderDisponibilidad(
    req,
    res,
    { margenMinutos: 0, permitirPasado: incluirPasado },
    formatearFecha(desdeMinimo),
  )
}
