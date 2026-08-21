// Tipos que espejan los contratos de Docs/especificacion-api.md

// El servicio que ve el **cliente**.
//
// ⚠️ Desde el 14/8/2026 incluye `precio`, y eso **enmienda a HU-27**, que decía que el
// precio era interno y el cliente no lo veía nunca. Franco lo cambió: quiere que sepa
// cuánto sale antes de reservar. Lo que sigue siendo interno es el cobro (`medioPago`,
// `montoCobrado`), que vive en el turno y solo va en el DTO de admin.
export interface Servicio {
  id: string
  nombre: string
  duracionMinutos: number
  /** Pesos enteros. `null` = todavía no le puso precio, que no es lo mismo que `0` — por
   * eso se dibuja con `formatearPesosOpcional` y no con `formatearPesos`. */
  precio: number | null
  /** La foto de la landing. Viene de la base y **no** de un mapa por nombre en el
   * frontend: el nombre lo edita Ariel y renombrar un servicio le borraba la foto en
   * silencio. `null` = cae a una foto de stock. */
  foto: string | null
}

// Vista de admin: incluye además los inactivos y el propio estado.
export interface ServicioAdmin extends Servicio {
  activo: boolean
}

export interface DatosServicio {
  nombre: string
  duracionMinutos: number
  /** `null` es cómo se le saca el precio a un servicio que ya tenía uno. */
  precio?: number | null
}

export type EstadoTurno =
  'reservado' | 'cancelado' | 'reprogramado' | 'realizado' | 'ausente'

export interface Turno {
  id: string
  estado: EstadoTurno
  /** El nombre con el que reservó. Lo firman los mensajes de WhatsApp que arma el cliente
   * ("Hola Ariel, soy ___"), y la pantalla de gestión es el único lugar donde ese nombre
   * no se tipeó en esta sesión. El teléfono y el mail siguen siendo solo de admin. */
  clienteNombre: string
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  servicio: Servicio
  // Solo viene en GET /api/turnos/:id, no en la respuesta de creación.
  puedeCancelar?: boolean
}

/** Por qué un día no tiene horarios. Permite explicarle al cliente qué pasó en vez de
 * mostrarle siempre el mismo "no hay turnos". */
export type EstadoDia =
  'disponible' | 'cerrado' | 'feriado' | 'bloqueado' | 'completo'

export interface DisponibilidadDia {
  fecha: string // "YYYY-MM-DD"
  horarios: string[] // "HH:mm"
  estado: EstadoDia
  /** Motivo del bloqueo o nombre del feriado, cuando corresponde. */
  motivo: string | null
}

export interface NuevoTurno {
  servicioId: string
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  clienteNombre: string
  clienteTelefono: string
  clienteEmail?: string // HU-19: opcional
}

export interface Reprogramacion {
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
}

// `presencial` es el cliente de vidriera que Ariel atiende y registra después (HU-08):
// no llamó ni escribió. `llamada` se llamaba `telefono` y se renombró porque se confundía
// con `clienteTelefono`, que es un dato de contacto y no un canal de reserva.
export type OrigenTurno = 'online' | 'presencial' | 'llamada' | 'whatsapp'

/** Los orígenes que Ariel puede elegir al cargar un turno a mano: todos menos `online`,
 * que es el que se pone solo cuando reserva un cliente por la web. */
export type OrigenManual = Exclude<OrigenTurno, 'online'>

/** HU-25 — Una insignia: un círculo de color con el nombre que le puso Ariel. */
export interface Etiqueta {
  id: string
  nombre: string
  color: string // "#rrggbb"
  /** Identidad estable de las etiquetas que pone el sistema solo (`cliente_nuevo`), aparte
   * del nombre — así renombrarla no rompe el automatismo. `null` en las de Ariel. */
  clave?: string | null
}

/** HU-25 — La ficha, tal como viaja dentro de un turno. Lo justo para dibujar el apodo y
 * las insignias sin tener que pedir nada más. */
export interface ClienteDeTurno {
  id: string
  telefono: string
  apodo: string | null
  nombre: string
  notas: string | null
  etiquetas: Etiqueta[]
}

// Vista de admin: además de lo público, incluye datos de contacto y origen.
export interface TurnoAdmin extends Turno {
  horaFin: string // "HH:mm"
  clienteNombre: string
  clienteTelefono: string | null // HU-08: los que carga Ariel a mano pueden no tenerlo
  clienteEmail: string | null // HU-19
  origen: OrigenTurno
  vistoPorAdmin: boolean // HU-17
  /** HU-25 — `null` cuando el turno no tiene teléfono: sin número no hay identidad, y por
   * lo tanto no hay ficha. Se completa solo en cuanto Ariel le carga el número. */
  cliente: ClienteDeTurno | null
  /** HU-27 — Los tres van juntos: `null` en los tres es "todavía no se registró el
   * cobro", que es un estado legítimo y no un error. */
  medioPago: MedioPago | null
  montoCobrado: number | null
  cobradoEn: string | null // ISO
}

/** HU-27 — Cómo pagó. Conjunto cerrado: es un enum en la base, no una tabla que Ariel
 * configure (al revés que las etiquetas de HU-25). */
