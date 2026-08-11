import { describe, expect, it } from 'vitest'
import {
  construirMailConfirmacion,
  construirMensajeWhatsapp,
} from './notificaciones.service'
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
  plantillaCancelado: 'turno_cancelado',
  idioma: 'es_AR',
}

describe('construirMensajeWhatsapp', () => {
  it('manda las variables en el orden en que las espera la plantilla aprobada', () => {
    const mensaje = construirMensajeWhatsapp(
      TURNO,
      'confirmado',
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
    const mensaje = construirMensajeWhatsapp(
      TURNO,
      'confirmado',
      '5493514593325',
      CONFIG,
    )

    expect(mensaje.variableBotonUrl).toBe(TURNO.id)
    expect(mensaje.para).toBe('5493514593325')
    expect(mensaje.idioma).toBe('es_AR')
  })

  it('elige la plantilla según el tipo de aviso', () => {
    const plantillaDe = (tipo: 'confirmado' | 'reprogramado' | 'cancelado') =>
      construirMensajeWhatsapp(TURNO, tipo, '5493514593325', CONFIG).plantilla

    expect(plantillaDe('confirmado')).toBe('turno_confirmado')
    expect(plantillaDe('reprogramado')).toBe('turno_reprogramado')
    expect(plantillaDe('cancelado')).toBe('turno_cancelado')
  })

  // El botón de la plantilla de cancelación es una URL estática ("Reservar otro turno"):
  // no declara variable, y mandarle una es un 400 de Meta. Las tres plantillas comparten
  // las variables del cuerpo justamente para que esta sea la única diferencia.
  it('no manda variable de botón en la cancelación', () => {
    const mensaje = construirMensajeWhatsapp(
      TURNO,
      'cancelado',
      '5493514593325',
      CONFIG,
    )

    expect(mensaje.variableBotonUrl).toBeUndefined()
    expect(mensaje.variablesCuerpo).toHaveLength(3)
  })
})

describe('construirMailConfirmacion', () => {
  it('lleva el link de gestión cuando el turno sigue vivo', () => {
    const { html, texto } = construirMailConfirmacion(TURNO, 'confirmado')

    expect(html).toContain(`/turno/${TURNO.id}`)
    expect(texto).toContain(`/turno/${TURNO.id}`)
  })

  // Ese link abre una pantalla de un turno cancelado: ofrecer "gestionar mi turno" sobre
  // algo que ya no se gestiona es prometer una acción que no existe.
  it('no ofrece el link de gestión en la cancelación', () => {
    const { asunto, html, texto } = construirMailConfirmacion(
      TURNO,
      'cancelado',
    )

    expect(html).not.toContain(`/turno/${TURNO.id}`)
    expect(texto).not.toContain(`/turno/${TURNO.id}`)
    expect(asunto).toContain('Cancelamos tu turno')
  })
})
