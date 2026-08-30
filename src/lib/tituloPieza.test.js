import { describe, it, expect } from 'vitest'
import { tituloDePieza } from './tituloPieza'

const MAXIMO = 60

describe('tituloDePieza', () => {
  it('mete la piedra y el metal cuando caben', () => {
    const t = tituloDePieza({ name: 'Dije redondo', metal: 'Plata 925', piedra: 'esmeralda natural' })
    expect(t).toBe('Dije redondo con esmeralda natural en Plata 925 | Aurem Gs')
    expect(t.length).toBeLessThanOrEqual(MAXIMO)
  })

  it('suelta el metal antes que la piedra: quien busca esto busca esmeralda', () => {
    const t = tituloDePieza({
      name: 'Anillo solitario clásico',
      metal: 'Plata 925',
      piedra: 'esmeralda natural',
    })
    expect(t).toBe('Anillo solitario clásico con esmeralda natural | Aurem Gs')
    expect(t.length).toBeLessThanOrEqual(MAXIMO)
  })

  it('con un nombre largo se queda con la piedra a secas', () => {
    const t = tituloDePieza({
      name: 'Anillo solitario de banda partida',
      metal: 'Plata 925',
      piedra: 'esmeralda natural',
    })
    expect(t).toBe('Anillo solitario de banda partida con esmeralda | Aurem Gs')
    expect(t.length).toBeLessThanOrEqual(MAXIMO)
  })

  it('corta la ficha técnica de la piedra en la primera coma', () => {
    const t = tituloDePieza({
      name: 'Dije redondo',
      piedra: 'Esmeralda natural colombiana, circones',
    })
    expect(t).toBe('Dije redondo con esmeralda natural colombiana | Aurem Gs')
  })

  it('no repite la piedra si el nombre ya la dice', () => {
    /* «Dije cruz de esmeraldas con esmeraldas naturales» era el título que
       salía de la primera versión. */
    expect(tituloDePieza({ name: 'Dije cruz de esmeraldas', metal: 'Oro 18k', piedra: 'esmeraldas naturales' }))
      .toBe('Dije cruz de esmeraldas en Oro 18k | Aurem Gs')
    expect(tituloDePieza({ name: 'Anillo abierto de dos granates', metal: 'Plata 925', piedra: 'granates naturales' }))
      .toBe('Anillo abierto de dos granates en Plata 925 | Aurem Gs')
  })

  it('no pone un segundo «con» si el nombre ya trae uno', () => {
    expect(tituloDePieza({ name: 'Anillo bicolor con pavé', metal: 'Plata 925 y oro', piedra: 'circones' }))
      .toBe('Anillo bicolor con pavé en Plata 925 y oro | Aurem Gs')
  })

  it('sin piedra, el metal', () => {
    expect(tituloDePieza({ name: 'Argollas talladas a mano', metal: 'Plata 925' }))
      .toBe('Argollas talladas a mano en Plata 925 | Aurem Gs')
  })

  it('sin nada, el nombre y la marca', () => {
    expect(tituloDePieza({ name: 'Argollas de centro satinado' }))
      .toBe('Argollas de centro satinado | Aurem Gs')
  })

  it('no lleva precio — eso es del JSON-LD y de la tarjeta de WhatsApp', () => {
    const t = tituloDePieza({ name: 'Anillo de eslabones', metal: 'Plata 925', price: 400000 })
    expect(t).not.toMatch(/\$|400/)
  })

  it('un nombre larguísimo se deja entero antes que cortado a la mitad', () => {
    const largo = 'Anillo de hombre en plata 925 con esmeralda natural y banda de eslabones'
    expect(tituloDePieza({ name: largo, metal: 'Plata 925' })).toBe(`${largo} | Aurem Gs`)
  })

  it('sin pieza no se rompe: devuelve el título del sitio', () => {
    expect(tituloDePieza(null)).toBe('Joyería con esmeralda colombiana | Aurem Gs')
    expect(tituloDePieza({ name: '   ' })).toBe('Joyería con esmeralda colombiana | Aurem Gs')
  })
})