export type MedioPago =
  'efectivo' | 'transferencia' | 'mercado_pago' | 'tarjeta'

export interface DatosCobro {
  medioPago: MedioPago
  /** Pesos enteros. */
  montoCobrado: number
}

/** HU-27 — Un turno realizado, visto desde la sección Cobros. Más chico que `TurnoAdmin`:
 * acá lo que importa es la plata, no el contacto.
 *
 * Lleva `estado` y el `servicio` completo porque desde esta lista se abre el mismo modal
 * de cobro que en la agenda, y ese modal necesita el id del servicio para leer el precio
 * de hoy. Cumple `TurnoACobrar`. */
export interface TurnoCobrado {
  id: string
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  estado: EstadoTurno
  clienteNombre: string
  cliente: ClienteDeTurno | null
  /** El **nombre** es el snapshot de cuando se reservó; el **id** apunta al servicio de
   * hoy, que es de donde sale el precio (HU-27). */
  servicio: Servicio
  /** `null` = todavía no se registró el cobro. */
  medioPago: MedioPago | null
  montoCobrado: number | null
}

export interface TotalPorMedio {
  medioPago: MedioPago
  total: number
  turnos: number
}

export interface ResumenCobros {
  total: number
  porMedio: TotalPorMedio[]
  /** Turnos realizados en el período sin cobro registrado: lo que le falta al total. */
  sinRegistrar: number
  turnos: TurnoCobrado[]
}

/** HU-25 — Un cliente en el listado de la sección Clientes. */
export interface ClienteResumen extends ClienteDeTurno {
  /** Turnos que llegó a hacerse; los cancelados y reprogramados no cuentan. */
  visitas: number
  ultimaVisita: string | null // "YYYY-MM-DD"
  proximoTurno: string | null // "YYYY-MM-DD"
}

/** Un turno dentro del historial de la ficha. Más chico que `TurnoAdmin`: acá ya se sabe
 * de quién es, así que repetir nombre y teléfono en cada fila sería ruido. */
export interface TurnoDeHistorial {
  id: string
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  estado: EstadoTurno
  origen: OrigenTurno
  servicio: Servicio
}

export interface ClienteFicha extends ClienteDeTurno {
  turnos: TurnoDeHistorial[]
}

export interface DatosCliente {
  apodo?: string | null
  notas?: string | null
  /** La lista completa, no un delta: se reemplaza tal cual llega. */
  etiquetaIds?: string[]
}

// HU-08 — El teléfono deja de heredarse obligatorio: Ariel carga turnos con el cliente
// enfrente y no se sabe los números de memoria. Para el que reserva por la web
// (`NuevoTurno`) sigue siendo obligatorio, que es donde de verdad hace falta.
export interface NuevoTurnoManual extends Omit<NuevoTurno, 'clienteTelefono'> {
  clienteTelefono?: string
  origen: OrigenManual
}

export interface EditarTurno {
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
}

export interface Bloqueo {
  id: string
  fechaInicio: string // "YYYY-MM-DD"
  horaInicio: string | null // "HH:mm", null = todo el día
  fechaFin: string // "YYYY-MM-DD"
  horaFin: string | null
  motivo: string | null
}

export interface NuevoBloqueo {
  fechaInicio: string
  horaInicio?: string
  fechaFin: string
  horaFin?: string
  motivo?: string
  confirmarCancelaciones?: boolean
}

export interface TurnoAfectado {
  id: string
  fecha: string
  hora: string
  clienteNombre: string
}

export interface ErrorBloqueoAfectaTurnos {
  error: { codigo: 'BLOQUEO_AFECTA_TURNOS'; mensaje: string }
  turnosAfectados: TurnoAfectado[]
}

export interface FranjaHorario {
  diaSemana: number // 0 (domingo) a 6 (sábado)
  horaInicio: string // "HH:mm"
  horaFin: string // "HH:mm"
}

/** Qué hace Ariel en un feriado (HU-24). `medio_dia` es el default: atiende solo la
 * primera franja del día. No es un booleano porque la regla tiene tres estados. */
export type ModalidadFeriado = 'cerrado' | 'medio_dia' | 'dia_completo'

export interface Feriado {
  id: number
  fecha: string // "YYYY-MM-DD"
  nombre: string
  modalidad: ModalidadFeriado
}

export interface ErrorApi {
  error: { codigo: string; mensaje: string }
}

/** HU-26 — Qué puede hacer una cuenta. La única diferencia real es administrar cuentas:
 * todo lo demás del panel es "gestionar la peluquería" y el `admin` lo puede entero. */
export type RolAdmin = 'super_admin' | 'admin'

/** Cuenta del admin logueado (HU-15, HU-26) — `GET /api/admin/me`. */
export interface Me {
  usuario: string
  /** Con lo que entra al panel desde HU-26. `usuario` pasó a ser solo el nombre visible. */
  email: string | null
  rol: RolAdmin
}

/** HU-26 — Una cuenta en la sección Administradores. */
export interface AdministradorResumen {
  id: string
  usuario: string
  email: string | null
  rol: RolAdmin
  creadaEn: string
  passwordCambiadaEn: string | null
}
