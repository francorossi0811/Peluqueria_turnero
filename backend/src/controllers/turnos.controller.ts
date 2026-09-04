import { Request, Response } from 'express'
import { z } from 'zod'
import {
  buscarTurnos,
  cancelarTurno,
  cancelarTurnoAdmin,
  cargarTelefonoDelTurno,
  idsNuevosDespuesDe,
  crearTurno,
  crearTurnosEnGrupo,
  editarTurno,
  esCobrable,
  estaDentroDeVentanaDeCambio,
  fechaCargableComoAdmin,
  guardarEmailDelCliente,
  listarTurnosEnRango,
  marcarTurno,
  marcarTurnosComoVistos,
  MAX_TURNOS_POR_GRUPO,
  MAX_TURNOS_POR_SEMANA,
  TECHO_TECNICO_DE_BLOQUE,
  obtenerTurno,
  registrarCobro,
  reprogramarTurno,
} from '../services/turnos.service'
import { clienteDto, type TurnoConCliente } from '../services/clientes.service'
import {
  FueraDeHorizonteError,
  FueraDeVentanaError,
  HorarioNoDisponibleError,
  LimiteSemanalError,
  ServicioNoDisponibleError,
  TurnoNoCobrableError,
  TurnoNoEncontradoError,
  TurnoNoModificableError,
  TurnoSeSolapaConRealizadoError,
  TurnoYaTieneEmailError,
} from '../services/errores'
import {
  DIAS_FUTURO_PUBLICO,
  DIAS_PASADOS_ADMIN,
} from '../services/disponibilidad.service'
import {
  enviarAvisoDeCancelacion,
  enviarConfirmacionDeTurno,
  icsDeTurno,
  notificarNuevosTurnos,
  notificarNuevoTurno,
  notificarTurnoCancelado,
} from '../services/notificaciones.service'
import {
  ahoraArgentina,
  fechaDesdeIso,
  formatearFecha,
  formatearHora,
} from '../utils/fechaHora'
import {
  esNombreValido,
  esTelefonoUtilizable,
  esTelefonoValido,
  MENSAJE_NOMBRE_INVALIDO,
  MENSAJE_TELEFONO_INEXISTENTE,
  MENSAJE_TELEFONO_INVALIDO,
} from '../utils/validaciones'
import {
  esquemaDeFecha,
  esquemaDeHora,
  FIN_ANTES_QUE_INICIO,
  periodoDemasiadoLargo,
} from '../utils/esquemasFecha'


const bodySchema = z.object({
  servicioId: z.uuid(),
  fecha: esquemaDeFecha('la fecha del turno'),
  hora: esquemaDeHora('la hora del turno'),
  // Solo letras (más espacios, apóstrofes y guiones). Es la misma clase de regla que el
  // teléfono: sirve para que Ariel pueda ubicar y llamar a una persona, y "Juan123" o un
  // campo lleno de símbolos no ubican a nadie.
  clienteNombre: z
    .string()
    .trim()
    .min(1, 'Falta el nombre.')
    .refine(esNombreValido, MENSAJE_NOMBRE_INVALIDO),
  // El `min(6)` de antes dejaba pasar "abcdef": Ariel necesita este número para poder
  // llamar o escribir por WhatsApp, así que tiene que ser un teléfono de verdad.
  //
  // Los dos refines van en este orden porque dicen cosas distintas y el primero que falla
  // es el que se muestra: "está mal escrito" antes que "ese número no existe".
  clienteTelefono: z
    .string()
    .trim()
    .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO)
    .refine(esTelefonoUtilizable, MENSAJE_TELEFONO_INEXISTENTE),
  // HU-19 — Opcional. El `preprocess` es necesario porque un input de texto vacío llega
  // como `""`, que no pasa la validación de email; sin esto, dejar el campo en blanco
  // daría error en vez de significar "no dejó mail".
  clienteEmail: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.email('El email no parece válido.').optional(),
  ),
})

