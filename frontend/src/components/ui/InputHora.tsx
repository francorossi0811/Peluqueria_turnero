// Selector de hora en formato 24 h.
//
// Existe porque `<input type="time">` **no se puede forzar a 24 h**: el navegador elige
// el formato según su propio idioma, no según el `lang` del documento (que ya está en
// es-AR) ni por CSS. En el equipo de Ariel el navegador está en inglés, así que veía
// "10:00 a.m." donde el resto de la app dice "10:00", y no había forma de arreglarlo
// desde el sitio.
//
// Con dos `<select>` el formato es nuestro y es igual en todos los dispositivos. De paso,
// en el celular abre la rueda nativa, que para elegir una hora en punto es más rápido
// que tipear en el picker.

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

/** Los turnos de Ariel arrancan en horas y medias horas; el paso de 5 minutos da margen
 * para un bloqueo puntual sin convertir la lista en 60 opciones. */
const PASO_MINUTOS = 5
const MINUTOS = Array.from({ length: 60 / PASO_MINUTOS }, (_, i) =>
  String(i * PASO_MINUTOS).padStart(2, '0'),
)

interface InputHoraProps {
  /** "HH:mm" */
  value: string
  onChange: (valor: string) => void
  /** Para el lector de pantalla: se completa como "Hora de <etiqueta>". */
  etiqueta: string
  /** Versión chica, para la lista de franjas del horario laboral. */
  compacto?: boolean
}

export function InputHora({
  value,
  onChange,
  etiqueta,
  compacto = false,
}: InputHoraProps) {
  const [hora = '00', minuto = '00'] = value.split(':')

  // Un valor que no caiga en la grilla de 5 minutos (cargado antes, o desde la base) se
  // suma como opción en vez de perderse: sin esto, abrir el formulario y guardar sin
  // tocar nada le cambiaría la hora a Ariel por lo más cercano.
  const minutos = MINUTOS.includes(minuto)
    ? MINUTOS
    : [...MINUTOS, minuto].sort()

  const clases = `border-borde bg-superficie text-tinta focus:border-miel rounded-md border outline-none ${
    compacto ? 'px-1.5 py-1 text-sm' : 'px-2 py-2'
  }`

  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label={`Hora de ${etiqueta}`}
        value={hora}
        onChange={(e) => onChange(`${e.target.value}:${minuto}`)}
        className={clases}
      >
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-tinta-tenue" aria-hidden="true">
        :
      </span>
      <select
        aria-label={`Minutos de ${etiqueta}`}
        value={minuto}
        onChange={(e) => onChange(`${hora}:${e.target.value}`)}
        className={clases}
      >
        {minutos.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  )
}
