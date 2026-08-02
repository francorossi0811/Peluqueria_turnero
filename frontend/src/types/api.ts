// Tipos que espejan los contratos de Docs/especificacion-api.md

export interface Servicio {
  id: string
  nombre: string
  duracionMinutos: number
}

export type EstadoTurno =
  'reservado' | 'cancelado' | 'reprogramado' | 'realizado' | 'ausente'

export interface Turno {
  id: string
  estado: EstadoTurno
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  servicio: Servicio
  // Solo viene en GET /api/turnos/:id, no en la respuesta de creación.
  puedeCancelar?: boolean
}

export interface DisponibilidadDia {
  fecha: string // "YYYY-MM-DD"
  horarios: string[] // "HH:mm"
}

export interface NuevoTurno {
  servicioId: string
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  clienteNombre: string
  clienteTelefono: string
}

export interface Reprogramacion {
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
}

export type OrigenTurno = 'online' | 'telefono' | 'whatsapp'

// Vista de admin: además de lo público, incluye datos de contacto y origen.
export interface TurnoAdmin extends Turno {
  horaFin: string // "HH:mm"
  clienteNombre: string
  clienteTelefono: string
  origen: OrigenTurno
}

export interface NuevoTurnoManual extends NuevoTurno {
  origen: 'telefono' | 'whatsapp'
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

export interface ErrorApi {
  error: { codigo: string; mensaje: string }
}
