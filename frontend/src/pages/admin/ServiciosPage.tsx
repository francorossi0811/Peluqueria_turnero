import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Kicker } from '../../components/ui/Kicker'
import { FilaServicio } from '../../components/admin/FilaServicio'
import { ModalServicio } from '../../components/admin/ModalServicio'
import { actualizarServicio, obtenerServiciosAdmin } from '../../api/servicios'
import type { ServicioAdmin } from '../../types/api'

export function ServiciosPage() {
  const queryClient = useQueryClient()
  const [modalNuevo, setModalNuevo] = useState(false)
  const [servicioEditar, setServicioEditar] = useState<ServicioAdmin | null>(
    null,
  )

  const serviciosQuery = useQuery({
    queryKey: ['servicios-admin'],
    queryFn: obtenerServiciosAdmin,
  })

  const cambiarActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      actualizarServicio(id, { activo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['servicios-admin'] })
    },
  })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Panel de Ariel</Kicker>
          <h1 className="font-hero text-tinta text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
            Servicios
          </h1>
        </div>
        <Button variant="primaryVino" onClick={() => setModalNuevo(true)}>
          + Nuevo servicio
        </Button>
      </div>

      {serviciosQuery.isPending && (
        <p className="text-tinta-suave">Cargando servicios…</p>
      )}
      {serviciosQuery.isError && (
        <p className="text-vino">No pudimos cargar los servicios.</p>
      )}

      {serviciosQuery.data && (
        <div className="flex flex-col gap-2">
          {serviciosQuery.data.map((s) => (
            <FilaServicio
              key={s.id}
              servicio={s}
              onEditar={() => setServicioEditar(s)}
              onCambiarActivo={() =>
                cambiarActivoMutation.mutate({ id: s.id, activo: !s.activo })
              }
              cambiando={
                cambiarActivoMutation.isPending &&
                cambiarActivoMutation.variables?.id === s.id
              }
            />
          ))}
        </div>
      )}

      {modalNuevo && <ModalServicio onClose={() => setModalNuevo(false)} />}
      {servicioEditar && (
        <ModalServicio
          servicio={servicioEditar}
          onClose={() => setServicioEditar(null)}
        />
      )}
    </div>
  )
}
