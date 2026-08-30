import { describe, it, expect } from 'vitest'
import { migasDePieza } from './meta'
import { faqJsonLd, PREGUNTAS } from './preguntas'

const pieza = {
  id: '235cde01-0649-4b7a-b603-8a8263c45b73',
  name: 'Anillo solitario clásico',
  category: 'Anillos',
}

describe('migasDePieza', () => {
  it('lleva el camino entero: inicio, catálogo, categoría y pieza', () => {
    const m = migasDePieza(pieza)
    expect(m.itemListElement.map((p) => p.name))
      .toEqual(['Inicio', 'Catálogo', 'Anillos', 'Anillo solitario clásico'])
    expect(m.itemListElement.map((p) => p.position)).toEqual([1, 2, 3, 4])
  })

  it('el último peldaño va sin enlace: es la página donde ya estás', () => {
    const ultimo = migasDePieza(pieza).itemListElement.at(-1)
    expect(ultimo.item).toBeUndefined()
  })

  it('las URLs van con www, como la canónica', () => {
    /* Sin www eran otra identidad para Google. Es el mismo cuidado que ya
       tiene `offers.url`. */
    const m = migasDePieza(pieza)
    expect(m.itemListElement[1].item).toBe('https://www.auremgsjoyeria.com/catalogo')
    expect(m.itemListElement[2].item).toBe('https://www.auremgsjoyeria.com/catalogo?categoria=Anillos')
  })

  it('una categoría con espacios o acentos viaja escapada', () => {
    const m = migasDePieza({ ...pieza, category: 'Juegos y sets' })
    expect(m.itemListElement[2].item).toContain('categoria=Juegos%20y%20sets')
  })

  it('sin categoría se salta ese peldaño, no lo inventa', () => {
    const m = migasDePieza({ ...pieza, category: null })
    expect(m.itemListElement.map((p) => p.name))
      .toEqual(['Inicio', 'Catálogo', 'Anillo solitario clásico'])
  })

  it('sin pieza no publica nada', () => {
    expect(migasDePieza(null)).toBe(null)
    expect(migasDePieza({ name: 'Sin id' })).toBe(null)
  })
})

describe('faqJsonLd', () => {
  it('publica exactamente las preguntas que se ven, con su respuesta entera', () => {
    /* Publicar una respuesta que la página no enseña —o enseñarla recortada—
       es contenido oculto para Google, y cuesta la ficha enriquecida. */
    const ld = faqJsonLd()
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity).toHaveLength(PREGUNTAS.length)
    expect(ld.mainEntity.map((q) => q.name)).toEqual(PREGUNTAS.map((p) => p.question))
    expect(ld.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(PREGUNTAS.map((p) => p.answer))
  })

  it('cada pregunta lleva su tipo, o Google no la lee', () => {
    for (const q of faqJsonLd().mainEntity) {
      expect(q['@type']).toBe('Question')
      expect(q.acceptedAnswer['@type']).toBe('Answer')
      expect(q.name.trim()).not.toBe('')
      expect(q.acceptedAnswer.text.trim()).not.toBe('')
    }
  })
})
