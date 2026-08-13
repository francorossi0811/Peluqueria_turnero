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

/** Alto de un bloque de 20 minutos. Todo lo demás se deriva de esto.
 *
 * Era 34 px, que es lo que necesitaban dos renglones de 11-12 px. Ariel pidió el panel
 * entero con letra de 16 px como piso (tiene problemas de visión), y en 34 px el nombre y
 * el servicio ya no entraban: con dos renglones de 16 px hacen falta ~44 px de contenido
 * más el aire y el borde.
 *
 * ⚠️ Subir esta constante es **lo único** que hace falta para ensanchar los renglones: el
 * alto de cada turno, la posición de la línea de ahora y el alto de cada tramo salen todos
 * de `MINUTOS_POR_PX`, que se deriva de acá. Y como el eje sigue siendo tiempo continuo,
 * el renglón "por defecto" son 20 minutos pero un turno más largo se estira solo — un
 * corte + barba de 40 min ocupa dos renglones sin que nada lo redondee. */
const ALTO_PASO_PX = 72

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

/** El color dice el **estado**, y nada más: claro lo que viene, verde fuerte lo que se
 * hizo, rojo fuerte el que no vino. Los tres son tokens fijos que **no cambian con el
 * tema**: son los colores con los que Ariel lee su día y el interruptor de "Mi cuenta" no
 * tiene que poder tocarlos.
 *
 * Los tres van sobre el naranja de la grilla, así que ninguno puede ser un pastel teñido
 * como antes: el miel-suave sobre naranja fuerte no se distinguía del fondo.
 *
 * ⚠️ `realizado` es un verde **fuerte con texto blanco** y el fondo de los días pasados un
 * verde **claro con texto negro**, que es el fondo sobre el que casi siempre va a caer.
 * Son dos verdes en la misma pantalla a propósito y no se confunden por eso: relleno
 * oscuro contra pastel.
 *
 * El borde es negro y de 2 px para todos, igual que las divisiones de la grilla. */
const CLASES_ESTADO: Record<string, string> = {
  reservado: 'bg-turno-proximo text-agenda-tinta',
  realizado: 'bg-realizado text-sobre-estado',
  ausente: 'bg-ausente-fuerte text-sobre-estado',
}

/** Reparte en columnas los turnos que comparten un rato, para que ninguno tape a otro.
 *
 * Que dos turnos se pisen **no es un error de datos**: marcar Ausente (o Realizado antes
 * de tiempo) libera el rato que queda, que es justamente para lo que sirve — el chico no
 * vino a los 10 minutos, Ariel lo marca y mete a otro en lo que resta. El backend lo
 * permite a propósito: el `EXCLUDE` de la base solo cuenta los `reservado`. Lo que estaba
 * mal era la pantalla, que los dibujaba uno encima del otro y escondía al de abajo.
 *
 * Es el mismo reparto que hace cualquier calendario: los que se tocan forman un grupo, y
 * el grupo se divide en tantas columnas como hagan falta. Cada turno cae en la primera
 * columna que ya se desocupó, así que dos turnos que no se pisan entre sí comparten
 * columna y el grupo no se angosta de más.
 *
 * Un turno solo devuelve `columnas: 1`, o sea el ancho entero: mientras no haya
 * solapamiento la grilla se ve exactamente igual que antes, que es el caso normal. */
