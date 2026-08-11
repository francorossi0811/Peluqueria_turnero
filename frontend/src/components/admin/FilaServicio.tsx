import { Button } from '../ui/Button'
import { formatearPesos } from '../../utils/dinero'
import type { ServicioAdmin } from '../../types/api'

interface FilaServicioProps {
  servicio: ServicioAdmin
  onEditar: () => void
  onCambiarActivo: () => void
  cambiando: boolean
}

export function FilaServicio({
  servicio,
  onEditar,
  onCambiarActivo,
  cambiando,
}: FilaServicioProps) {
  return (
    <div className="border-borde bg-superficie-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-tinta font-medium">{servicio.nombre}</p>
        {/* HU-27 — El precio al lado de la duración: son las dos cosas que Ariel viene a
            mirar acá. "Sin precio" se dice con todas las letras en vez de dejar el hueco,
            porque es lo que hace que el modal de cobro no le prellene nada. */}
        <p className="text-tinta-suave text-sm">
          {servicio.duracionMinutos} min
          <span className="text-tinta-tenue"> · </span>
          {servicio.precio === null ? (
            <span className="text-tinta-tenue italic">Sin precio</span>
          ) : (
            formatearPesos(servicio.precio)
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
            servicio.activo
              ? 'bg-bien-suave text-bien'
              : 'bg-borde-suave text-tinta-tenue'
          }`}
        >
          {servicio.activo ? 'Activo' : 'Inactivo'}
        </span>
        <Button variant="outline" onClick={onEditar}>
          Editar
        </Button>
        <Button
          variant="outline"
          disabled={cambiando}
          onClick={onCambiarActivo}
        >
          {cambiando
            ? 'Guardando…'
            : servicio.activo
              ? 'Desactivar'
              : 'Activar'}
        </Button>
      </div>
    </div>
  )
}
