import { Navigate, Outlet } from 'react-router-dom'
import { getTokenValido } from '../../lib/authStorage'

export function RequireAuth() {
  // `getTokenValido` (y no `getToken`) para no renderizar el panel con un token vencido
  // y rebotar recién cuando el primer request devuelve 401.
  const token = getTokenValido()
  if (!token) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