// HU-31 — La reserva en grupo. Reusa los mismos refines del teléfono y del nombre que
// `bodySchema`: la regla de qué es un teléfono utilizable tiene que ser una sola, y ya se
// pagó una vez el precio de tener dos (ver la nota de HU-08 en CLAUDE.md).
//
// ⚠️ El teléfono y el mail están afuera del array a propósito — ver `DatosGrupoDeTurnos`.
const grupoSchema = z.object({
  clienteTelefono: z
    .string()
    .trim()
    .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO)
    .refine(esTelefonoUtilizable, MENSAJE_TELEFONO_INEXISTENTE),
  clienteEmail: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.email('El email no parece válido.').optional(),
  ),
  // ⚠️ La fecha y la hora son del **bloque**, no de cada turno: los turnos van pegados uno
  // atrás del otro y el backend deriva la hora de cada uno encadenando duraciones. Un bloque
  // con huecos o superpuesto dejó de ser representable, así que no hay nada que validar.
  fecha: esquemaDeFecha('la fecha del turno'),
  hora: esquemaDeHora('la hora del turno'),
  turnos: z
    .array(
      z.object({
        servicioId: z.uuid(),
        clienteNombre: z
          .string()
          .trim()
          .min(1, 'Falta el nombre.')
          .refine(esNombreValido, MENSAJE_NOMBRE_INVALIDO),
      }),
    )
    .min(1, 'Elegí al menos un turno.')
    .max(
      MAX_TURNOS_POR_GRUPO,
      `Se pueden reservar hasta ${MAX_TURNOS_POR_GRUPO} turnos por vez.`,
    ),
})

const reprogramarSchema = z.object({
  servicioId: z.uuid().optional(),
  fecha: esquemaDeFecha('la fecha nueva'),
  hora: esquemaDeHora('la hora nueva'),
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
  origen: z.enum(['presencial', 'llamada', 'whatsapp']),
  // ⚠️ El nombre se **sobrescribe** para sacarle la regla de "solo letras", por el mismo
  // motivo que el teléfono de acá abajo y con el mismo mecanismo (pisar el campo en este
  // schema, no aflojar el de `bodySchema`). Ariel anota lo que le sirve para reconocer a
  // la persona — "Señora del 3B", "Juan 2" — y esa es su agenda, no un formulario. Sin
  // este override, extender `bodySchema` le heredaría la regla del cliente y le rompería
  // la carga manual.
  clienteNombre: z.string().trim().min(1, 'Falta el nombre.'),
  clienteTelefono: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z
      .string()
      .trim()
      .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO)
      .refine(esTelefonoUtilizable, MENSAJE_TELEFONO_INEXISTENTE)
      .optional(),
  ),
})

/** HU-31 + HU-08 — El bloque que carga Ariel. Es a `grupoSchema` lo que `bodyManualSchema`
 * es a `bodySchema`, y con los mismos dos overrides y por los mismos motivos:
 *
 * - **El nombre pierde la regla de "solo letras"**: Ariel anota lo que le sirve para
 *   reconocer a la persona ("Señora del 3B", "Juan 2"), y esa es su agenda.
 * - **El teléfono es opcional**: no se sabe los números de memoria. Sin teléfono no hay
 *   ficha, igual que hoy en la carga de a uno.
 *
 * ⚠️ **Sin tope de cantidad**, al revés que el público. Es la misma asimetría de HU-08 y
 * HU-28: el panel no lo limita, porque él sabe a quién está atendiendo. El único techo es
 * `TECHO_TECNICO_DE_BLOQUE`, que no es una regla de negocio sino un freno para que nadie
 * pida un cálculo absurdo. */
const grupoManualSchema = grupoSchema.extend({
  origen: z.enum(['presencial', 'llamada', 'whatsapp']),
  clienteTelefono: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z
      .string()
      .trim()
      .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO)
      .refine(esTelefonoUtilizable, MENSAJE_TELEFONO_INEXISTENTE)
      .optional(),
  ),
  turnos: z
    .array(
      z.object({
        servicioId: z.uuid(),
        clienteNombre: z.string().trim().min(1, 'Falta el nombre.'),
      }),
    )
    .min(1, 'Elegí al menos un turno.')
    .max(TECHO_TECNICO_DE_BLOQUE, 'Son demasiados turnos de una vez.'),
})

// HU-09: mismos fecha/hora que reprogramar, pero sin servicioId (no cambia el servicio).
const editarSchema = z.object({
  fecha: esquemaDeFecha('la fecha nueva'),
  hora: esquemaDeHora('la hora nueva'),
})

// HU-27 — El cobro. Los dos campos van juntos o no va ninguno: un medio de pago sin
// monto no suma en ningún total, y un monto sin medio no aparece en ningún desglose.
//
// ⚠️ **`tarjeta` no está y no es un olvido** (21/8/2026): Ariel no cobra con tarjeta y
// Franco la sacó del panel. La regla se aplica **también acá** y no solo en la pantalla,
// porque si viviera únicamente en el frontend cualquiera podría volver a meter el valor
// armando el request a mano, y volveríamos a tener una categoría muerta ensuciando los
// desgloses. El valor **sigue existiendo en el enum de la base** para no perder lo que se
// hubiera cobrado así antes; sacarlo de ahí es una migración sobre `turnos`, que es la
// tabla donde vive el `EXCLUDE` escrito a mano.
const cobroSchema = z.object({
  medioPago: z.enum(['efectivo', 'transferencia', 'mercado_pago'], {
    message: 'Elegí cómo te pagaron: efectivo, transferencia o Mercado Pago.',
  }),
  montoCobrado: z
    .int('El monto va en pesos enteros.')
    .nonnegative('El monto no puede ser negativo.')
    .max(10_000_000, 'Monto demasiado alto.'),
})

