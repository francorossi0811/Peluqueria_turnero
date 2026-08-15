import { Chip } from './ui/Chip'
import { etiquetaDiaCorta, fechaLegible, yaPaso } from '../utils/fecha'
import type { DisponibilidadDia } from '../types/api'

/** HU-08 — El "ahora" contra el que se decide si un día o una hora ya pasaron.
 *
 * Es un objeto y no dos props sueltas para que no pueda existir el estado intermedio "sé
 * qué día es hoy pero no qué hora": las dos se necesitan juntas para decidir si una hora
 * de HOY ya pasó. */
export interface MarcaDePasado {
  hoy: string
  minutosAhora: number
}

interface GrillaHorariosProps {
  dias: DisponibilidadDia[]
  fecha: string | null
  hora: string | null
  onElegirFecha: (fecha: string) => void
  onElegirHora: (hora: string) => void
  /** Solo lo pasa el panel de Ariel (HU-08): marca los días y las horas que ya pasaron, y
   * cambia los textos de "no hay nada" por los que le sirven a él.
   *
   * Sin esta prop el componente se dibuja **exactamente** como antes, que es lo que
   * permite seguir compartiéndolo con la reserva del cliente en vez de forkearlo. */
  pasado?: MarcaDePasado
}

/** Qué se le dice al cliente cuando el día que eligió no tiene horarios.
 *
 * Antes todos estos casos caían en el mismo "no hay turnos": el que se topaba con las
 * vacaciones de Ariel y el que llegó tarde a un día lleno leían lo mismo, y ninguno de
 * los dos sabía qué hacer después. */
function mensajeDelDia(dia: DisponibilidadDia, esAdmin = false): string {
  switch (dia.estado) {
    case 'completo':
      // Para Ariel el mismo estado significa otra cosa: no está "llegando tarde", está
      // mirando su propio día lleno.
      return esAdmin
        ? 'Se ocupó todo este día.'
        : 'Se ocuparon todos los turnos de este día.'
    case 'bloqueado':
      return dia.motivo
        ? `Este día no hay atención: ${dia.motivo}.`
        : 'Este día no hay atención.'
    case 'feriado':
      return dia.motivo
        ? `${dia.motivo}: feriado, no atendemos.`
        : 'Feriado, no atendemos.'
    case 'cerrado':
      return 'Este día la peluquería no abre.'
    default:
      return 'No quedan horarios para este día.'
  }
}

