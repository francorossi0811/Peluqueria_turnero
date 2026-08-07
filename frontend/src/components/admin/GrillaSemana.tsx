import { DIAS_CORTOS, diaSemana } from '../../utils/fecha'
import type { Bloqueo, FranjaHorario, TurnoAdmin } from '../../types/api'

// HU-23 — La semana como grilla, que es la forma en que Ariel viene leyendo su agenda en
// la planilla: los días como columnas, el tiempo hacia abajo, y los huecos a la vista.
//
// La diferencia de fondo con la planilla es que **el eje vertical es tiempo continuo, no
// filas**. En la planilla un turno ocupa una celda de 20 minutos aunque dure 35, porque
// una celda es lo único que Sheets sabe hacer. Acá el alto sale de la duración real: un
// corte + barba de 35 min mide 35 minutos. Eso hace que la grilla ya funcione para
// cualquier duración futura sin tocar este componente.
//
// Las líneas cada 20 minutos siguen dibujándose porque son la referencia visual que Ariel
// usa para leer, pero son fondo: no son la unidad con la que se posiciona nada.

/** Cada cuánto se dibuja una línea de referencia y cada cuánto se puede empezar un turno.
 *
 * ⚠️ Tiene que coincidir con `PASO_MINUTOS` de
 * `backend/src/services/disponibilidad.service.ts`, que es quien decide de verdad qué
 * horarios existen. Está duplicado a propósito, igual que las reglas de validación: acá
 * solo dibuja, allá manda. */
const PASO_MINUTOS = 20

/** Alto de un bloque de 20 minutos. Todo lo demás se deriva de esto. */
const ALTO_PASO_PX = 34

const MINUTOS_POR_PX = PASO_MINUTOS / ALTO_PASO_PX

interface GrillaSemanaProps {
  dias: string[]
  turnos: TurnoAdmin[]
  bloqueos: Bloqueo[]
  franjas: FranjaHorario[]
  /** Fecha de hoy en ISO, para resaltar la columna y ubicar la línea de "ahora". */
  hoy: string
  /** Minutos desde medianoche, o `null` si no hace falta la línea de ahora. */
  minutosAhora: number | null
  onElegirHueco: (fecha: string, hora: string) => void
  onElegirTurno: (turno: TurnoAdmin) => void
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Las franjas del día, unificadas para toda la semana.
 *
 * La grilla es una sola tabla, así que las filas tienen que servir para los cinco días.
 * Se toman los tramos de `horario_laboral` sin importar el día: si Ariel abriera los
 * sábados solo a la tarde, la franja de la mañana igual existe en la grilla y ese día
 * queda vacío, que es la lectura correcta. */
function franjasDeLaSemana(
  franjas: FranjaHorario[],
): { inicio: number; fin: number }[] {
  const tramos = franjas
    .map((f) => ({ inicio: aMinutos(f.horaInicio), fin: aMinutos(f.horaFin) }))
    .sort((a, b) => a.inicio - b.inicio)

  // Se fusionan los tramos que se pisan entre días distintos, para no dibujar dos veces
  // el mismo rango horario.
  const unificados: { inicio: number; fin: number }[] = []
  for (const tramo of tramos) {
    const ultimo = unificados.at(-1)
    if (ultimo && tramo.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, tramo.fin)
    } else {
      unificados.push({ ...tramo })
    }
  }
  return unificados
}

const CLASES_ESTADO: Record<string, string> = {
  reservado: 'bg-miel-suave text-miel border-miel/40',
  realizado: 'bg-bien-suave text-bien border-bien/40',
  ausente: 'bg-vino-suave text-vino border-vino/40',
}

