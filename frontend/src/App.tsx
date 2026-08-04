import { Route, Routes, useParams } from 'react-router-dom'
import { ReservarPage } from './pages/ReservarPage'
import { GestionTurnoPage } from './pages/GestionTurnoPage'
import { LoginPage } from './pages/admin/LoginPage'
import { AgendaPage } from './pages/admin/AgendaPage'
import { ServiciosPage } from './pages/admin/ServiciosPage'
import { HorarioPage } from './pages/admin/HorarioPage'
import { BuscarTurnoPage } from './pages/admin/BuscarTurnoPage'
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
          <Route path="/admin/servicios" element={<ServiciosPage />} />
          <Route path="/admin/horario" element={<HorarioPage />} />
          <Route path="/admin/buscar" element={<BuscarTurnoPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
