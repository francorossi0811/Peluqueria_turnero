// Fechas y horas que entran por la API, y **cómo se le explica a Ariel cuando están mal**.
//
// Existe por dos motivos, y el segundo es el que importa de verdad:
//
// 1. Los mismos tres schemas estaban copiados en `turnos`, `bloqueos` y `horarioLaboral`,
//    palabra por palabra. Tres copias es tres lugares donde arreglar el mismo defecto.
// 2. ⚠️ **Los mensajes los lee Ariel, no un programador.** Decían "Formato de hora inválido,
//    esperado HH:mm." y "Invalid ISO date" (ese último ni siquiera en castellano: salía tal
//    cual de zod). Ariel no sabe qué es `HH:mm` ni qué es ISO, y un cartel que no se entiende
//    es igual de inútil que no mostrar nada — peor, porque parece que la app se rompió.
//
// La regla de redacción: **decir qué campo está mal y qué hacer**, en las mismas palabras que
// usa la pantalla. Nada de nombres de campos de la API (`fechaFin`, `hasta`) ni de formatos.

import { z } from 'zod'

/** ⚠️ La hora se valida **con rango real**, no solo con la forma.
 *
 * La regex vieja era `^\d{2}:\d{2}$` y con eso `25:00` pasaba como válida. No quedaba en un
 * error raro más adelante: `horaDesdeString` la interpreta como `Date.UTC(..., 25, 0)`, que
 * **desborda al día siguiente**, y el turno se guardaba a la `01:00`. Lo mismo `07:75`, que
 * terminaba siendo `08:15`. O sea que la validación aceptaba una hora y el sistema guardaba
 * otra, en silencio y sin que nadie pudiera darse cuenta mirando la pantalla.
 *
 * Verificado con `horaDesdeString` antes de escribir esto, no deducido. */
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Una fecha `"YYYY-MM-DD"` que entra por la API.
 *
 * `queEs` se escribe como aparece en la pantalla y **empezando en minúscula**, porque va
 * dentro de la oración: `esquemaDeFecha('la fecha de inicio')`.
 *
 * Un solo mensaje cubre el campo que falta y el que vino mal escrito: zod los reporta como
 * dos códigos distintos (`invalid_type` e `invalid_format`) pero para Ariel son el mismo
 * problema —algo anda mal con esa fecha— y la acción que tiene que hacer es la misma.
 */
export function esquemaDeFecha(queEs: string) {
  return z.iso.date({
    error: `Revisá ${queEs}: elegila con el calendario.`,
  })
}

/**
 * Una hora `"HH:mm"` de 24 horas.
 *
 * El mensaje nombra el rango en vez del formato: "entre 00:00 y 23:59" se entiende sin saber
 * qué quiere decir `HH:mm`, y de paso explica el caso que antes pasaba de largo.
 */
export function esquemaDeHora(queEs: string) {
  return z
    .string({ error: `Revisá ${queEs}.` })
    .regex(FORMATO_HORA, `Revisá ${queEs}: tiene que estar entre 00:00 y 23:59.`)
}

/** El mensaje de "la fecha de fin quedó antes que la de inicio", que se repite en cuatro
 * pantallas. Va como texto y no como schema porque cada uno lo usa en su propio `refine`
 * con su propio `path`. */
export const FIN_ANTES_QUE_INICIO =
  'La fecha de fin no puede ser anterior a la de inicio.'

/** Lo mismo para las horas dentro de un mismo día. */
export const HORA_FIN_ANTES_QUE_INICIO =
  'La hora de fin tiene que ser posterior a la de inicio.'

/** El tope de días de un período. Se arma con el número para que el texto no se despegue de
 * la constante si alguien la cambia. */
export function periodoDemasiadoLargo(maxDias: number): string {
  return `El período es muy largo: podés pedir hasta ${maxDias} días de una vez.`
}
