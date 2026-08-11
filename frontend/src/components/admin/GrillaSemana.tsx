import { Insignia } from './Insignia'
import {
  DIAS_CORTOS,
  diaSemana,
  minutosDeHora as aMinutos,
  turnoEnCurso,
} from '../../utils/fecha'
import type {
  Bloqueo,
  Feriado,
  FranjaHorario,
  TurnoAdmin,
} from '../../types/api'

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
  /** Los feriados que caen en la semana (HU-24). Sin esto la grilla mostraba la tarde de
   * un feriado de medio día como huecos libres, que es el mismo error que mostrar como
   * libre un día cerrado. */
  feriados: Feriado[]
  /** Fecha de hoy en ISO, para resaltar la columna y ubicar la línea de "ahora". */
  hoy: string
  /** Minutos desde medianoche, o `null` si no hace falta la línea de ahora. */
  minutosAhora: number | null
  onElegirHueco: (fecha: string, hora: string) => void
  onElegirTurno: (turno: TurnoAdmin) => void
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

/** Cómo se anuncia el feriado arriba de la columna. `dia_completo` no dice nada: ese día
 * Ariel trabaja normal y el feriado no le cambia la agenda. */
function etiquetaFeriado(feriados: Feriado[], dia: string): string | null {
  const feriado = feriados.find((f) => f.fecha === dia)
  if (!feriado || feriado.modalidad === 'dia_completo') return null
  const sufijo = feriado.modalidad === 'cerrado' ? 'cerrado' : 'medio día'
  return `${feriado.nombre} · ${sufijo}`
}

/** El color dice el **estado**, y nada más: miel lo que viene, verde lo que se hizo, rojo
 * el que no vino. Los tres valen igual en claro y en oscuro porque salen de tokens que el
 * tema redefine; ninguno está escrito a mano acá.
 *
 * El borde va más marcado que antes (`/70` en vez de `/40`): con `/40` sobre el fondo
 * oscuro el bloque casi no tenía contorno y todo se veía plano. */
const CLASES_ESTADO: Record<string, string> = {
  reservado: 'bg-miel-suave text-miel border-miel/70',
  realizado: 'bg-bien-suave text-bien border-bien/70',
  ausente: 'bg-ausente-suave text-ausente border-ausente/70',
}

/** El turno en curso **no cambia de color**: mantiene el de su estado y se marca con el
 * borde más grueso.
 *
 * Antes se pintaba de rojo, y estaba mal: mientras duraba, un turno reservado y uno ausente
 * se veían idénticos. La marca de "ahora" ya la dan la línea roja y la hora del margen,
 * como en Google Calendar; acá solo hace falta señalar cuál de los bloques es. */
const CLASES_EN_CURSO = 'border-[3px] shadow-md'

