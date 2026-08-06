import { Chip } from './ui/Chip'
import { etiquetaDiaCorta, fechaLegible } from '../utils/fecha'
import type { DisponibilidadDia } from '../types/api'

interface GrillaHorariosProps {
  dias: DisponibilidadDia[]
  fecha: string | null
  hora: string | null
  onElegirFecha: (fecha: string) => void
  onElegirHora: (hora: string) => void
}

/** Qué se le dice al cliente cuando el día que eligió no tiene horarios.
 *
 * Antes todos estos casos caían en el mismo "no hay turnos": el que se topaba con las
 * vacaciones de Ariel y el que llegó tarde a un día lleno leían lo mismo, y ninguno de
 * los dos sabía qué hacer después. */
function mensajeDelDia(dia: DisponibilidadDia): string {
  switch (dia.estado) {
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
    case 'completo':
      return 'Se ocuparon todos los turnos de este día.'
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
}: GrillaHorariosProps) {
  const diasConHorarios = dias.filter((d) => d.horarios.length > 0)

  if (diasConHorarios.length === 0) {
    return (
      <p className="text-tinta-suave">
        No hay horarios disponibles en las próximas dos semanas. Escribile a
        Ariel por WhatsApp y coordinan directamente.
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
              onClick={() => onElegirFecha(d.fecha)}
            >
              {etiquetaDiaCorta(d.fecha)}
            </Chip>
          ) : (
            <button
              key={d.fecha}
              type="button"
              onClick={() => onElegirFecha(d.fecha)}
              title={mensajeDelDia(d)}
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
            {mensajeDelDia(diaSeleccionado)}
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

      {manana.length > 0 && (
        <FranjaHorarios
          etiqueta="Mañana"
          horarios={manana}
          hora={hora}
          onElegirHora={onElegirHora}
        />
      )}
      {tarde.length > 0 && (
        <FranjaHorarios
          etiqueta="Tarde"
          horarios={tarde}
          hora={hora}
          onElegirHora={onElegirHora}
        />
      )}
    </>
  )
}

function FranjaHorarios({
  etiqueta,
  horarios,
  hora,
  onElegirHora,
}: {
  etiqueta: string
  horarios: string[]
  hora: string | null
  onElegirHora: (hora: string) => void
}) {
  return (
    <div className="mb-4">
      <p className="text-tinta-tenue mb-2 text-xs tracking-wide uppercase">
        {etiqueta}
      </p>
      <div className="flex flex-wrap gap-2">
        {horarios.map((h) => (
          <Chip key={h} selected={h === hora} onClick={() => onElegirHora(h)}>
            {h}
          </Chip>
        ))}
      </div>
    </div>
  )
}
