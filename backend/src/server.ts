import 'dotenv/config'
import { app } from './app'
import { validarEnvAlArrancar } from './config/env'

const PORT = process.env.PORT ?? 3000

// Antes de escuchar: si falta algo crítico, morir con un mensaje legible en vez de
// levantar mal configurado (ver config/env.ts).
try {
  validarEnvAlArrancar()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`)
})
