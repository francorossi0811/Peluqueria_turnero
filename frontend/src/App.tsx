import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ReservarPage } from './pages/ReservarPage'
import { GestionTurnoPage } from './pages/GestionTurnoPage'
import { LoginPage } from './pages/admin/LoginPage'
import { RestablecerPage } from './pages/admin/RestablecerPage'
import { AdministradoresPage } from './pages/admin/AdministradoresPage'
import { AgendaPage } from './pages/admin/AgendaPage'
import { ClientesPage } from './pages/admin/ClientesPage'
import { CobrosPage } from './pages/admin/CobrosPage'
import { HorariosServiciosPage } from './pages/admin/HorariosServiciosPage'
import { CuentaPage } from './pages/admin/CuentaPage'
import { AdminLayout } from './components/admin/AdminLayout'
import { RequireAuth } from './components/admin/RequireAuth'
import { useTemaAdmin } from './lib/useTemaAdmin'

function GestionTurnoRoute() {
  const { id } = useParams<{ id: string }>()
  // `key={id}` fuerza a React a remontar la página cuando cambia el id (ej. después de
  // reprogramar) en vez de reusar la instancia vieja con estado local pegado.
  return <GestionTurnoPage key={id} id={id!} />
}

function App() {
  // Pinta el panel de oscuro y deja el lado del cliente en claro. Va acá y no en
  // `AdminLayout` porque `/admin/login` cuelga fuera de él — ver el comentario del hook.
  useTemaAdmin()

  return (
    <Routes>
      <Route path="/" element={<ReservarPage />} />
      <Route path="/turno/:id" element={<GestionTurnoRoute />} />

      <Route path="/admin/login" element={<LoginPage />} />
      {/* HU-26 — Fuera de `RequireAuth` a propósito: quien llega acá es justamente
          alguien que no puede entrar. El token de la URL es la credencial. */}
      <Route
        path="/admin/restablecer/:token"
        element={<RestablecerPage />}
      />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AgendaPage />} />
          <Route path="/admin/clientes" element={<ClientesPage />} />
          <Route path="/admin/cobros" element={<CobrosPage />} />
          <Route path="/admin/horarios" element={<HorariosServiciosPage />} />
          <Route path="/admin/cuenta" element={<CuentaPage />} />
          {/* HU-26 — La propia página redirige si el rol no alcanza. Quien decide de
              verdad es `requireSuperAdmin` en el backend: esto es para no dejar una
              pantalla vacía a la vista de nadie. */}
          <Route
            path="/admin/administradores"
            element={<AdministradoresPage />}
          />

          {/* Rutas viejas: "Servicios", "Horario" y "Buscar turno" eran páginas propias
              en el nav. Se redirigen en vez de borrarse porque Ariel vive en este panel
              y puede tener alguna guardada en favoritos. */}
          <Route
            path="/admin/servicios"
            element={<Navigate to="/admin/horarios" replace />}
          />
          <Route
            path="/admin/horario"
            element={<Navigate to="/admin/horarios" replace />}
          />
          <Route
            path="/admin/buscar"
            element={<Navigate to="/admin" replace />}
          />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
