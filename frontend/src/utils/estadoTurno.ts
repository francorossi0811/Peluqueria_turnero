import type { EstadoTurno } from '../types/api'

// Cómo se ve un estado de turno **en el panel**. Estaba copiado tal cual en cuatro
// archivos (`FilaTurno`, `ModalTurno`, `FichaCliente`, `ModalBuscarTurno`) más una quinta
// variante en la grilla semanal, y la copia ya había fallado una vez: `ausente` era
// ámbar-naranja en la vista Día y un neutro en la grilla, o sea el mismo estado con dos
// colores según dónde se lo mirara. Con una sola definición eso no puede volver a pasar.
//
// ⚠️ Es del panel y no del sitio: `GestionTurnoPage` (la pantalla del cliente) mantiene su
// propio mapa a propósito. Ahí manda el diseño crema del lado del cliente, que no tiene
// nada que ver con la lectura de alto contraste que necesita Ariel.

export const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  reservado: 'Reservado',
  cancelado: 'Cancelado',
  reprogramado: 'Reprogramado',
  realizado: 'Realizado',
  ausente: 'Ausente',
}

/** Los colores de alto contraste que pidió Ariel (13/8/2026): verde fuerte lo que se hizo,
 * rojo fuerte el que no vino, los dos con texto blanco encima.
 *
 * Salen de tokens que **no cambian con el tema** —los mismos que usa la grilla—, así que
 * un estado se ve igual en claro y en oscuro. Es a propósito: son los colores con los que
 * Ariel lee su día y el interruptor de "Mi cuenta" no tiene que poder tocarlos.
 *
 * `cancelado` y `reprogramado` siguen siendo neutros del tema: son estados que Ariel mira
 * de vez en cuando en el historial, no de un vistazo en la agenda. */
export const ESTILO_ESTADO: Record<EstadoTurno, string> = {
  // Amarillo fuerte, el mismo token con el que la grilla pinta un turno pendiente. En la
  // grilla el pendiente **de hoy** va blanco, pero acá no: la vista Día ya está parada en
  // un día, así que "es de hoy" no distingue nada y el blanco solo restaría contraste.
  reservado: 'bg-turno-futuro text-agenda-tinta',
  cancelado: 'bg-borde-suave text-tinta-tenue',
  reprogramado: 'bg-borde-suave text-tinta-tenue',
  realizado: 'bg-realizado text-sobre-estado',
  ausente: 'bg-ausente-fuerte text-sobre-estado',
}
