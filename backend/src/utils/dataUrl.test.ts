import { describe, expect, it } from 'vitest'
import { decodificarDataUrl, MAX_BYTES } from './dataUrl'

// Un PNG mínimo de verdad (1x1 transparente), en base64.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function dataUrl(mime: string, base64 = PNG_1X1) {
  return `data:${mime};base64,${base64}`
}

// HU-29 — Lo que decide si una subida entra. Es la única puerta entre lo que manda el panel y
// lo que se guarda, así que lo que importa fijar son los casos de entrada rota.
describe('decodificarDataUrl', () => {
  it('acepta los tres formatos de foto', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(decodificarDataUrl(dataUrl(mime)).ok, mime).toBe(true)
    }
  })

  it('devuelve el binario y su peso, no la cadena', () => {
    const r = decodificarDataUrl(dataUrl('image/png'))
    if (!r.ok) throw new Error('debería haber entrado')

    expect(r.imagen.mimeType).toBe('image/png')
    expect(r.imagen.bytes).toBe(r.imagen.datos.length)
    // Los primeros bytes de cualquier PNG. Confirma que se decodificó y no se guardó base64.
    expect([...r.imagen.datos.slice(0, 4)]).toEqual([137, 80, 78, 71])
  })

  // ⚠️ El caso que más importa de todos: un SVG es un documento que puede traer <script>, y se
  // sirve desde nuestro propio dominio. Aceptarlo sería XSS, no una foto fea.
  it('rechaza SVG aunque sea un image/*', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64')
    const r = decodificarDataUrl(dataUrl('image/svg+xml', svg))

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('formato')
  })

  it('rechaza lo que no es una imagen', () => {
    expect(decodificarDataUrl(dataUrl('application/pdf')).ok).toBe(false)
    expect(decodificarDataUrl(dataUrl('text/html')).ok).toBe(false)
  })

  it('rechaza lo que ni siquiera es una data URL', () => {
    expect(decodificarDataUrl('https://ejemplo.com/foto.jpg').ok).toBe(false)
    expect(decodificarDataUrl('').ok).toBe(false)
    // Sin `;base64` no sabemos cómo leer el contenido.
    expect(decodificarDataUrl('data:image/png,algo').ok).toBe(false)
  })

  it('rechaza el base64 que no decodifica en nada', () => {
    // `Buffer.from` no tira error con basura: descarta lo que no entiende y puede devolver
    // vacío. Sin el chequeo de largo, esto entraría como una imagen de 0 bytes.
    const r = decodificarDataUrl(dataUrl('image/png', '!!!!'))

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('formato')
  })

  // Los dos bordes del peso, juntos: fijar solo uno deja lugar a que el otro se corra.
  it('acepta una imagen justo en el límite de peso', () => {
    const justa = Buffer.alloc(MAX_BYTES).toString('base64')
    expect(decodificarDataUrl(dataUrl('image/jpeg', justa)).ok).toBe(true)
  })

  it('rechaza la que se pasa por un byte, y lo distingue del formato', () => {
    const pasada = Buffer.alloc(MAX_BYTES + 1).toString('base64')
    const r = decodificarDataUrl(dataUrl('image/jpeg', pasada))

    expect(r.ok).toBe(false)
    // El motivo importa: "achicá la foto" y "cambiá el formato" mandan a hacer cosas
    // distintas, y un único "imagen inválida" dejaría a Ariel adivinando.
    if (!r.ok) expect(r.motivo).toBe('peso')
  })
})
