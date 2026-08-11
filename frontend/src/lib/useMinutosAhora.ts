import { useEffect, useState } from 'react'

// Los minutos transcurridos del día, actualizados solos.
//
// Existe para que la línea roja de la agenda **baje sola**, como la de Google Calendar.
// Antes la hora se calculaba en cada render y el único render periódico lo daba el refetch
// de la agenda: con la pestaña en segundo plano ese refetch baja a 3 minutos, así que la
// línea se quedaba clavada hasta que Ariel volvía a la pestaña. Justo cuando vuelve es
// cuando la mira.

/** Cada cuánto se recalcula. Un minuto: es la resolución con la que se muestra la hora, y
 * la línea se mueve medio píxel por minuto (34 px cada 20 minutos), así que actualizar más
 * seguido re-renderiza la grilla sin mover nada visible. */
const INTERVALO_MS = 60_000

function minutosDelDia(): number {
  const ahora = new Date()
  return ahora.getHours() * 60 + ahora.getMinutes()
}

export function useMinutosAhora(): number {
  const [minutos, setMinutos] = useState(minutosDelDia)

  useEffect(() => {
    // El primer tick se alinea con el cambio de minuto del reloj en vez de esperar 60
    // segundos desde que montó el componente. Si no, la línea puede ir hasta un minuto
    // atrasada respecto de la hora que muestra el margen — y las dos cosas se miran juntas.
    const msHastaElProximoMinuto = 60_000 - (Date.now() % 60_000)

    let intervalo: number | undefined
    const primero = window.setTimeout(() => {
      setMinutos(minutosDelDia())
      intervalo = window.setInterval(
        () => setMinutos(minutosDelDia()),
        INTERVALO_MS,
      )
    }, msHastaElProximoMinuto)

    return () => {
      window.clearTimeout(primero)
      if (intervalo !== undefined) window.clearInterval(intervalo)
    }
  }, [])

  return minutos
}
