import { describe, expect, it } from 'vitest'
import {
  esCobrable,
  estaDentroDeVentanaDeCambio,
  excedeLimiteSemanal,
  horariosDelBloque,
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
//
// ⚠️ El tope es **6** desde el 23/8/2026 (era 3). Los casos de abajo están poblados para ese
// número: lo que fijan no es el 6 sino dónde corta la ventana, y por eso cada par cambia una
// sola fecha entre el caso que da `true` y el que da `false`.
describe('excedeLimiteSemanal', () => {
  const dia = (n: number) => new Date(Date.UTC(2026, 7, n))
  // El que se quiere reservar: lunes 10 de agosto de 2026.
  const NUEVA = [dia(10)]

  it('deja reservar cuando la persona no tiene ninguno cerca', () => {
    expect(excedeLimiteSemanal([], NUEVA)).toBe(false)
  })

  it('deja llegar hasta el tope: con 5 agendados, el sexto entra', () => {
    expect(
      excedeLimiteSemanal([dia(6), dia(7), dia(8), dia(9), dia(11)], NUEVA),
    ).toBe(false)
  })

  it('corta el séptimo de la misma semana', () => {
    expect(
      excedeLimiteSemanal(
        [dia(6), dia(7), dia(8), dia(9), dia(11), dia(12)],
        NUEVA,
      ),
    ).toBe(true)
  })

  it('cuenta el turno de 6 días antes, que todavía comparte ventana', () => {
    expect(
      excedeLimiteSemanal(
        [dia(4), dia(5), dia(6), dia(7), dia(8), dia(9)],
        NUEVA,
      ),
    ).toBe(true)
  })

  it('no cuenta el de 7 días antes: ya salió de la ventana', () => {
    // El único que cambia respecto del test de arriba es el primero (día 3 en vez del 4).
    expect(
      excedeLimiteSemanal(
        [dia(3), dia(5), dia(6), dia(7), dia(8), dia(9)],
        NUEVA,
      ),
    ).toBe(false)
  })

  it('cuenta el turno de 6 días después, que también comparte ventana', () => {
    expect(
      excedeLimiteSemanal(
        [dia(11), dia(12), dia(13), dia(14), dia(15), dia(16)],
        NUEVA,
      ),
    ).toBe(true)
  })

  it('no cuenta el de 7 días después', () => {
    // Igual que el de arriba salvo el último: el día 17 ya no comparte ventana con el 10.
    expect(
      excedeLimiteSemanal(
        [dia(11), dia(12), dia(13), dia(14), dia(15), dia(17)],
        NUEVA,
      ),
    ).toBe(false)
  })

  // Esto es lo que la ventana móvil compra sobre la semana del calendario: con lunes-a-domingo
  // estos siete turnos serían legales (3 en una semana, 4 en la otra) aunque caen todos en
  // siete días corridos.
  it('corta el racimo que quedaría a caballo de dos semanas del calendario', () => {
    // Viernes 7, sábado 8, domingo 9 más lunes 11, martes 12, miércoles 13; el nuevo es el
    // lunes 10, justo en el medio.
    expect(
      excedeLimiteSemanal(
        [dia(7), dia(8), dia(9), dia(11), dia(12), dia(13)],
        NUEVA,
      ),
    ).toBe(true)
  })

  // HU-31 — El grupo. Lo que cambia respecto de reservar de a uno es que ahora entran varias
  // fechas de una, así que el conteo tiene que verlas **entre sí** y no solo contra lo ya
  // agendado.
  describe('reservando en grupo', () => {
    const GRUPO = [dia(10), dia(10), dia(10)]

    it('deja a la mamá con los tres hijos el mismo día', () => {
      expect(excedeLimiteSemanal([], GRUPO)).toBe(false)
    })

    it('llega justo al tope: 3 agendados más los 3 del grupo son 6', () => {
      expect(excedeLimiteSemanal([dia(8), dia(9), dia(11)], GRUPO)).toBe(false)
    })

    it('corta cuando el grupo pasa el tope: 4 agendados más 3 son 7', () => {
      expect(
        excedeLimiteSemanal([dia(8), dia(9), dia(11), dia(12)], GRUPO),
      ).toBe(true)
    })

    it('cuenta los agendados de 6 días antes, que comparten ventana con el grupo', () => {
      expect(
        excedeLimiteSemanal([dia(4), dia(4), dia(5), dia(6)], GRUPO),
      ).toBe(true)
    })

    it('no cuenta los de 7 días antes: el espejo del borde', () => {
      // Los mismos cuatro, corridos un día: el 3 ya salió de toda ventana que toque al 10.
      expect(
        excedeLimiteSemanal([dia(3), dia(3), dia(3), dia(3)], GRUPO),
      ).toBe(false)
    })

    // ⚠️ El que importa: si el bucle se anclara solo en `nuevas[0]` (el día 10), no miraría
    // nunca la ventana del día 30 y este caso pasaría como válido.
    it('se ancla en CADA fecha nueva, no solo en la primera', () => {
      const repartido = [dia(10), dia(30)]
      const cercaDelSegundo = [dia(26), dia(27), dia(28), dia(29), dia(31), dia(31)]
      expect(excedeLimiteSemanal(cercaDelSegundo, repartido)).toBe(true)
    })

    // ⚠️ Fija que las nuevas se cuentan **dentro de la ventana** y no como un `+1` fijo. Con
    // el `+1` viejo esto daría 0 + 1 = 1 y pasaría, aunque son siete turnos el mismo día.
    it('cuenta las nuevas entre sí, aunque no haya nada agendado', () => {
      const siete = Array.from({ length: 7 }, () => dia(10))
      expect(excedeLimiteSemanal([], siete)).toBe(true)
    })
  })
})

// HU-31 — El bloque: los turnos van pegados uno atrás del otro y el backend deriva la hora
// de cada uno. Esto reemplazó al chequeo de solapamiento interno que había antes — con una
// sola hora de arranque, un bloque superpuesto dejó de ser representable.
describe('horariosDelBloque', () => {
  it('con un solo turno devuelve la hora que le dieron', () => {
    expect(horariosDelBloque('10:00', [20])).toEqual(['10:00'])
  })

  it('encadena las duraciones, cada uno arranca cuando termina el anterior', () => {
    expect(horariosDelBloque('10:00', [20, 20, 20])).toEqual([
      '10:00',
      '10:20',
      '10:40',
    ])
  })

  // ⚠️ El que importa: cada turno aporta **su** duración. Con una fija (los 20 de la grilla)
  // este caso daría 10:20 para el segundo, y el bloque quedaría con un hueco de 5 minutos.
  it('usa la duración de cada servicio y no una fija', () => {
    // Barba 15 + Corte 20 + Corte + Barba 30.
    expect(horariosDelBloque('10:00', [15, 20, 30])).toEqual([
      '10:00',
      '10:15',
      '10:35',
    ])
  })

  // Es justo lo que la versión vieja no conseguía: el segundo turno caía en 10:20 porque la
  // disponibilidad solo ofrecía múltiplos de la grilla.
  it('arranca el siguiente en un horario fuera de la grilla de 20 si corresponde', () => {
    expect(horariosDelBloque('10:00', [15, 15])).toEqual(['10:00', '10:15'])
  })

  it('cruza la hora sin romperse', () => {
    expect(horariosDelBloque('10:50', [20, 30])).toEqual(['10:50', '11:10'])
  })
})
