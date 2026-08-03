import { Outlet } from 'react-router-dom'

// Envuelve las rutas de cliente en la paleta gris/blanco/negro + miel (ver
// `.tema-cliente` en index.css) sin afectar al panel de admin.
export function ClienteLayout() {
  return (
    <div className="tema-cliente">
      <Outlet />
    </div>
  )
}