export function GrillaSemana({
  dias,
  turnos,
  bloqueos,
  franjas,
  hoy,
  minutosAhora,
  onElegirHueco,
  onElegirTurno,
}: GrillaSemanaProps) {
  const tramos = franjasDeLaSemana(franjas)

  if (tramos.length === 0) {
    return (
      <p className="text-tinta-suave text-sm">
        No hay horario laboral cargado, así que no hay grilla que mostrar.
      </p>
    )
  }

  return (
    // El scroll horizontal es para el celular: cinco columnas no entran en 375 px sin
    // volverse ilegibles. La columna de horas queda fija para no perder la referencia.
    <div className="border-borde overflow-x-auto rounded-lg border">
      <div className="min-w-[640px]">
        <div
          className="grid"
          style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, 1fr)` }}
        >
          <div className="bg-superficie-2 border-borde sticky left-0 z-20 border-r border-b" />
          {dias.map((dia) => (
            <div
              key={dia}
              className={`border-borde border-b px-2 py-2 text-center ${
                dia === hoy ? 'bg-destacado' : 'bg-superficie-2'
              }`}
            >
              <p
                className={`text-xs font-semibold tracking-wide uppercase ${
                  dia === hoy ? 'text-miel' : 'text-tinta-tenue'
                }`}
              >
                {DIAS_CORTOS[diaSemana(dia)]}
              </p>
              <p
                className={`text-sm ${dia === hoy ? 'text-miel font-semibold' : 'text-tinta-suave'}`}
              >
                {Number(dia.slice(8, 10))}
              </p>
            </div>
          ))}
        </div>

        {tramos.map((tramo, i) => (
          <TramoGrilla
            key={tramo.inicio}
            tramo={tramo}
            dias={dias}
            turnos={turnos}
            bloqueos={bloqueos}
            franjas={franjas}
            hoy={hoy}
            minutosAhora={minutosAhora}
            onElegirHueco={onElegirHueco}
            onElegirTurno={onElegirTurno}
            // El corte entre la mañana y la tarde: en la planilla es una franja verde, y
            // es lo que Ariel usa para no confundir un hueco de las 11 con uno de las 18.
            separado={i > 0}
          />
        ))}
      </div>
    </div>
  )
}

interface TramoGrillaProps extends Omit<GrillaSemanaProps, 'dias'> {
  tramo: { inicio: number; fin: number }
  dias: string[]
  separado: boolean
}

function TramoGrilla({
  tramo,
  dias,
  turnos,
  bloqueos,
  franjas,
  hoy,
  minutosAhora,
  onElegirHueco,
  onElegirTurno,
  separado,
}: TramoGrillaProps) {
  const duracion = tramo.fin - tramo.inicio
  const alto = duracion / MINUTOS_POR_PX

  const marcas: number[] = []
  for (let m = tramo.inicio; m < tramo.fin; m += PASO_MINUTOS) marcas.push(m)

  const ahoraEnTramo =
    minutosAhora !== null &&
    minutosAhora >= tramo.inicio &&
    minutosAhora <= tramo.fin

  return (
    <div
      className={`grid ${separado ? 'border-miel/30 border-t-4' : ''}`}
      style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, 1fr)` }}
    >
      {/* Columna de horas */}
      <div
        className="bg-superficie-2 border-borde sticky left-0 z-10 border-r"
        style={{ height: alto }}
      >
        {marcas.map((m) => (
          <div
            key={m}
            className="text-tinta-tenue pr-1 text-right text-[11px] leading-none"
            style={{ height: ALTO_PASO_PX, paddingTop: 2 }}
          >
            {aHora(m)}
          </div>
        ))}
      </div>

      {dias.map((dia) => {
        const delDia = turnos.filter(
          (t) => t.fecha === dia && t.estado !== 'cancelado',
        )
        const bloqueosDelDia = bloqueos.filter(
          (b) => b.fechaInicio <= dia && b.fechaFin >= dia,
        )

        // Las franjas **de este día**, que no son las del tramo. El tramo es la unión de
        // toda la semana: el sábado abre a las 09:00 y cierra 20:30, el resto va de 10:00
        // a 20:00. Sin este chequeo, de martes a viernes las 09:00 y las 20:00 se verían
        // como huecos libres y clickeables con la peluquería cerrada.
        const franjasDelDia = franjas
          .filter((f) => f.diaSemana === diaSemana(dia))
          .map((f) => ({ inicio: aMinutos(f.horaInicio), fin: aMinutos(f.horaFin) }))
        const abierto = (desde: number) =>
          franjasDelDia.some(
            (f) => desde >= f.inicio && desde + PASO_MINUTOS <= f.fin,
          )

        // Un horario que ya pasó no se puede reservar —el backend no lo ofrece ni con las
        // acciones de Ariel, que van sin margen— así que tampoco se toca. Si no, navegar
        // a una semana anterior para mirar el historial deja toda la pantalla llena de
        // huecos que al tocarlos abren un modal donde no se puede elegir nada.
        const pasado = (desde: number) =>
          dia < hoy || (dia === hoy && minutosAhora !== null && desde < minutosAhora)

        return (
          <div
            key={dia}
            className={`border-borde relative border-r last:border-r-0 ${
              dia === hoy ? 'bg-destacado/40' : ''
            }`}
            style={{ height: alto }}
          >
            {/* Los huecos: uno por paso. Son el fondo sobre el que se apoyan los turnos,
                y lo que Ariel toca para cargar uno nuevo. Fuera del horario de ese día no
                son botones: mostrar como libre un rato en el que está cerrado es peor que
                no mostrarlo. */}
            {marcas.map((m) =>
              abierto(m) && !pasado(m) ? (
                <button
                  key={m}
                  onClick={() => onElegirHueco(dia, aHora(m))}
                  title={`Cargar turno · ${aHora(m)}`}
                  className="border-borde-suave hover:bg-miel-suave/50 block w-full border-b transition"
                  style={{ height: ALTO_PASO_PX }}
                />
              ) : abierto(m) ? (
                // Ya pasó: se ve como hueco (Ariel mira semanas anteriores para saber
                // quién vino) pero no invita a tocarlo.
                <div
                  key={m}
                  className="border-borde-suave block w-full border-b"
                  style={{ height: ALTO_PASO_PX }}
                />
              ) : (
                <div
                  key={m}
                  title="Cerrado"
                  className="border-borde-suave block w-full border-b"
                  style={{
                    height: ALTO_PASO_PX,
                    // Trama diagonal en vez de un fondo apenas más oscuro: Ariel usa
                    // lentes (es el motivo del tema oscuro) y un matiz de luminosidad no
                    // le sirve para distinguir "cerrado" de "libre" de un vistazo.
                    backgroundImage:
                      'repeating-linear-gradient(45deg, var(--color-borde) 0 1px, transparent 1px 7px)',
                    opacity: 0.5,
                  }}
                />
              ),
            )}

            {bloqueosDelDia.map((b) => {
              const inicio = b.horaInicio ? aMinutos(b.horaInicio) : tramo.inicio
              const fin = b.horaFin ? aMinutos(b.horaFin) : tramo.fin
              const desde = Math.max(inicio, tramo.inicio)
              const hasta = Math.min(fin, tramo.fin)
              if (hasta <= desde) return null

              return (
                <div
                  key={b.id}
                  title={b.motivo ?? 'Bloqueado'}
                  className="border-alerta/50 bg-alerta-suave text-alerta absolute right-0 left-0 overflow-hidden rounded border px-1 text-[11px]"
                  style={{
                    top: (desde - tramo.inicio) / MINUTOS_POR_PX,
                    height: (hasta - desde) / MINUTOS_POR_PX,
                  }}
                >
                  {b.motivo ?? 'Bloqueado'}
                </div>
              )
            })}

            {delDia.map((t) => {
              const inicio = aMinutos(t.hora)
              if (inicio < tramo.inicio || inicio >= tramo.fin) return null

              // El alto sale solo de la duración. No se redondea al paso de 20 minutos:
              // si se redondeara, un turno de 35 se vería igual que uno de 40 y Ariel
              // perdería justamente el dato que la planilla no le podía dar.
              return (
                <button
                  key={t.id}
                  onClick={() => onElegirTurno(t)}
                  title={`${t.clienteNombre} · ${t.servicio.nombre} · ${t.hora}`}
                  className={`absolute right-0.5 left-0.5 overflow-hidden rounded border px-1 text-left transition hover:brightness-110 ${
                    CLASES_ESTADO[t.estado] ?? 'bg-superficie-2 text-tinta-suave'
                  } ${t.vistoPorAdmin ? '' : 'ring-miel ring-2'}`}
                  style={{
                    top: (inicio - tramo.inicio) / MINUTOS_POR_PX,
                    height: t.servicio.duracionMinutos / MINUTOS_POR_PX,
                  }}
                >
                  <span className="block truncate text-xs leading-tight font-semibold">
                    {t.clienteNombre}
                  </span>
                  {/* El servicio, chico y secundario. Es lo que la planilla no podía
                      mostrar, y el lugar donde después entran la etiqueta del cliente y
                      el medio de pago sin rediseñar nada. */}
                  <span className="block truncate text-[10px] leading-tight opacity-80">
                    {t.servicio.nombre}
                  </span>
                </button>
              )
            })}

            {/* La línea de ahora, como en Google Calendar: ubica sin tener que leer. */}
            {ahoraEnTramo && dia === hoy && (
              <div
                className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-red-500"
                style={{ top: (minutosAhora! - tramo.inicio) / MINUTOS_POR_PX }}
              >
                <span className="absolute -top-1 -left-1 block h-2 w-2 rounded-full bg-red-500" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
