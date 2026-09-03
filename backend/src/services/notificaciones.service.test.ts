import { describe, expect, it } from 'vitest'
import {
  construirMailConfirmacion,
  construirMensajeWhatsapp,
  construirNotificacionTurnoNuevo,
  construirNotificacionTurnosNuevos,
} from './notificaciones.service'
import type { TipoAviso } from './notificaciones.service'
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
  plantillaCanceladoCliente: 'turno_cancelado_cliente',
  plantillaCanceladoNegocio: 'turno_cancelado_negocio',
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
    const plantillaDe = (tipo: TipoAviso) =>
      construirMensajeWhatsapp(TURNO, tipo, '5493514593325', CONFIG).plantilla

    expect(plantillaDe('confirmado')).toBe('turno_confirmado')
    expect(plantillaDe('reprogramado')).toBe('turno_reprogramado')
    expect(plantillaDe('cancelado_cliente')).toBe('turno_cancelado_cliente')
    expect(plantillaDe('cancelado_negocio')).toBe('turno_cancelado_negocio')
  })

  // ⚠️ Las dos cancelaciones son plantillas **distintas** aprobadas por separado. Si las
  // dos apuntaran a la misma, el cliente al que Ariel le canceló recibiría "gracias por
  // avisar" — el defecto exacto que motivó partir el tipo en cuatro.
  it('no manda la misma plantilla en las dos cancelaciones', () => {
    const cliente = construirMensajeWhatsapp(
      TURNO,
      'cancelado_cliente',
      '5493514593325',
      CONFIG,
    )
    const negocio = construirMensajeWhatsapp(
      TURNO,
      'cancelado_negocio',
      '5493514593325',
      CONFIG,
    )

    expect(cliente.plantilla).not.toBe(negocio.plantilla)
    // Lo que sí comparten: las tres variables, para que el armador no ramifique.
    expect(cliente.variablesCuerpo).toEqual(negocio.variablesCuerpo)
  })

  // El botón de la plantilla de cancelación es una URL estática ("Reservar otro turno"):
  // no declara variable, y mandarle una es un 400 de Meta. Las tres plantillas comparten
  // las variables del cuerpo justamente para que esta sea la única diferencia.
  it.each(['cancelado_cliente', 'cancelado_negocio'] as const)(
    'no manda variable de botón en la cancelación (%s)',
    (tipo) => {
      const mensaje = construirMensajeWhatsapp(
        TURNO,
        tipo,
        '5493514593325',
        CONFIG,
      )

      expect(mensaje.variableBotonUrl).toBeUndefined()
      expect(mensaje.variablesCuerpo).toHaveLength(3)
    },
  )
})

describe('construirMailConfirmacion', () => {
  it('lleva el link de gestión cuando el turno sigue vivo', () => {
    const { html, texto } = construirMailConfirmacion(TURNO, 'confirmado')

    expect(html).toContain(`/turno/${TURNO.id}`)
    expect(texto).toContain(`/turno/${TURNO.id}`)
  })

  // Ese link abre una pantalla de un turno cancelado: ofrecer "gestionar mi turno" sobre
  // algo que ya no se gestiona es prometer una acción que no existe.
  it.each(['cancelado_cliente', 'cancelado_negocio'] as const)(
    'no ofrece el link de gestión en la cancelación (%s)',
    (tipo) => {
      const { html, texto } = construirMailConfirmacion(TURNO, tipo)

      expect(html).not.toContain(`/turno/${TURNO.id}`)
      expect(texto).not.toContain(`/turno/${TURNO.id}`)
    },
  )

  // El mail de respaldo tiene que decir lo mismo que la plantilla que le toca: si el
  // canal cambia el mensaje, el cliente recibe dos versiones del mismo hecho.
  it('agradece o pide disculpas según quién canceló', () => {
    const cliente = construirMailConfirmacion(TURNO, 'cancelado_cliente')
    const negocio = construirMailConfirmacion(TURNO, 'cancelado_negocio')

    expect(cliente.texto).toContain('Gracias por avisar')
    expect(cliente.texto).not.toContain('Perdón')
    expect(negocio.texto).toContain('Perdón')
    expect(negocio.texto).not.toContain('Gracias por avisar')
  })
})

// HU-31 — El push de una reserva en grupo.
describe('construirNotificacionTurnosNuevos', () => {
  const otro = (id: string, nombre: string, hora: number) =>
    ({
      ...TURNO,
      id,
      clienteNombre: nombre,
      horaInicio: new Date(Date.UTC(1970, 0, 1, hora, 0)),
    }) as Turno

  // ⚠️ El que importa: con un turno, Ariel tiene que ver **exactamente** el aviso de
  // siempre. Si alguien "mejora" el armador del grupo y se olvida de la delegación, este
  // test lo agarra.
  it('con un turno solo devuelve el aviso de siempre, idéntico', () => {
    expect(construirNotificacionTurnosNuevos([TURNO])).toEqual(
      construirNotificacionTurnoNuevo(TURNO),
    )
  })

  it('con varios manda un solo aviso que los nombra a todos', () => {
    const aviso = construirNotificacionTurnosNuevos([
      TURNO,
      otro('a1b2c3d4-0000-4000-8000-000000000001', 'Toto', 15),
      otro('a1b2c3d4-0000-4000-8000-000000000002', 'Luca', 16),
    ])

    expect(aviso.title).toBe('3 turnos nuevos reservados')
    expect(aviso.body).toContain('Juan Pérez')
    expect(aviso.body).toContain('Toto')
    expect(aviso.body).toContain('Luca')
    expect(aviso.body.split('\n')).toHaveLength(3)
  })

  // Con el mismo tag que el alta individual, este aviso reemplazaría en pantalla a una
  // reserva anterior y esa se perdería.
  it('usa un tag propio, distinto del de un turno suelto', () => {
    const grupo = construirNotificacionTurnosNuevos([
      TURNO,
      otro('a1b2c3d4-0000-4000-8000-000000000001', 'Toto', 15),
    ])
    expect(grupo.tag).not.toBe(construirNotificacionTurnoNuevo(TURNO).tag)
  })
})
