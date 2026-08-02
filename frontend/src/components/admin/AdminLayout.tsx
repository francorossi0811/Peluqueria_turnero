import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearToken } from '../../lib/authStorage'

const NAV = [
  { to: '/admin', label: 'Agenda' },
  { to: '/admin/servicios', label: 'Servicios' },
  { to: '/admin/horario', label: 'Horario' },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  function salir() {
    clearToken()
    navigate('/admin/login')
  }

  return (
    <div className="bg-fondo min-h-screen">
      <header className="border-borde border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-tinta-suave text-xs font-medium tracking-wide uppercase">
              La Peluquería de Ariel Enrique
            </p>
            <p className="font-display text-tinta text-lg font-semibold">
              Panel de Ariel
            </p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  location.pathname === item.to
                    ? 'bg-vino-suave text-vino'
                    : 'text-tinta-suave hover:text-tinta'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={salir}
              className="text-tinta-suave hover:text-tinta ml-2 rounded-md px-3 py-2 text-sm"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
