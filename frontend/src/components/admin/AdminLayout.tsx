import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  IconoAgenda,
  IconoClientes,
  IconoCobros,
  IconoLlave,
  IconoPersona,
  IconoReloj,
} from '../ui/Iconos'
import { obtenerMe } from '../../api/auth'
import { registrarServiceWorker, soportaPush } from '../../lib/push'

// Cuatro destinos. "Buscar turno" pasó a ser un modal dentro de la agenda (es una acción
// sobre la agenda, no una sección aparte) y "Servicios" se juntó con "Horario": las dos
// son configuración de cómo trabaja Ariel, y ninguna se toca seguido. "Salir" salió del
// nav a propósito — es una acción destructiva de sesión y no merece estar a un click de
// distancia todo el día; vive abajo de todo en "Mi cuenta".
//
// "Clientes" (HU-25) sí es una sección propia y no un modal de la agenda, al revés que
// "Buscar turno": Ariel se queda ahí un rato — repasa fichas, pone apodos, etiqueta — en
// vez de entrar a resolver una cosa puntual y salir.
//
// "Cobros" (HU-27) sigue el mismo criterio y por eso no es un pie de la agenda: la agenda
// se mira turno por turno y la plata se mira sumada.
//
// El orden lo eligió Ariel y sigue su día: primero la agenda, después los cobros —las dos
// cosas que toca todos los días, y la segunda es la otra lectura de la primera—, después
// las fichas, y al final lo que casi no se toca.
const NAV: {
  to: string
  label: string
  Icono: ComponentType<{ className?: string }>
  /** HU-26 — Solo para el super admin. Esconder el ítem es comodidad: quien decide es
   * `requireSuperAdmin` en el backend. */
  soloSuperAdmin?: boolean
}[] = [
  { to: '/admin', label: 'Agenda', Icono: IconoAgenda },
  { to: '/admin/cobros', label: 'Cobros', Icono: IconoCobros },
  { to: '/admin/clientes', label: 'Clientes', Icono: IconoClientes },
  { to: '/admin/horarios', label: 'Horarios y servicios', Icono: IconoReloj },
  { to: '/admin/cuenta', label: 'Mi cuenta', Icono: IconoPersona },
  {
    to: '/admin/administradores',
    label: 'Administradores',
    Icono: IconoLlave,
    soloSuperAdmin: true,
  },
]

export function AdminLayout() {
  const location = useLocation()

  // El rol, para saber qué ítems del nav mostrar. `staleTime` largo: no cambia durante
  // una sesión, y esta query la comparten el nav, "Mi cuenta" y "Administradores".
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: obtenerMe,
    staleTime: 60 * 60 * 1000,
  })
  const esSuperAdmin = meQuery.data?.rol === 'super_admin'

  // El service worker se registra al abrir el panel, no recién al tocar "Activar
  // avisos". Dos motivos: es lo que hace que un `sw.js` corregido llegue al dispositivo
  // de Ariel (si no, un arreglo espera hasta la próxima vez que toque ese botón, o sea
  // quizás nunca), y es lo que mantiene vivo el handler que renueva la suscripción
  // cuando el navegador la rota por su cuenta.
  useEffect(() => {
    if (!soportaPush()) return
    void registrarServiceWorker().catch((err) => {
      console.error('[push] no se pudo registrar el service worker', err)
    })
  }, [])

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
            {NAV.filter((item) => !item.soloSuperAdmin || esSuperAdmin).map(({ to, label, Icono }) => (
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
