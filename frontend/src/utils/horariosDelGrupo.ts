import type { DisponibilidadDia } from '../types/api'

// HU-31 — Sacar de la grilla los horarios que el propio grupo ya se llevó.
//
// ⚠️ Existe por una razón concreta: cuando la mamá elige el turno del segundo hijo, el del
// primero **todavía no existe en la base**. `GET /api/disponibilidad` no puede saberlo, así
// que se lo sigue ofreciendo — y si lo elige, el choque recién aparece al confirmar.
//
// Es un descarte del lado del cliente, no una segunda fuente de verdad: el backend valida
// igual (`indiceDelSolapamientoInterno`). Acá lo único que se busca es que la pantalla no
// ofrezca algo que después va a rechazar.

/** Un turno ya elegido por el grupo, con la duración de **su** servicio. */
export interface HorarioTomado {
  fecha: string // "YYYY-MM-DD"
  hora: string // "HH:mm"
  duracionMinutos: number
}

/** "HH:mm" -> minutos desde medianoche.
 *
 * ⚠️ Comparar los strings directamente alcanza para `<`, pero no para sumarles una duración,
 * que es justo lo que hace falta acá. */
function aMinutos(hhmm: string): number {
  const [horas, minutos] = hhmm.split(':').map(Number)
  return horas * 60 + minutos
}

/**
 * La misma disponibilidad, sin los horarios en los que el turno que se está eligiendo se
 * pisaría con alguno que el grupo ya tomó.
 *
 * `duracionDelQueSeElige` es la del servicio del turno en curso, y cada tomado aporta la
 * suya: son distintas (Barba 15, Corte 20, Corte + Barba 30) y **ese cruce es todo el
 * problema**. Un Corte + Barba de 30 minutos a las 10:00 tiene que sacar las 10:00 **y** las
 * 10:20 de la grilla de un Corte de 20; sacar solo las 10:00 es el bug que llega hasta el
 * EXCLUDE de la base.
 *
 * Tocarse borde con borde **no** es pisarse (10:00-10:20 y 10:20-10:40 conviven): es la
 * misma semántica del EXCLUDE y de `seSolapan` en el backend, y es justamente el caso que la
 * mamá quiere — turnos seguidos.
 *
 * Con `tomados` vacío devuelve la lista **tal cual**, que es lo que mantiene idéntico el caso
 * normal de reservar un turno solo.
 */
export function descontarHorariosDelGrupo(
  dias: DisponibilidadDia[],
  tomados: HorarioTomado[],
  duracionDelQueSeElige: number,
): DisponibilidadDia[] {
  if (tomados.length === 0) return dias

  return dias.map((dia) => {
    const delDia = tomados.filter((t) => t.fecha === dia.fecha)
    if (delDia.length === 0) return dia

    const horarios = dia.horarios.filter((hora) => {
      const inicio = aMinutos(hora)
      const fin = inicio + duracionDelQueSeElige
      return !delDia.some((t) => {
        const tInicio = aMinutos(t.hora)
        return inicio < tInicio + t.duracionMinutos && tInicio < fin
      })
    })

    return { ...dia, horarios }
  })
}