// HU-12 + HU-27. La regla de qué se puede cobrar vive en el service (`esCobrable`), no
// duplicada acá: el request se rechaza con el mismo criterio con el que el service se
// negaría igual.
export const estadoSchema = z
  .object({
    estado: z.enum(['realizado', 'ausente']),
    cobro: cobroSchema.optional(),
  })
  .refine((d) => !d.cobro || esCobrable(d.estado), {
    message: 'Un turno ausente no se cobra.',
  })

const idSchema = z.object({ id: z.uuid() })

const MAX_DIAS_RANGO = 31

const rangoSchema = z
  .object({
    desde: esquemaDeFecha('la fecha de inicio'),
    hasta: esquemaDeFecha('la fecha de fin'),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: FIN_ANTES_QUE_INICIO,
    path: ['hasta'],
  })

function turnoADto(turno: TurnoConCliente) {
  return {
    id: turno.id,
    estado: turno.estado,
    // El nombre con el que reservó. No es abrir un dato nuevo: el que tiene este link ya
    // ve el turno entero, y el nombre es el suyo — al revés que el teléfono o el mail,
    // que son datos de contacto y siguen siendo solo de admin (`turnoAdminDto`).
    //
    // Está acá porque los mensajes de WhatsApp que arma el cliente empiezan con "soy
    // ___", y la pantalla de gestión es el único lugar donde ese nombre no se tipeó en
    // esta sesión. Sin esto la cancelación y la reprogramación salían sin firmar.
    clienteNombre: turno.clienteNombre,
    fecha: formatearFecha(turno.fecha),
    hora: formatearHora(turno.horaInicio),
    servicio: {
      // id del servicio (no del snapshot) — lo necesita el frontend para pedir
      // disponibilidad real al reprogramar (CU-02). No es sensible: el token es el id
      // del turno, no el del servicio.
      id: turno.servicioId,
      nombre: turno.servicioNombreSnapshot,
      duracionMinutos: turno.servicioDuracionSnapshot,
      // ⚠️ El nombre y la duración son el snapshot de la reserva; el precio es el de HOY.
      // No es una inconsistencia: la duración se congela porque decide la disponibilidad,
      // y el precio es el que se le va a cobrar cuando venga (misma regla que
      // `montoCobrado`, HU-27). Enmienda a HU-27: hasta el 14/8/2026 el cliente no veía
      // ningún precio.
      precio: turno.servicio.precio,
    },
  }
}

