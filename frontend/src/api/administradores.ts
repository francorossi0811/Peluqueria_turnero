import { apiClient } from './client'
import type { AdministradorResumen, RolAdmin } from '../types/api'

// HU-26 — Solo el super admin puede llamar estos endpoints. El panel además esconde la
// sección, pero eso es comodidad: la que decide es la autorización del backend.

export async function obtenerAdministradores(): Promise<
  AdministradorResumen[]
> {
  const { data } = await apiClient.get<{
    administradores: AdministradorResumen[]
  }>('/admin/administradores')
  return data.administradores
}

export async function crearAdministrador(datos: {
  usuario: string
  email: string
  password: string
  rol: RolAdmin
}): Promise<AdministradorResumen> {
  const { data } = await apiClient.post<AdministradorResumen>(
    '/admin/administradores',
    datos,
  )
  return data
}

/** El super admin le fija una contraseña a otra cuenta. Es la recuperación que funciona
 * aunque el mail no salga. Cierra las sesiones abiertas de esa cuenta. */
export async function resetearPasswordDe(
  id: string,
  passwordNueva: string,
): Promise<void> {
  await apiClient.patch(`/admin/administradores/${id}/password`, {
    passwordNueva,
  })
}

/** Corrige el nombre o el email de una cuenta. Sin esto, un email mal cargado no se podía
 * cambiar por ningún lado — y como el login es por email, eso deja la cuenta rota. */
export async function actualizarAdministrador(
  id: string,
  datos: { usuario?: string; email?: string },
): Promise<void> {
  await apiClient.patch(`/admin/administradores/${id}`, datos)
}

export async function cambiarRolDe(id: string, rol: RolAdmin): Promise<void> {
  await apiClient.patch(`/admin/administradores/${id}/rol`, { rol })
}

/** Borra una cuenta. Sus sesiones dejan de valer solas: el middleware rechaza cualquier
 * token cuya fila ya no exista. */
export async function eliminarAdministrador(id: string): Promise<void> {
  await apiClient.delete(`/admin/administradores/${id}`)
}
