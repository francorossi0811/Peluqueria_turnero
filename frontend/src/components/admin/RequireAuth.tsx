import { Navigate, Outlet } from 'react-router-dom'
import { getToken } from '../../lib/authStorage'

export function RequireAuth() {
  const token = getToken()
  if (!token) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
