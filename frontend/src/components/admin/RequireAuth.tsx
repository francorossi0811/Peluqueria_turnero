import { Navigate, Outlet } from 'react-router-dom'
import {
  getToken,
  getTokenValido,
  marcarSesionVencida,
} from '../../lib/authStorage'

export function RequireAuth() {
  // `getTokenValido` (y no `getToken`) para no renderizar el panel con un token vencido
  // y rebotar recién cuando el primer request devuelve 401.
  //
  // ⚠️ `getToken()` **antes**, porque `getTokenValido` borra el token vencido al leerlo:
  // preguntar después no permitiría distinguir "venció la sesión" de "nunca entró", y son
  // dos cosas distintas para quien está mirando la pantalla.
  const habiaToken = Boolean(getToken())
  const token = getTokenValido()
  if (!token) {
    if (habiaToken) marcarSesionVencida()
    return <Navigate to="/admin/login" replace />
  }
  return <Outlet />
}
