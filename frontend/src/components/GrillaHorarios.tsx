import { Chip } from './ui/Chip'
import { etiquetaDiaCorta } from '../utils/fecha'
import type { DisponibilidadDia } from '../types/api'

interface GrillaHorariosProps {
  dias: DisponibilidadDia[]
  fecha: string | null
  hora: string | null
  onElegirFecha: (fecha: string) => void
  onElegirHora: (hora: string) => void
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
        No hay horarios disponibles en las próximas dos semanas.
      </p>
    )
  }

  const diaSeleccionado = dias.find((d) => d.fecha === fecha)
  const horarios = diaSeleccionado?.horarios ?? []
  const manana = horarios.filter((h) => h < '13:00')
  const tarde = horarios.filter((h) => h >= '13:00')

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {diasConHorarios.map((d) => (
          <Chip
            key={d.fecha}
            selected={d.fecha === fecha}
            onClick={() => onElegirFecha(d.fecha)}
          >
            {etiquetaDiaCorta(d.fecha)}
          </Chip>
        ))}
      </div>

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