function repartirEnColumnas<T>(
  turnos: { turno: T; inicio: number; fin: number }[],
): { turno: T; columna: number; columnas: number }[] {
  // Por hora de inicio, y a igual inicio primero el más largo: así el que abarca a los
  // demás queda a la izquierda y el reparto se lee en el mismo orden que el día.
  const ordenados = [...turnos].sort(
    (a, b) => a.inicio - b.inicio || b.fin - a.fin,
  )

  const repartidos: { turno: T; columna: number; columnas: number }[] = []
  let grupo: typeof repartidos = []
  /** Hasta qué minuto llega lo último puesto en cada columna del grupo. */
  let finDeCadaColumna: number[] = []
  /** Hasta dónde llega el grupo entero: cuando un turno empieza después, ya no lo toca. */
  let finDelGrupo = -Infinity

  const cerrarGrupo = () => {
    // El ancho lo define el grupo, no cada turno: si dos se pisan, los dos van a la mitad
    // aunque uno de ellos no se pise con el tercero.
    for (const r of grupo) r.columnas = finDeCadaColumna.length
    repartidos.push(...grupo)
    grupo = []
    finDeCadaColumna = []
    finDelGrupo = -Infinity
  }

  for (const { turno, inicio, fin } of ordenados) {
    if (inicio >= finDelGrupo) cerrarGrupo()

    // La primera columna libre a esta altura; si no hay ninguna, se abre una nueva.
    let columna = finDeCadaColumna.findIndex((finCol) => finCol <= inicio)
    if (columna === -1) columna = finDeCadaColumna.length

    finDeCadaColumna[columna] = fin
    finDelGrupo = Math.max(finDelGrupo, fin)
    grupo.push({ turno, columna, columnas: 0 })
  }
  cerrarGrupo()

  return repartidos
}

/** El turno en curso **no cambia de color**: mantiene el de su estado y se marca con el
 * borde más grueso.
 *
 * Antes se pintaba de rojo, y estaba mal: mientras duraba, un turno reservado y uno ausente
 * se veían idénticos. La marca de "ahora" ya la dan la línea roja y la hora del margen,
 * como en Google Calendar; acá solo hace falta señalar cuál de los bloques es. */
