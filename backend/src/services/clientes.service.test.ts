import { describe, expect, it } from 'vitest'
import { ordenarPorNombreVisible } from './clientes.service'

const nombres = (lista: { apodo: string | null; nombre: string }[]) =>
  ordenarPorNombreVisible(lista).map((c) => c.apodo || c.nombre)

describe('ordenarPorNombreVisible', () => {
  it('mezcla los que tienen apodo con los que no, en vez de ponerlos en dos tandas', () => {
    expect(
      nombres([
        { apodo: 'Zurdo', nombre: 'Juan Pérez' },
        { apodo: null, nombre: 'Bruno Díaz' },
        { apodo: 'Flaco', nombre: 'Pedro Gómez' },
        { apodo: null, nombre: 'Ana López' },
      ]),
    ).toEqual(['Ana López', 'Bruno Díaz', 'Flaco', 'Zurdo'])
  })

  it('ordena por el apodo y no por el nombre cuando hay apodo', () => {
    expect(
      nombres([
        { apodo: 'Tano', nombre: 'Andrés Rossi' },
        { apodo: null, nombre: 'Martín Sosa' },
      ]),
    ).toEqual(['Martín Sosa', 'Tano'])
  })

  it('no distingue mayúsculas ni tildes', () => {
    expect(
      nombres([
        { apodo: null, nombre: 'bruno' },
        { apodo: null, nombre: 'Álvaro' },
        { apodo: null, nombre: 'Carlos' },
        { apodo: null, nombre: 'ana' },
      ]),
    ).toEqual(['Álvaro', 'ana', 'bruno', 'Carlos'])
  })

  it('no modifica la lista que recibe', () => {
    const lista = [
      { apodo: null, nombre: 'B' },
      { apodo: null, nombre: 'A' },
    ]
    ordenarPorNombreVisible(lista)
    expect(lista.map((c) => c.nombre)).toEqual(['B', 'A'])
  })
})
