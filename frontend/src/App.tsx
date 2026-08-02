import { Route, Routes } from 'react-router-dom'
import { ReservarPage } from './pages/ReservarPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ReservarPage />} />
    </Routes>
  )
}

export default App