// Selector de día + horario, reusado por reservar (ReservarPage) y reprogramar
// (GestionTurnoPage) — misma disponibilidad real, mismo componente.
export function GrillaHorarios({
  dias,
  fecha,
  hora,
  onElegirFecha,
  onElegirHora,
  pasado,
}: GrillaHorariosProps) {
  const diasConHorarios = dias.filter((d) => d.horarios.length > 0)

  if (diasConHorarios.length === 0) {
    // El texto del cliente le diría a Ariel que le escriba a Ariel por WhatsApp.
    return (
      <p className="text-tinta-suave">
        {pasado
          ? 'No hay horarios en este rango.'
          : 'No hay horarios disponibles en las próximas dos semanas. Escribile a Ariel por WhatsApp y coordinan directamente.'}
      </p>
    )
  }

  const diaSeleccionado = dias.find((d) => d.fecha === fecha)
  const horarios = diaSeleccionado?.horarios ?? []
  const manana = horarios.filter((h) => h < '13:00')
  const tarde = horarios.filter((h) => h >= '13:00')

  // Para recomendarle una salida concreta al que cae en un día sin lugar, en vez de
  // dejarlo probando chip por chip.
  const proximoLibre = fecha
    ? diasConHorarios.find((d) => d.fecha > fecha)
    : undefined

  return (
    <>
      {/* Se muestran TODOS los días, no solo los que tienen lugar: si el cliente no ve
          el día que le interesa, no puede enterarse de por qué no está. Los que no
          tienen horarios quedan atenuados pero se pueden tocar para leer el motivo. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {dias.map((d) =>
          d.horarios.length > 0 ? (
            <Chip
              key={d.fecha}
              selected={d.fecha === fecha}
              tono={pasado && d.fecha < pasado.hoy ? 'pasado' : 'normal'}
              title={
                pasado && d.fecha < pasado.hoy ? 'Este día ya pasó' : undefined
              }
              onClick={() => onElegirFecha(d.fecha)}
            >
              {etiquetaDiaCorta(d.fecha)}
            </Chip>
          ) : (
            <button
              key={d.fecha}
              type="button"
              onClick={() => onElegirFecha(d.fecha)}
              title={mensajeDelDia(d, Boolean(pasado))}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                d.fecha === fecha
                  ? 'border-tinta-tenue bg-superficie-2 text-tinta-suave'
                  : 'border-borde-suave text-tinta-tenue hover:border-borde'
              }`}
            >
              {etiquetaDiaCorta(d.fecha)}
            </button>
          ),
        )}
      </div>

      {diaSeleccionado && horarios.length === 0 && (
        <div className="border-borde bg-superficie-2 mb-4 rounded-md border px-3 py-3 text-sm">
          <p className="text-tinta font-medium">
            {mensajeDelDia(diaSeleccionado, Boolean(pasado))}
          </p>
          {proximoLibre && (
            <p className="text-tinta-suave mt-1">
              El próximo día con lugar es el {fechaLegible(proximoLibre.fecha)}.{' '}
              <button
                type="button"
                onClick={() => onElegirFecha(proximoLibre.fecha)}
                className="text-miel font-semibold underline"
              >
                Ver ese día
              </button>
            </p>
          )}
        </div>
      )}

      {/* Solo cuando el día elegido ya pasó entero: si es hoy, los chips en ámbar ya
          dicen cuáles pasaron y cuáles no, y el cartel sobraría. */}
      {pasado && fecha && fecha < pasado.hoy && horarios.length > 0 && (
        <p className="text-alerta mb-3 text-sm">
          Este día ya pasó — el turno que cargues se registra como atendido.
        </p>
      )}

      {manana.length > 0 && (
        <FranjaHorarios
          etiqueta="Mañana"
          horarios={manana}
          hora={hora}
          onElegirHora={onElegirHora}
          pasado={pasado}
          fecha={fecha}
        />
      )}
      {tarde.length > 0 && (
        <FranjaHorarios
          etiqueta="Tarde"
          horarios={tarde}
          hora={hora}
          onElegirHora={onElegirHora}
          pasado={pasado}
          fecha={fecha}
        />
      )}
    </>
  )
}

// La partición Mañana/Tarde no se toca aunque haya horas pasadas: es la lectura que Ariel
// tiene incorporada de la planilla, y un tercer grupo "Ya pasó" en un día entero pasado
// se comería los otros dos.
function FranjaHorarios({
  etiqueta,
  horarios,
  hora,
  onElegirHora,
  pasado,
  fecha,
}: {
  etiqueta: string
  horarios: string[]
  hora: string | null
  onElegirHora: (hora: string) => void
  pasado?: MarcaDePasado
  fecha: string | null
}) {
  return (
    <div className="mb-4">
      <p className="text-tinta-tenue mb-2 text-xs tracking-wide uppercase">
        {etiqueta}
      </p>
      <div className="flex flex-wrap gap-2">
        {horarios.map((h) => {
          const esPasado = Boolean(
            pasado && fecha && yaPaso(fecha, h, pasado.hoy, pasado.minutosAhora),
          )
          return (
            <Chip
              key={h}
              selected={h === hora}
              tono={esPasado ? 'pasado' : 'normal'}
              title={esPasado ? 'Este horario ya pasó' : undefined}
              onClick={() => onElegirHora(h)}
            >
              {h}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}