export function GrillaSemana({
  dias,
  turnos,
  bloqueos,
  franjas,
  feriados,
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
          {/* Dos renglones, siempre los mismos dos: día+número arriba, feriado abajo.
              Antes eran tres elementos apilados (día, número, feriado) y solo la columna
              con feriado tenía el tercero, así que los días no alineaban entre columnas.
              Centrar el bloque en vertical no lo arregla —lo movió: medido, la línea del
              día quedaba 13 px más arriba en las columnas con feriado—. Lo que lo arregla
              es que el segundo renglón exista en **todas** las columnas aunque esté vacío
              y que el bloque se apoye arriba: así el día está siempre a la misma altura, y
              un nombre largo que se parte en dos crece hacia abajo sin correr nada. */}
          {dias.map((dia) => {
            const feriado = etiquetaFeriado(feriados, dia)
            return (
              <div
                key={dia}
                className={`border-borde flex flex-col items-center justify-start border-b px-2 py-2 text-center ${
                  feriado
                    ? 'bg-feriado-suave'
                    : dia === hoy
                      ? 'bg-destacado'
                      : 'bg-superficie-2'
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    dia === hoy ? 'text-miel' : 'text-tinta-suave'
                  }`}
                >
                  <span className="text-xs tracking-wide uppercase">
                    {DIAS_CORTOS[diaSemana(dia)]}
                  </span>{' '}
                  {Number(dia.slice(8, 10))}
                </p>
                {/* El feriado se nombra acá arriba. Sin esto, Ariel ve media columna
                    rayada y no tiene forma de saber por qué. Se deja envolver en dos
                    líneas en vez de recortarse: "Paso a la Inmortalidad… · medio día"
                    cortado en "Paso a la Inmo…" no dice ni qué feriado es ni cuánto
                    atiende. El `min-h` reserva el renglón aunque no haya feriado, que es
                    lo que mantiene alineados los días. */}
                <p className="text-feriado min-h-[0.95rem] text-[10px] leading-tight text-balance">
                  {feriado}
                </p>
              </div>
            )
          })}
        </div>

        {tramos.map((tramo, i) => (
          <TramoGrilla
            key={tramo.inicio}
            tramo={tramo}
            dias={dias}
            turnos={turnos}
            bloqueos={bloqueos}
            franjas={franjas}
            feriados={feriados}
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
  feriados,
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

  // La columna de horas es una sola para toda la semana, así que solo tiene sentido pintar
  // la hora actual cuando el día de hoy está entre los que se ven. Mirando la semana que
  // viene, una hora en rojo señalaría una línea que no está dibujada en ninguna columna.
  const hoyEstaALaVista = dias.includes(hoy)

  /** ¿Esta marca del margen izquierdo es la que contiene la hora actual?
   *
   * Se pinta en rojo la hora cuyo bloque de 20 minutos abarca el momento presente, o sea
   * la que está a la altura de la línea. Es lo que permite ubicar la hora sin seguir la
   * línea con el dedo hasta el margen. */
  const esLaMarcaDeAhora = (m: number) =>
    hoyEstaALaVista &&
    ahoraEnTramo &&
    minutosAhora! >= m &&
    minutosAhora! < m + PASO_MINUTOS

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
            className={`pr-1 text-right text-[11px] leading-none ${
              esLaMarcaDeAhora(m)
                ? 'text-ahora font-bold'
                : 'text-tinta-tenue'
            }`}
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
        const todasLasFranjas = franjas
          .filter((f) => f.diaSemana === diaSemana(dia))
          .map((f) => ({ inicio: aMinutos(f.horaInicio), fin: aMinutos(f.horaFin) }))
          .sort((a, b) => a.inicio - b.inicio)

        // El feriado recorta el día igual que lo hace el backend en
        // `franjasSegunFeriado`: cerrado no deja nada, medio día deja la primera franja.
        // Si la grilla no lo aplicara, mostraría como libre un rato en el que ningún
        // cliente puede reservar — y Ariel cargaría un turno ahí creyendo que se puede.
        const feriado = feriados.find((f) => f.fecha === dia)
        const franjasDelDia =
          feriado?.modalidad === 'cerrado'
            ? []
            : feriado?.modalidad === 'medio_dia'
              ? todasLasFranjas.slice(0, 1)
              : todasLasFranjas
        const abierto = (desde: number) =>
          franjasDelDia.some(
            (f) => desde >= f.inicio && desde + PASO_MINUTOS <= f.fin,
          )

        // Un rato puede estar cerrado por dos motivos distintos —"ese día no abro" y "es
        // feriado"— y hasta ahora los dos se rayaban igual. Se distinguen por el color:
        // si el rato entra en el horario normal del día pero el feriado lo recortó, es
        // culpa del feriado.
        const cerradoPorFeriado = (desde: number) =>
          todasLasFranjas.some(
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
                  title={
                    cerradoPorFeriado(m)
                      ? (etiquetaFeriado(feriados, dia) ?? 'Feriado')
                      : 'Cerrado'
                  }
                  className="border-borde-suave block w-full border-b"
                  style={{
                    height: ALTO_PASO_PX,
                    // Trama diagonal en vez de un fondo apenas más oscuro: Ariel usa
                    // lentes (es el motivo del tema oscuro) y un matiz de luminosidad no
                    // le sirve para distinguir "cerrado" de "libre" de un vistazo.
                    //
                    // El color separa los dos motivos: violeta si el feriado le comió ese
                    // rato, neutro si ese día simplemente no abre.
                    backgroundImage: `repeating-linear-gradient(45deg, ${
                      cerradoPorFeriado(m)
                        ? 'var(--color-feriado)'
                        : 'var(--color-borde)'
                    } 0 1px, transparent 1px 7px)`,
                    opacity: cerradoPorFeriado(m) ? 0.75 : 0.5,
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

              // El turno que está ocurriendo justo ahora. Misma función que usa la vista
              // Día, para que las dos coincidan.
              const enCurso = turnoEnCurso(t, dia, hoy, minutosAhora)

              // El alto sale solo de la duración. No se redondea al paso de 20 minutos:
              // si se redondeara, un turno de 35 se vería igual que uno de 40 y Ariel
              // perdería justamente el dato que la planilla no le podía dar.
              return (
                <button
                  key={t.id}
                  onClick={() => onElegirTurno(t)}
                  title={`${t.cliente?.apodo || t.clienteNombre} · ${t.servicio.nombre} · ${t.hora}${enCurso ? ' · en curso' : ''}${
                    // HU-27 — La marca del cobro es un glifo de 10 px; el tooltip la dice
                    // con palabras para el que no la tiene aprendida.
                    t.estado === 'realizado'
                      ? t.medioPago
                        ? ' · cobrado'
                        : ' · sin cobro registrado'
                      : ''
                  }`}
                  // `rounded-md` + `shadow-sm`: el relieve mínimo que despega el bloque del
                  // fondo sin que parezca una tarjeta. El `shadow` se refuerza a `md` solo
                  // en el turno en curso, junto con el borde grueso.
                  className={`absolute right-0.5 left-0.5 overflow-hidden rounded-md border px-1 text-left shadow-sm transition hover:brightness-110 ${
                    CLASES_ESTADO[t.estado] ??
                    'bg-superficie-2 text-tinta-suave'
                  } ${enCurso ? CLASES_EN_CURSO : ''} ${
                    t.vistoPorAdmin ? '' : 'ring-miel ring-2'
                  }`}
                  style={{
                    top: (inicio - tramo.inicio) / MINUTOS_POR_PX,
                    height: t.servicio.duracionMinutos / MINUTOS_POR_PX,
                  }}
                >
                  {/* Mayúsculas y `text-tinta` (blanco en el tema oscuro, que es el que
                      usa Ariel; casi negro en el claro). El nombre es lo único que
                      necesita leer de lejos, y usa lentes: el color del estado ya lo dan
                      el fondo y el borde, así que el texto puede ir al máximo contraste
                      en vez de teñirse.

                      Se muestra el apodo si la ficha tiene uno (HU-25): Ariel piensa a
                      esa persona como "Flaco", no como el nombre que tipeó al reservar. */}
                  {/* HU-25 — Las insignias van en el mismo renglón que el nombre, no
                      abajo. Se probó abajo primero y en pantalla se veía el defecto: un
                      turno de 20 minutos mide 34 píxeles, en los que entran dos renglones
                      y no tres, así que los círculos quedaban cortados por el borde del
                      bloque. Acá siempre entran, porque el que cede espacio es el nombre
                      (que ya se recorta con puntos suspensivos). */}
                  <span className="flex items-start gap-1">
                    <span className="text-tinta min-w-0 flex-1 truncate text-xs leading-tight font-bold uppercase">
                      {t.cliente?.apodo || t.clienteNombre}
                    </span>
                    {t.cliente && t.cliente.etiquetas.length > 0 && (
                      <span className="flex shrink-0 items-center gap-1 pt-0.5">
                        {t.cliente.etiquetas.map((e) => (
                          <Insignia key={e.id} etiqueta={e} />
                        ))}
                      </span>
                    )}
                  </span>
                  {/* El servicio, también en `text-tinta` y no teñido del color del
                      estado: con lentes, un ámbar sobre ámbar suave no se lee. Sigue
                      siendo secundario por tamaño, que es lo que tiene que distinguirlo
                      del nombre — no el contraste. */}
                  {/* HU-27 — La marca del cobro va acá, pegada al servicio, y **no como
                      un color del bloque**: el color del bloque dice el estado y nada más
                      (HU-23), y meterle un segundo eje encima sería volver al problema de
                      la planilla, donde un mismo color quería decir dos cosas.

                      Aparece solo en los realizados, que son los únicos con plata de por
                      medio, y lo que llama la atención es el que **falta** cobrar: el ya
                      cobrado se confirma en gris y se calla. El monto no entra ni hace
                      falta acá — para eso están el detalle y la sección Cobros.

                      Va en el renglón del servicio y no en uno propio por lo mismo que
                      las insignias de HU-25: un turno de 20 minutos son 34 píxeles y el
                      tercer renglón queda cortado. */}
                  <span className="flex items-baseline gap-1">
                    <span className="text-tinta min-w-0 flex-1 truncate text-[10px] leading-tight">
                      {t.servicio.nombre}
                    </span>
                    {t.estado === 'realizado' &&
                      (t.medioPago ? (
                        <span
                          aria-hidden
                          className="text-tinta-tenue shrink-0 text-[10px] leading-tight"
                        >
                          $
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="text-alerta shrink-0 text-[10px] leading-tight font-bold"
                        >
                          $?
                        </span>
                      ))}
                  </span>
                </button>
              )
            })}

            {/* La línea de ahora, como en Google Calendar: ubica sin tener que leer.
                Comparte el color con el turno en curso — las dos cosas dicen "ahora". */}
            {ahoraEnTramo && dia === hoy && (
              <div
                className="border-ahora pointer-events-none absolute right-0 left-0 z-10 border-t-2"
                style={{ top: (minutosAhora! - tramo.inicio) / MINUTOS_POR_PX }}
              >
                <span className="bg-ahora absolute -top-1 -left-1 block h-2 w-2 rounded-full" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
