import { describe, expect, it } from 'vitest'
import { debeCerrarSesion } from './client'

const VIEJO = 'token.viejo.abc'
const NUEVO = 'token.nuevo.xyz'

describe('debeCerrarSesion', () => {
  it('cierra la sesión con un 401 del token que está guardado', () => {
    expect(debeCerrarSesion(401, NUEVO, NUEVO)).toBe(true)
  })

  // ⚠️ El que fija el bug de producción (3/9/2026): "me logueo y a los segundos me
  // desloguea". El panel arranca con la sesión vencida y dispara sus requests; Ariel entra
  // y se guarda un token nuevo; los 401 de aquellos requests llegan **después** y, sin esta
  // guarda, borran la sesión recién abierta.
  it('NO cierra la sesión nueva por un 401 que traía el token viejo', () => {
    expect(debeCerrarSesion(401, VIEJO, NUEVO)).toBe(false)
  })

  it('no hace nada si ya no hay token guardado', () => {
    expect(debeCerrarSesion(401, VIEJO, null)).toBe(false)
  })

  it('solo mira los 401: un 403 no cierra la sesión', () => {
    // `requireSuperAdmin` responde 403 (HU-26). Ariel entrando a una sección que no le
    // corresponde no puede quedar afuera del panel entero.
    expect(debeCerrarSesion(403, NUEVO, NUEVO)).toBe(false)
  })

  it('tampoco un 409, que es el error más común de la app', () => {
    expect(debeCerrarSesion(409, NUEVO, NUEVO)).toBe(false)
  })

  it('un request sin Authorization no cierra una sesión válida', () => {
    expect(debeCerrarSesion(401, '', NUEVO)).toBe(false)
  })
})
