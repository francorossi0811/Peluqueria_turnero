import { Link, Outlet, useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import {
  IconoAgenda,
  IconoPersona,
  IconoReloj,
} from '../ui/Iconos'

// Tres destinos, no cinco. "Buscar turno" pasó a ser un modal dentro de la agenda (es
// una acción sobre la agenda, no una sección aparte) y "Servicios" se juntó con
// "Horario": las dos son configuración de cómo trabaja Ariel, y ninguna se toca seguido.
// "Salir" salió del nav a propósito — es una acción destructiva de sesión y no merece
// estar a un click de distancia todo el día; vive abajo de todo en "Mi cuenta".
const NAV: {
  to: string
  label: string
  Icono: ComponentType<{ className?: string }>
}[] = [
  { to: '/admin', label: 'Agenda', Icono: IconoAgenda },
  { to: '/admin/horarios', label: 'Horarios y servicios', Icono: IconoReloj },
  { to: '/admin/cuenta', label: 'Mi cuenta', Icono: IconoPersona },
]

export function AdminLayout() {
  const location = useLocation()

  return (
    <div className="bg-fondo min-h-screen">
      <header className="border-borde border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          {/* Solo el nombre del local. "Panel de Ariel" ya lo dice el kicker de cada
              página, y repetirlo acá arriba no aporta: si está viendo esta pantalla,
              sabe perfectamente en qué panel está. */}
          <p className="font-hero text-tinta text-lg font-semibold">
            La Peluquería de Ariel Enrique
          </p>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map(({ to, label, Icono }) => (
              <Link
                key={to}
                to={to}
                aria-current={location.pathname === to ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  location.pathname === to
                    ? 'bg-miel-suave text-miel'
                    : 'text-tinta-suave hover:text-tinta'
                }`}
              >
                <Icono />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
