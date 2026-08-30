import { describe, it, expect } from 'vitest'
import { coleccionesDe, punzonDe } from './colecciones'

/* Una pieza de mentira, con lo mínimo que mira `coleccionesDe`. */
const pieza = (category, extra = {}) => ({
  category,
  name: `Pieza de ${category}`,
  image_url: 'https://x/img-1254x1254.webp',
  metal: 'Plata 925',
  stock: null,
  created_at: '2026-08-01T00:00:00Z',
  ...extra,
})

describe('coleccionesDe', () => {
  it('no enseña una categoría vacía — el fallo que la trajo', () => {
    /* La portada ofrecía «Collares» y el catálogo no tenía ni uno: el clic
       llevaba a una vitrina vacía. */
    const cs = coleccionesDe([pieza('Anillos'), pieza('Dijes')])
    expect(cs.map((c) => c.categoria)).toEqual(['Anillos', 'Dijes'])
  })

  it('tampoco enseña una categoría cuyas piezas no tienen foto', () => {
    const cs = coleccionesDe([pieza('Anillos'), pieza('Topos', { image_url: null })])
    expect(cs.map((c) => c.categoria)).toEqual(['Anillos'])
  })

  it('ordena por cuántas piezas hay', () => {
    const cs = coleccionesDe([
      pieza('Dijes'), pieza('Dijes'),
      pieza('Anillos'), pieza('Anillos'), pieza('Anillos'),
      pieza('Topos'),
    ])
    expect(cs.map((c) => c.categoria)).toEqual(['Anillos', 'Dijes', 'Topos'])
  })

  it('rompe el empate con el orden del riel del catálogo', () => {
    // Topos va antes que Dijes en la lista, aunque aquí llegue después.
    const cs = coleccionesDe([pieza('Dijes'), pieza('Topos')])
    expect(cs.map((c) => c.categoria)).toEqual(['Topos', 'Dijes'])
  })

  it('sólo entrega las que caben en la rejilla', () => {
    const muchas = ['Anillos', 'Collares', 'Aretes', 'Topos', 'Pulseras'].map((c) => pieza(c))
    expect(coleccionesDe(muchas, 3)).toHaveLength(3)
  })

  it('pone de cara la pieza más reciente', () => {
    const cs = coleccionesDe([
      pieza('Anillos', { name: 'La vieja', created_at: '2026-01-01T00:00:00Z' }),
      pieza('Anillos', { name: 'La nueva', created_at: '2026-08-20T00:00:00Z' }),
    ])
    expect(cs[0].alt).toBe('La nueva')
  })

  it('no pone de cara una pieza agotada si hay otra disponible', () => {
    const cs = coleccionesDe([
      pieza('Anillos', { name: 'Agotada', stock: 0, created_at: '2026-08-20T00:00:00Z' }),
      pieza('Anillos', { name: 'Disponible', stock: 3, created_at: '2026-01-01T00:00:00Z' }),
    ])
    expect(cs[0].alt).toBe('Disponible')
  })

  it('aguanta la lista vacía y la que no llegó', () => {
    expect(coleccionesDe([])).toEqual([])
    expect(coleccionesDe(null)).toEqual([])
  })

  it('ignora una categoría que no está en la lista del catálogo', () => {
    const cs = coleccionesDe([pieza('Relojes'), pieza('Anillos')])
    expect(cs.map((c) => c.categoria)).toEqual(['Anillos'])
  })

  it('cuenta todas las piezas de la categoría, tengan foto o no', () => {
    const cs = coleccionesDe([pieza('Anillos'), pieza('Anillos', { image_url: null })])
    expect(cs[0].piezas).toBe(2)
  })
})

describe('punzonDe', () => {
  it('con un solo metal lo dice entero', () => {
    expect(punzonDe([pieza('Anillos', { metal: 'Plata 925' })])).toBe('Plata 925')
  })

  it('con dos oros sube a la familia — el sello no da para más', () => {
    expect(punzonDe([
      pieza('Anillos', { metal: 'Oro 18k' }),
      pieza('Anillos', { metal: 'Oro blanco 18k' }),
    ])).toBe('Oro')
  })

  it('con oro y plata lo dice así', () => {
    expect(punzonDe([
      pieza('Anillos', { metal: 'Oro 18k' }),
      pieza('Anillos', { metal: 'Plata 925' }),
    ])).toBe('Oro y plata')
  })

  it('sin metal anotado no se inventa uno', () => {
    /* Nueve de los veinte anillos del catálogo tienen el metal vacío. Un
       sello que diga «Oro 18k» sobre una vitrina de plata es la misma
       promesa que hubo que quitar del JSON-LD de la portada. */
    expect(punzonDe([pieza('Anillos', { metal: null }), pieza('Anillos', { metal: '  ' })])).toBe(null)
  })
})
