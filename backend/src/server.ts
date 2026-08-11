import 'dotenv/config'
import { app } from './app'
import { validarEnvAlArrancar } from './config/env'
import { sincronizarFeriadosPendientes } from './services/feriados.service'

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

  // HU-24 — Carga los feriados que falten (año actual y siguiente) desde la fuente
  // externa. Va acá y no antes del `listen`, y sin `await`, a propósito: una API de
  // terceros lenta o caída no puede demorar el arranque ni impedir que Ariel atienda.
  // La función se traga sus propios errores por el mismo motivo.
  void sincronizarFeriadosPendientes()
})
