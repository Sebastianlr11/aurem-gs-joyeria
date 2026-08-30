import { describe, it, expect } from 'vitest'
import { choqueDeNombre } from './nombreUnico'

const catalogo = [
  { id: '1', name: 'Anillo solitario clásico' },
  { id: '2', name: 'Dije cruz de esmeraldas' },
  { id: '3', name: 'Topos de esmeralda' },
]

describe('choqueDeNombre', () => {
  it('deja pasar un nombre que no se parece a ninguno', () => {
    expect(choqueDeNombre('Pulsera de San Benito', catalogo)).toBe(null)
  })

  it('avisa cuando el nombre nuevo cabe dentro de uno que ya está', () => {
    /* Valentina buscaría «Anillo solitario» y le saldrían dos: se queda sin
       poder mandar ninguna de las dos fotos. */
    expect(choqueDeNombre('Anillo solitario', catalogo)?.id).toBe('1')
  })

  it('avisa también al revés: cuando el nuevo se traga a uno que ya está', () => {
    expect(choqueDeNombre('Topos de esmeralda en oro 18k', catalogo)?.id).toBe('3')
  })

  it('no distingue mayúsculas ni espacios de sobra', () => {
    expect(choqueDeNombre('  ANILLO SOLITARIO CLÁSICO ', catalogo)?.id).toBe('1')
  })

  it('una pieza no choca consigo misma al editarla', () => {
    expect(choqueDeNombre('Anillo solitario clásico', catalogo, '1')).toBe(null)
  })

  it('aguanta lo que no llegó y los nombres vacíos', () => {
    expect(choqueDeNombre('', catalogo)).toBe(null)
    expect(choqueDeNombre('Anillo nuevo', null)).toBe(null)
    expect(choqueDeNombre('Anillo nuevo', [null, { id: '9' }, { id: '8', name: '' }])).toBe(null)
  })
})
