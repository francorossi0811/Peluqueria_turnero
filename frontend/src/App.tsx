import { Route, Routes, useParams } from 'react-router-dom'
import { ReservarPage } from './pages/ReservarPage'
import { GestionTurnoPage } from './pages/GestionTurnoPage'

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
    </Routes>
  )
}

export default App
