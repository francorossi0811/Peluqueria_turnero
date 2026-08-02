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

export interface ErrorApi {
  error: { codigo: string; mensaje: string }
}
