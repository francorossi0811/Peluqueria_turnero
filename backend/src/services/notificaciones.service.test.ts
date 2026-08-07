import { describe, expect, it } from 'vitest'
import { construirMensajeWhatsappConfirmacion } from './notificaciones.service'
import type { Turno } from '../../generated/prisma/client.ts'

// Turno el martes 4 de agosto de 2026 a las 15:00, mismo molde que turnos.service.test.ts.
// Solo hacen falta los campos que usa el armador; el resto no lo mira.
const TURNO = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  clienteNombre: 'Juan Pérez',
  servicioNombreSnapshot: 'Corte de pelo',
  fecha: new Date(Date.UTC(2026, 7, 4)),
  horaInicio: new Date(Date.UTC(1970, 0, 1, 15, 0)),
} as Turno

const CONFIG = {
  plantillaConfirmado: 'turno_confirmado',
  plantillaReprogramado: 'turno_reprogramado',
  idioma: 'es_AR',
}

describe('construirMensajeWhatsappConfirmacion', () => {
  it('manda las variables en el orden en que las espera la plantilla aprobada', () => {
    const mensaje = construirMensajeWhatsappConfirmacion(
      TURNO,
      false,
      '5493514593325',
      CONFIG,
    )

    // Este orden es un contrato con la plantilla que aprobó Meta: {{1}} nombre,
    // {{2}} servicio, {{3}} cuándo. Si se desordena, el mensaje sale mezclado y no hay
    // nada del lado nuestro que lo delate — de ahí este test.
    expect(mensaje.variablesCuerpo).toEqual([
      'Juan Pérez',
      'Corte de pelo',
      'martes, 4 de agosto a las 15:00',
    ])
  })

  it('manda solo el id en el botón, porque la base de la URL vive en la plantilla', () => {
    const mensaje = construirMensajeWhatsappConfirmacion(
      TURNO,
      false,
      '5493514593325',
      CONFIG,
    )

    expect(mensaje.variableBotonUrl).toBe(TURNO.id)
    expect(mensaje.para).toBe('5493514593325')
    expect(mensaje.idioma).toBe('es_AR')
  })

  it('usa la plantilla de reprogramado cuando corresponde', () => {
    const nuevo = construirMensajeWhatsappConfirmacion(
      TURNO,
      false,
      '5493514593325',
      CONFIG,
    )
    const reprogramado = construirMensajeWhatsappConfirmacion(
      TURNO,
      true,
      '5493514593325',
      CONFIG,
    )

    expect(nuevo.plantilla).toBe('turno_confirmado')
    expect(reprogramado.plantilla).toBe('turno_reprogramado')
  })
})
