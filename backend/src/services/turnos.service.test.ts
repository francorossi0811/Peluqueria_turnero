import { describe, expect, it } from 'vitest'
import {
  esCobrable,
  estaDentroDeVentanaDeCambio,
  excedeLimiteSemanal,
  fechaCargableComoAdmin,
  fechaReservablePorCliente,
} from './turnos.service'

// Turno el martes 4 de agosto de 2026 a las 15:00.
const TURNO = {
  fecha: new Date(Date.UTC(2026, 7, 4)),
  horaInicio: new Date(Date.UTC(1970, 0, 1, 15, 0)),
}

describe('estaDentroDeVentanaDeCambio', () => {
  it('permite cambiar si faltan más de 60 minutos', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 13, 0)) // faltan 120 min
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(true)
  })

  it('permite cambiar si faltan exactamente 60 minutos', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 14, 0)) // faltan 60 min justos
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(true)
  })

  it('no permite cambiar si falta un minuto menos de la ventana', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 14, 1)) // faltan 59 min
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(false)
  })

  it('no permite cambiar un turno que ya pasó', () => {
    const ahora = new Date(Date.UTC(2026, 7, 4, 16, 0)) // el turno era a las 15:00
    expect(estaDentroDeVentanaDeCambio(TURNO, ahora)).toBe(false)
  })
})

// HU-27 — A qué turno se le puede registrar un cobro.
describe('esCobrable', () => {
  it('deja cobrar un turno realizado', () => {
    expect(esCobrable('realizado')).toBe(true)
  })

  it('no deja cobrar un ausente: el que no vino no pagó', () => {
    // Es la regla que evita que entren al total pesos que nunca existieron. La usan el
    // schema del request y los dos caminos del service, así que fijarla acá las cubre.
    expect(esCobrable('ausente')).toBe(false)
  })

  it('no deja cobrar lo que nunca llegó a ocurrir', () => {
    expect(esCobrable('reservado')).toBe(false)
    expect(esCobrable('cancelado')).toBe(false)
    expect(esCobrable('reprogramado')).toBe(false)
  })
})

// HU-08 — Hasta dónde para atrás puede Ariel registrar un turno que ya atendió. Los dos
// bordes van juntos por el mismo motivo que en el test del cierre: fijar solo el de
// adentro deja lugar a que el de afuera se corra un día sin que nada avise.
describe('fechaCargableComoAdmin', () => {
  // Martes 4 de agosto de 2026 a las 15:30. La hora del día importa: si "ahora" fuera
  // medianoche, un borde mal calculado pasaría de casualidad.
  const AHORA = new Date(Date.UTC(2026, 7, 4, 15, 30))
  const dia = (n: number) => new Date(Date.UTC(2026, 7, n))

  it('deja cargar hoy, aunque la hora ya haya pasado', () => {
    expect(fechaCargableComoAdmin(dia(4), AHORA)).toBe(true)
  })

  it('deja cargar el día más viejo de la ventana', () => {
    expect(fechaCargableComoAdmin(dia(4 - 7), AHORA)).toBe(true)
  })

  it('no deja cargar el día anterior a la ventana', () => {
    expect(fechaCargableComoAdmin(dia(4 - 8), AHORA)).toBe(false)
  })

  it('hacia adelante no hay límite: Ariel ya reserva a meses vista', () => {
    expect(fechaCargableComoAdmin(dia(30), AHORA)).toBe(true)
  })
})

// HU-28 — Hasta dónde para adelante puede reservar un cliente por la web. Los dos bordes
// van juntos, igual que arriba y por el mismo motivo.
describe('fechaReservablePorCliente', () => {
  // Martes 4 de agosto de 2026 a las 15:30, la misma que el test de al lado.
  const AHORA = new Date(Date.UTC(2026, 7, 4, 15, 30))
  const enDias = (n: number) =>
    new Date(Date.UTC(2026, 7, 4) + n * 24 * 60 * 60_000)

  it('deja reservar hoy', () => {
    expect(fechaReservablePorCliente(enDias(0), AHORA)).toBe(true)
  })

  it('deja reservar el último día del horizonte', () => {
    expect(fechaReservablePorCliente(enDias(90), AHORA)).toBe(true)
  })

  it('no deja reservar el día siguiente al horizonte', () => {
    expect(fechaReservablePorCliente(enDias(91), AHORA)).toBe(false)
  })

  // El espejo que importa: los dos topes son de personas distintas. Si alguien alguna vez
  // le cablea el horizonte del cliente a la carga manual, este test se cae.
  it('Ariel no tiene este tope: lo que al cliente le queda lejos, él lo carga igual', () => {
    expect(fechaReservablePorCliente(enDias(120), AHORA)).toBe(false)
    expect(fechaCargableComoAdmin(enDias(120), AHORA)).toBe(true)
  })
})

// HU-28 — El tope de turnos por persona. La "semana" es una ventana móvil de 7 días, así
// que los casos que importan son los bordes: el turno que todavía cae adentro y el que se
// escapó por un día. Van de a pares, como el resto de los bordes del proyecto.
describe('excedeLimiteSemanal', () => {
  const dia = (n: number) => new Date(Date.UTC(2026, 7, n))
  // El que se quiere reservar: lunes 10 de agosto de 2026.
  const NUEVA = dia(10)

  it('deja reservar cuando la persona no tiene ninguno cerca', () => {
    expect(excedeLimiteSemanal([], NUEVA)).toBe(false)
  })

  it('deja llegar hasta el tope: con 2 agendados, el tercero entra', () => {
    expect(excedeLimiteSemanal([dia(8), dia(9)], NUEVA)).toBe(false)
  })

  it('corta el cuarto de la misma semana', () => {
    expect(excedeLimiteSemanal([dia(8), dia(9), dia(11)], NUEVA)).toBe(true)
  })

  it('cuenta el turno de 6 días antes, que todavía comparte ventana', () => {
    expect(excedeLimiteSemanal([dia(4), dia(5), dia(6)], NUEVA)).toBe(true)
  })

  it('no cuenta el de 7 días antes: ya salió de la ventana', () => {
    // El único que cambia respecto del test de arriba es el primero (día 3 en vez del 4).
    expect(excedeLimiteSemanal([dia(3), dia(4), dia(5)], NUEVA)).toBe(false)
  })

  it('cuenta el turno de 6 días después, que también comparte ventana', () => {
    expect(excedeLimiteSemanal([dia(11), dia(12), dia(16)], NUEVA)).toBe(true)
  })

  it('no cuenta el de 7 días después', () => {
    expect(excedeLimiteSemanal([dia(11), dia(12), dia(17)], NUEVA)).toBe(false)
  })

  // Esto es lo que la ventana móvil compra sobre la semana del calendario: 3 turnos de
  // viernes a domingo y 3 más de lunes a martes son 6 en cinco días, y con lunes-a-domingo
  // los seis serían legales.
  it('corta el racimo que quedaría a caballo de dos semanas del calendario', () => {
    // Viernes 7, sábado 8, domingo 9 ya agendados; el nuevo es el lunes 10.
    expect(excedeLimiteSemanal([dia(7), dia(8), dia(9)], NUEVA)).toBe(true)
  })
})
