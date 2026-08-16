import { describe, expect, it } from 'vitest'
import { fotoDeServicio } from './servicios.controller'

// HU-29 — Qué foto se muestra de un servicio. Hay tres orígenes y la regla de prioridad entre
// ellos no es evidente leyendo el modelo: `servicios.foto` (la ruta estática) y la fila de
// `imagenes` (la que subió Ariel) pueden existir las dos a la vez.
describe('fotoDeServicio', () => {
  const ESTATICA = '/imagenes/servicio-corte.jpg'

  it('sin nada cargado devuelve null, y el frontend cae al stock', () => {
    expect(fotoDeServicio({ foto: null, imagen: null })).toBeNull()
  })

  it('usa la ruta estática cuando es lo único que hay', () => {
    expect(fotoDeServicio({ foto: ESTATICA, imagen: null })).toBe(ESTATICA)
  })

  it('la foto subida gana sobre la estática', () => {
    // El caso real de los 4 servicios originales: ya traen su archivo en el repo, y el día que
    // Ariel les suba una desde el panel tiene que verse la nueva. Si ganara la estática, la
    // subida no haría nada visible y parecería que el panel no guarda.
    expect(fotoDeServicio({ foto: ESTATICA, imagen: { id: 'abc' } })).toBe(
      '/api/imagenes/abc',
    )
  })

  it('la foto subida también sirve cuando no hay estática', () => {
    expect(fotoDeServicio({ foto: null, imagen: { id: 'abc' } })).toBe(
      '/api/imagenes/abc',
    )
  })
})
