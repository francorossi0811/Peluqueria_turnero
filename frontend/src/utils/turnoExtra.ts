// HU-35 — Los turnos fuera de horario: Ariel se queda después del cierre para atender a
// uno más, solo ese día.
//
// ⚠️ Es la copia de `huecosExtraDelDia` de `backend/src/services/disponibilidad.service.ts`,
// con la nota de siempre: acá dibuja (dónde va el botón "+" y qué hora propone), allá
// manda. Si las dos se despegaran, lo peor que pasa es que el backend rechace con un 409
// que explica la regla — nunca que entre un turno que no corresponde.

import { minutosDeHora } from './fecha'
import type { Bloqueo, Feriado, FranjaHorario, TurnoAdmin } from '../types/api'

/** Hasta dónde llega el día: 23:59. Los horarios se guardan como `TIME` y un turno que
 * terminara a las 24:00 quedaría con fin `00:00`, que la base rechaza (ver el backend). */
export const FIN_DEL_DIA_MINUTOS = 24 * 60 - 1

/** Un rato después de una franja, en minutos desde la medianoche. `desde` es el cierre de
 * la franja y `hasta` el tope: el inicio de la franja siguiente, o la medianoche. */
export interface HuecoExtra {
  desde: number
  hasta: number
}

/** Los ratos fuera de horario de un día: uno después de cada franja abierta.
 *
 * El tope sale del horario **sin recortar por el feriado**: en un feriado de medio día la
 * tarde no se atiende, pero el rato de después de la mañana sigue llegando hasta la hora en
 * que abre la tarde, no hasta la medianoche. Mismo criterio que el backend. */
export function huecosExtraDelDia(
  franjasDelDia: FranjaHorario[],
  feriado: Feriado | undefined,
): HuecoExtra[] {
  const todas = franjasDelDia
    .map((f) => ({ inicio: minutosDeHora(f.horaInicio), fin: minutosDeHora(f.horaFin) }))
    .sort((a, b) => a.inicio - b.inicio)

  const abiertas =
    feriado?.modalidad === 'cerrado'
      ? []
      : feriado?.modalidad === 'medio_dia'
        ? todas.slice(0, 1)
        : todas

  return abiertas
    .map((f) => ({
      desde: f.fin,
      hasta: Math.min(
        FIN_DEL_DIA_MINUTOS,
        ...todas.filter((o) => o.inicio >= f.fin).map((o) => o.inicio),
      ),
    }))
    .filter((h) => h.hasta > h.desde)
}

/** A qué hora caería el próximo turno extra de ese rato: al final de la **cadena** de
 * turnos seguidos que arranca en el cierre, o en el cierre si todavía no hay ninguno.
 * `null` si ya no queda lugar.
 *
 * ⚠️ Es la cadena y no "después del último": con un extra de 13:00 a 13:20 y otro de 16:40
 * a 17:00, el último termina justo en el tope y el botón desaparecía, aunque de 13:20 a
 * 16:40 estaba todo libre. Visto en pantalla, no razonando. Siguiendo la cadena, el "+"
 * propone 13:20 y el hueco del medio se puede usar; para el que va más tarde, Ariel corre
 * la hora en el modal.
 *
 * Solo cuentan los turnos que ocupan el rato de verdad (`reservado` y `realizado`, la lista
 * del `EXCLUDE`): un ausente o un cancelado lo liberaron.
 *
 * Mira cualquier turno que **cubra** el momento, no solo los que arrancan después del
 * cierre: uno de la franja que se pasó del cierre (porque Ariel cambió el horario después)
 * también empuja al siguiente. */
export function proximaHoraExtra(
  hueco: HuecoExtra,
  turnosDelDia: Pick<TurnoAdmin, 'hora' | 'horaFin' | 'estado'>[],
): number | null {
  const ocupados = turnosDelDia
    .filter((t) => t.estado === 'reservado' || t.estado === 'realizado')
    .map((t) => ({ inicio: minutosDeHora(t.hora), fin: minutosDeHora(t.horaFin) }))
    .sort((a, b) => a.inicio - b.inicio)

  let desde = hueco.desde
  for (const t of ocupados) {
    if (t.inicio <= desde && t.fin > desde) desde = t.fin
  }

  return desde < hueco.hasta ? desde : null
}

/** ¿Un bloqueo tapa ese momento? Las horas en null llegan hasta los bordes del día entero,
 * igual que en el backend: unas vacaciones dicen que Ariel no está, también a la noche. */
export function bloqueoTapa(
  bloqueos: Bloqueo[],
  dia: string,
  minuto: number,
): boolean {
  return bloqueos.some((b) => {
    if (b.fechaInicio > dia || b.fechaFin < dia) return false
    const desde = b.horaInicio ? minutosDeHora(b.horaInicio) : 0
    const hasta = b.horaFin ? minutosDeHora(b.horaFin) : FIN_DEL_DIA_MINUTOS
    return minuto >= desde && minuto < hasta
  })
}

/** Lo que necesita el botón "+" de un día: a qué hora propone el turno y hasta dónde puede
 * llegar. Uno por cada franja abierta que todavía tenga lugar. */
export interface BotonExtra {
  /** El cierre de la franja: identifica de qué rato es (mañana o noche). */
  cierre: number
  hora: number
  tope: number
}

export function botonesExtraDelDia(
  dia: string,
  franjasDelDia: FranjaHorario[],
  feriado: Feriado | undefined,
  turnosDelDia: Pick<TurnoAdmin, 'hora' | 'horaFin' | 'estado'>[],
  bloqueos: Bloqueo[],
): BotonExtra[] {
  return huecosExtraDelDia(franjasDelDia, feriado).flatMap((hueco) => {
    const hora = proximaHoraExtra(hueco, turnosDelDia)
    if (hora === null || bloqueoTapa(bloqueos, dia, hora)) return []
    return [{ cierre: hueco.desde, hora, tope: hueco.hasta }]
  })
}

export function aHoraTexto(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