const CLASES_EN_CURSO = 'border-ahora border-[5px] shadow-md'

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
    //
    // El `min-w` subió de 640 a 900 px y la columna de horas de 3.5 a 4.5rem: con la letra
    // de 16 px, "10:00" ya no entraba en 56 px y los nombres se recortaban a la segunda
    // sílaba. Es el mismo scroll de antes, un poco más largo.
    <div className="border-agenda-linea overflow-x-auto rounded-lg border-2">
      <div className="min-w-[900px]">
        <div
          className="grid"
          style={{ gridTemplateColumns: `4.5rem repeat(${dias.length}, 1fr)` }}
        >
          <div className="bg-agenda-fondo border-agenda-linea sticky left-0 z-20 border-r-2 border-b-2" />
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
                className={`border-agenda-linea text-agenda-tinta flex flex-col items-center justify-start border-r-2 border-b-2 px-2 py-2 text-center last:border-r-0 ${
                  // El fondo dice **cuándo**, no qué pasó: verde claro lo que ya pasó,
                  // naranja hoy y lo que viene. El feriado ya no tiñe el encabezado —
                  // ese eje se lo lleva el rayado violeta de adentro de la columna y el
                  // nombre acá abajo—, porque dos ejes en el mismo fondo es exactamente
                  // el problema que tenía la planilla.
                  dia < hoy ? 'bg-agenda-pasado' : 'bg-agenda-fondo'
                }`}
              >
                {/* Hoy va en negrita y subrayado, no de otro color: el color del fondo ya
                    está ocupado diciendo pasado/futuro, y adentro de la columna la línea
                    roja de "ahora" termina de ubicarlo. */}
                <p
                  className={
                    dia === hoy ? 'font-black underline decoration-2' : 'font-semibold'
                  }
                >
                  <span className="tracking-wide uppercase">
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
                <p className="min-h-[1.35rem] leading-tight font-bold text-balance">
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
      className={`grid ${separado ? 'border-agenda-linea border-t-4' : ''}`}
      style={{ gridTemplateColumns: `4.5rem repeat(${dias.length}, 1fr)` }}
    >
      {/* Columna de horas */}
      <div
        className="bg-agenda-fondo border-agenda-linea sticky left-0 z-10 border-r-2"
        style={{ height: alto }}
      >
        {marcas.map((m) => (
          // La hora de ahora va en rojo **relleno** y no en texto rojo: sobre el naranja
          // de la columna, un rojo sobre naranja casi no se despega. Rellena, se ve desde
          // el otro lado del local.
          <div
            key={m}
            className={`border-agenda-linea/30 border-b px-1 text-right leading-none font-bold ${
              esLaMarcaDeAhora(m)
                ? 'bg-ahora text-sobre-estado'
                : 'text-agenda-tinta'
            }`}
            style={{ height: ALTO_PASO_PX, paddingTop: 4 }}
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

        // El fin se calcula con la duración del snapshot, que es **la misma cuenta con la
        // que se dibuja el alto** unas líneas más abajo. Podría salir de `t.horaFin`, que
        // hoy vale lo mismo, pero derivarlo de lo que se dibuja es lo que garantiza que
        // el reparto y el bloque nunca puedan discrepar.
        const turnosDelTramo = delDia
          .map((turno) => ({
            turno,
            inicio: aMinutos(turno.hora),
            fin: aMinutos(turno.hora) + turno.servicio.duracionMinutos,
          }))
          .filter((t) => t.inicio >= tramo.inicio && t.inicio < tramo.fin)

        return (
          <div
            key={dia}
            // Naranja fuerte hoy y lo que viene, verde claro lo que ya pasó. Es el mismo
            // criterio del encabezado, y por eso se lee de arriba abajo como una sola
            // columna: "esto ya está" / "esto me falta".
            className={`border-agenda-linea relative border-r-2 last:border-r-0 ${
              dia < hoy ? 'bg-agenda-pasado' : 'bg-agenda-fondo'
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
                  // Las divisiones de 20 minutos, en negro y no en el crema `borde-suave`:
                  // sobre el naranja fuerte una línea clara desaparece, y son justamente
                  // las líneas con las que Ariel cuenta los ratos.
                  className="border-agenda-linea/40 hover:bg-agenda-tinta/10 block w-full border-b transition"
                  style={{ height: ALTO_PASO_PX }}
                />
              ) : abierto(m) ? (
                // Ya pasó: se ve como hueco (Ariel mira semanas anteriores para saber
                // quién vino) pero no invita a tocarlo.
                <div
                  key={m}
                  className="border-agenda-linea/40 block w-full border-b"
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
                  className="border-agenda-linea/40 block w-full border-b"
                  style={{
                    height: ALTO_PASO_PX,
                    // Trama diagonal en vez de un fondo apenas más oscuro: Ariel usa
                    // lentes (es el motivo del tema oscuro) y un matiz de luminosidad no
                    // le sirve para distinguir "cerrado" de "libre" de un vistazo.
                    //
                    // El color separa los dos motivos: violeta si el feriado le comió ese
                    // rato, neutro si ese día simplemente no abre.
                    // El rayado se hace más grueso y más junto (2 px cada 6 en vez de 1
                    // cada 7) y el neutro pasa a negro: el crema de `borde` sobre el
                    // naranja fuerte no se veía, que es justo lo contrario de lo que el
                    // rayado tiene que lograr.
                    backgroundImage: `repeating-linear-gradient(45deg, ${
                      cerradoPorFeriado(m)
                        ? 'var(--color-feriado)'
                        : 'var(--color-agenda-linea)'
                    } 0 2px, transparent 2px 6px)`,
                    opacity: cerradoPorFeriado(m) ? 0.85 : 0.55,
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
                  // Relleno negro: sobre el naranja, el ámbar pastel que tenía antes se
                  // confundía con el fondo. Negro se lee de una como "acá no hay nada".
                  className="border-agenda-linea bg-agenda-tinta text-sobre-estado absolute right-0 left-0 overflow-hidden rounded border-2 px-1 font-bold"
                  style={{
                    top: (desde - tramo.inicio) / MINUTOS_POR_PX,
                    height: (hasta - desde) / MINUTOS_POR_PX,
                  }}
                >
                  {b.motivo ?? 'Bloqueado'}
                </div>
              )
            })}

            {repartirEnColumnas(turnosDelTramo).map(({
              turno: t,
              columna,
              columnas,
            }) => {
              const inicio = aMinutos(t.hora)

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
                  className={`border-agenda-linea absolute overflow-hidden rounded-md border-2 px-1 text-left shadow-sm transition hover:brightness-110 ${
                    CLASES_ESTADO[t.estado] ??
                    'bg-turno-proximo text-agenda-tinta'
                  } ${enCurso ? CLASES_EN_CURSO : ''} ${
                    // Sin ver (HU-17): anillo negro grueso. Era miel, que sobre el naranja
                    // de la grilla es casi el mismo color.
                    t.vistoPorAdmin ? '' : 'ring-agenda-tinta ring-4'
                  }`}
                  style={{
                    top: (inicio - tramo.inicio) / MINUTOS_POR_PX,
                    height: t.servicio.duracionMinutos / MINUTOS_POR_PX,
                    // El reparto en columnas (ver `repartirEnColumnas`). Los 2 px de
                    // cada lado son los mismos que antes daban `left-0.5 right-0.5`,
                    // así que un turno solo —el caso normal— queda idéntico a como
                    // estaba; lo que cambia es solo el turno que comparte el rato.
                    left: `calc(${(columna / columnas) * 100}% + 2px)`,
                    width: `calc(${100 / columnas}% - 4px)`,
                  }}
                >
                  {/* El texto **hereda** el color del bloque (blanco sobre el verde y el
                      rojo fuertes, negro sobre el bloque claro de lo que viene) en vez de
                      fijar `text-tinta`. Antes iba siempre al color de la tinta del tema
                      porque los tres fondos eran pasteles; ahora dos de los tres son
                      rellenos oscuros y `tinta` quedaría negro sobre verde oscuro.

                      Las mayúsculas ya no se piden acá: el panel entero va en mayúscula
                      desde `index.css`. Se deja la clase igual, que es lo que mantiene el
                      componente legible fuera de ese contexto.

                      Se muestra el apodo si la ficha tiene uno (HU-25): Ariel piensa a
                      esa persona como "Flaco", no como el nombre que tipeó al reservar. */}
                  {/* HU-25 — Las insignias van en el mismo renglón que el nombre, no
                      abajo. Se probó abajo primero y en pantalla se veía el defecto: un
                      turno de 20 minutos mide 34 píxeles, en los que entran dos renglones
                      y no tres, así que los círculos quedaban cortados por el borde del
                      bloque. Acá siempre entran, porque el que cede espacio es el nombre
                      (que ya se recorta con puntos suspensivos). */}
                  <span className="flex items-start gap-1">
                    <span className="min-w-0 flex-1 truncate leading-tight font-bold uppercase">
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
                  {/* El servicio, en el mismo color heredado que el nombre. Se distingue
                      del nombre por el peso (normal contra negrita) y no por el tamaño:
                      con el piso de 16 px del panel, los dos renglones miden lo mismo. */}
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
                    <span className="min-w-0 flex-1 truncate leading-tight">
                      {t.servicio.nombre}
                    </span>
                    {t.estado === 'realizado' &&
                      (t.medioPago ? (
                        // Cobrado: hereda el blanco del bloque y se calla.
                        <span aria-hidden className="shrink-0 leading-tight">
                          $
                        </span>
                      ) : (
                        // Falta cobrar: ámbar relleno. Antes era texto ámbar, que sobre el
                        // verde fuerte del realizado no se despega — y es justo la marca
                        // que tiene que llamar la atención.
                        <span
                          aria-hidden
                          className="bg-alerta text-sobre-estado shrink-0 rounded px-1 leading-tight font-bold"
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
                className="border-ahora pointer-events-none absolute right-0 left-0 z-10 border-t-4"
                style={{ top: (minutosAhora! - tramo.inicio) / MINUTOS_POR_PX }}
              >
                <span className="bg-ahora absolute -top-1.5 -left-1.5 block h-3 w-3 rounded-full" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