// Vista de admin: además de lo público, Ariel necesita ver quién es y cómo contactarlo.
//
// `cliente` es la ficha (HU-25) y viaja hasta acá porque la grilla de la semana dibuja las
// insignias de color sin abrir nada: pedirlas aparte sería una consulta por turno. Es
// `null` cuando el turno no tiene teléfono y por lo tanto no tiene ficha.
function turnoAdminDto(turno: TurnoConCliente) {
  return {
    ...turnoADto(turno),
    horaFin: formatearHora(turno.horaFin),
    // `clienteNombre` ya viene de `turnoADto` desde el 21/8/2026; acá se repetía.
    clienteTelefono: turno.clienteTelefono,
    clienteEmail: turno.clienteEmail,
    origen: turno.origen,
    vistoPorAdmin: turno.vistoPorAdmin,
    cliente: turno.cliente ? clienteDto(turno.cliente) : null,
    // HU-27 — Solo en el DTO de admin. `turnoADto`, que es el que ve el cliente en su
    // link de gestión, no los lleva: el precio es interno.
    medioPago: turno.medioPago,
    montoCobrado: turno.montoCobrado,
    cobradoEn: turno.cobradoEn ? turno.cobradoEn.toISOString() : null,
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
  // HU-28 — Los dos topes de la reserva pública. Son 409 y no 400 por lo mismo que
  // `FUERA_DE_VENTANA_CANCELACION`: el request está bien armado, lo que no da es el estado
  // de las cosas. Los mensajes se arman con las constantes para que el número del texto no
  // se despegue del que aplica el backend.
  if (err instanceof LimiteSemanalError) {
    res.status(409).json({
      error: {
        codigo: 'LIMITE_SEMANAL_ALCANZADO',
        mensaje: `Ya tenés ${MAX_TURNOS_POR_SEMANA} turnos reservados para esos días. Cancelá alguno desde tu link o escribinos por WhatsApp.`,
      },
    })
    return true
  }
  if (err instanceof FueraDeHorizonteError) {
    res.status(409).json({
      error: {
        codigo: 'FUERA_DE_HORIZONTE',
        mensaje: `Por ahora se puede reservar hasta ${DIAS_FUTURO_PUBLICO} días adelante.`,
      },
    })
    return true
  }
  // HU-08 — El mensaje nombra el problema concreto porque la salida no es obvia: hay que
  // decidir cuál de los dos turnos se hizo de verdad y marcar el otro Ausente.
  if (err instanceof TurnoSeSolapaConRealizadoError) {
    res.status(409).json({
      error: {
        codigo: 'TURNO_SE_SOLAPA_CON_REALIZADO',
        mensaje:
          'Ese rato ya lo ocupa otro turno realizado. Marcá Ausente al que no atendiste.',
      },
    })
    return true
  }
  // HU-27
  if (err instanceof TurnoNoCobrableError) {
    res.status(409).json({
      error: {
        codigo: 'TURNO_NO_COBRABLE',
        mensaje: 'Solo se le registra el cobro a un turno realizado.',
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

/**
 * HU-31 — Reservar 2 o 3 turnos de una (la mamá que trae a los hijos).
 *
 * Endpoint aparte y no un `POST /api/turnos` que acepte array: así el caso de un turno solo
 * —el normal— no pasa por una sola línea de código nueva. Mismo schema, mismo `crearTurno`,
 * mismos tests.
 *
 * Devuelve un **array** de turnos: cada uno queda con su propio id, que es su token de
 * gestión. Una vez creados son turnos independientes en todo sentido, y por eso no hay
 * ninguna columna que los ate (ver `Docs/modelo-datos.md`).
 */
export async function postTurnosEnGrupo(req: Request, res: Response) {
  const parsed = grupoSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { clienteTelefono, clienteEmail, fecha, hora, turnos } = parsed.data

  try {
    const creados = await crearTurnosEnGrupo({
      clienteTelefono,
      clienteEmail,
      fecha: fechaDesdeIso(fecha),
      hora,
      turnos,
    })
    res.status(201).json(creados.map(turnoADto))

    // Igual que en `postTurno`: después de responder y sin `await`.
    //
    // ⚠️ El push a Ariel es **uno solo** para todo el grupo (tres avisos seguidos por una
    // persona reservando es ruido, y él ya tiene problemas con los push). Los mails, en
    // cambio, van de a uno: cada turno tiene su propio link de gestión y su propio .ics,
    // así que un solo mail pediría reescribir la plantilla y generar un .ics multi-evento.
    // Van **secuenciales** y no en paralelo, siguiendo el precedente de la cancelación en
    // masa: del otro lado hay un rate limit.
    void notificarNuevosTurnos(creados)
    void (async () => {
      for (const turno of creados) await enviarConfirmacionDeTurno(turno)
    })()
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

/**
 * HU-31 + HU-08 — El bloque que carga Ariel desde el panel.
 *
 * Ruta aparte de la pública por el mismo motivo que `postTurnoManual` lo es de `postTurno`:
 * **es la ruta, y no un flag del body, la que dice quién está creando el turno**. Si el
 * `origen` viniera del cliente, cualquiera podría mandarlo y saltearse los dos topes.
 */
export async function postTurnosEnGrupoManual(req: Request, res: Response) {
  const parsed = grupoManualSchema.safeParse(req.body)
  if (!parsed.success) {
    respondErrorParametrosInvalidos(
      res,
      parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  const { clienteTelefono, clienteEmail, fecha, hora, turnos, origen } =
    parsed.data

  // HU-08 — Igual que en `postTurnoManual`: se valida acá para poder explicarlo. El service
  // lo vuelve a chequear, pero desde adentro solo sabe tirar `HorarioNoDisponibleError`, y
  // "ese horario se acaba de ocupar" sería mentira.
  if (!fechaCargableComoAdmin(fechaDesdeIso(fecha), ahoraArgentina())) {
    respondErrorParametrosInvalidos(
      res,
      `No se pueden cargar turnos de más de ${DIAS_PASADOS_ADMIN} días atrás.`,
    )
    return
  }

  try {
    const creados = await crearTurnosEnGrupo({
      clienteTelefono,
      clienteEmail,
      fecha: fechaDesdeIso(fecha),
      hora,
      turnos,
      origen,
    })
    res.status(201).json(creados.map(turnoAdminDto))

    // Sin push: no tiene sentido avisarle a Ariel de turnos que acaba de tipear él. El mail
    // sí va, uno por turno y secuencial, si el cliente le dictó su dirección — merece su
    // link igual que si hubiera reservado por la web.
    void (async () => {
      for (const turno of creados) await enviarConfirmacionDeTurno(turno)
    })()
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

  // HU-08 — La ventana hacia atrás se valida acá para poder explicarla. `crearTurno` la
  // vuelve a chequear, pero desde adentro solo puede tirar `HorarioNoDisponibleError`, que
  // responde 409 "Ese horario se acaba de ocupar" — y eso sería mentira. Mismo reparto que
  // `esCobrable`: el schema/controller rechaza con 400, el service se niega igual.
  if (!fechaCargableComoAdmin(fechaDesdeIso(fecha), ahoraArgentina())) {
    respondErrorParametrosInvalidos(
      res,
      `No se pueden cargar turnos de más de ${DIAS_PASADOS_ADMIN} días atrás.`,
    )
    return
  }

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

    // Dos destinatarios distintos: al cliente el comprobante de que la baja entró, y a
    // Ariel el aviso de que se le liberó ese horario. Sin lo segundo, una cancelación
    // hecha desde el link solo se ve mirando la agenda.
    void enviarAvisoDeCancelacion(turno, 'cliente')
    void notificarTurnoCancelado(turno)
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
        mensaje: periodoDemasiadoLargo(MAX_DIAS_RANGO),
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
  const idsMasAdelante = await idsNuevosDespuesDe(hastaFecha, horizonte)

  res.json({
    turnos: turnos.map(turnoAdminDto),
    // Los ids y no solo el contador: sin ellos el panel puede avisar que hay turnos
    // nuevos más adelante pero no dejar marcarlos como vistos sin navegar hasta ahí.
    idsMasAdelante,
    nuevosMasAdelante: idsMasAdelante.length,
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

    // Acá no hay push (Ariel no se avisa a sí mismo), pero el aviso al cliente es todavía
    // más necesario que en la baja del cliente: es la única forma de que se entere de que
    // no lo esperan.
    //
    // Siempre `'negocio'`, incluso cuando el cliente le avisó por teléfono y Ariel lo está
    // dando de baja por él: el agradecimiento ya se lo dio en esa llamada, y lo que falta
    // es el comprobante escrito de que el turno no está más.
    void enviarAvisoDeCancelacion(turno, 'negocio')
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-25 — Cargarle el teléfono a un turno que se guardó sin él (HU-08), para que entre a
// las fichas. Acá el teléfono es obligatorio: el endpoint existe para completarlo, así
// que vaciarlo no es un caso de uso — para eso está no llamarlo.
// ⚠️ El segundo refine ya no es exclusivo de este endpoint (14/8/2026): lo llevan también
// `bodySchema` y `bodyManualSchema`. Antes vivía solo acá y esa asimetría era el defecto:
// un número que pasaba la regla laxa entraba en la reserva, se guardaba sin ficha porque
// `vincularCliente` no lo podía normalizar, y cuando Ariel lo quería completar a mano este
// endpoint le decía "inválido" sobre un número que el sistema ya había aceptado.
const telefonoSchema = z.object({
  clienteTelefono: z
    .string()
    .trim()
    .refine(esTelefonoValido, MENSAJE_TELEFONO_INVALIDO)
    .refine(esTelefonoUtilizable, MENSAJE_TELEFONO_INEXISTENTE),
})

export async function patchTelefonoTurno(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  const bodyParsed = telefonoSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    const turno = await cargarTelefonoDelTurno(
      idParsed.data.id,
      bodyParsed.data.clienteTelefono,
    )
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
    const turno = await marcarTurno(
      idParsed.data.id,
      bodyParsed.data.estado,
      bodyParsed.data.cobro,
    )
    res.json(turnoAdminDto(turno))
  } catch (err) {
    if (manejarErroresComunes(err, res)) return
    throw err
  }
}

// HU-27 — Cargarle o corregirle el cobro a un turno ya realizado.
export async function patchCobroTurno(req: Request, res: Response) {
  const idParsed = idSchema.safeParse(req.params)
  if (!idParsed.success) {
    respondErrorParametrosInvalidos(res, 'Id de turno inválido.')
    return
  }

  const bodyParsed = cobroSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    respondErrorParametrosInvalidos(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
    )
    return
  }

  try {
    const turno = await registrarCobro(idParsed.data.id, bodyParsed.data)
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
