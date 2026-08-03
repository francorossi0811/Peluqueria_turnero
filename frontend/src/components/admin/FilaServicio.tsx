import { Button } from '../ui/Button'
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
        <p className="text-tinta-suave text-sm">
          {servicio.duracionMinutos} min
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
