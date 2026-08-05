import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ReservarPage } from './pages/ReservarPage'
import { GestionTurnoPage } from './pages/GestionTurnoPage'
import { LoginPage } from './pages/admin/LoginPage'
import { AgendaPage } from './pages/admin/AgendaPage'
import { HorariosServiciosPage } from './pages/admin/HorariosServiciosPage'
import { CuentaPage } from './pages/admin/CuentaPage'
import { AdminLayout } from './components/admin/AdminLayout'
import { RequireAuth } from './components/admin/RequireAuth'

function GestionTurnoRoute() {
  const { id } = useParams<{ id: string }>()
  // `key={id}` fuerza a React a remontar la página cuando cambia el id (ej. después de
  // reprogramar) en vez de reusar la instancia vieja con estado local pegado.
  return <GestionTurnoPage key={id} id={id!} />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ReservarPage />} />
      <Route path="/turno/:id" element={<GestionTurnoRoute />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AgendaPage />} />
          <Route path="/admin/horarios" element={<HorariosServiciosPage />} />
          <Route path="/admin/cuenta" element={<CuentaPage />} />

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
