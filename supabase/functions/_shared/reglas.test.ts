/**
 * Las reglas de Valentina.
 *
 * Es el primer código del bot que se prueba, y se empieza por aquí porque son
 * las tres cosas donde equivocarse **le cuesta dinero a alguien**: una talla
 * mal calculada fabrica un anillo que no entra, una cotización mal hecha es un
 * precio que hay que sostener, y una atribución perdida es una venta que el
 * anuncio nunca se apunta.
 *
 * Valentina lleva meses funcionando sin que nada de esto estuviera comprobado.
 */
import { describe, it, expect } from 'vitest'
import {
  TALLAS, calcularTalla, cotizarOro, origen, anuncioDe, atribucionDe, refDelTexto,
  DIAS_PARA_AVISAR, DIAS_PARA_NO_COTIZAR,
} from './reglas.ts'

describe('la tabla de tallas', () => {
  it('va de menor a mayor, sin saltos raros', () => {
    const mm = TALLAS.map(([, v]) => v)
    expect(mm).toEqual([...mm].sort((a, b) => a - b))
    for (let i = 1; i < mm.length; i++) {
      const salto = mm[i] - mm[i - 1]
      expect(salto).toBeGreaterThan(1.1)
      expect(salto).toBeLessThan(1.4)
    }
  })
})

describe('calcularTalla', () => {
  it('una circunferencia exacta cae justa en su talla', () => {
    const t = calcularTalla(54.4, 'circunferencia_mm')
    expect(t).toMatchObject({ ok: true, talla: '7', justa: true })
  })

  /* La regla que de verdad importa: un anillo holgado se acomoda con un
     ajuste, uno apretado no entra y hay que rehacerlo. Cuando la duda cuesta
     dinero se falla hacia el lado barato. */
  it('entre dos tallas se toma la MAYOR, nunca la menor', () => {
    const t = calcularTalla(55.0, 'circunferencia_mm')   // entre la 7 (54,4) y la 7,5 (55,7)
    expect(t).toMatchObject({ ok: true, talla: '7.5', justa: false })
  })

  it('acepta las cuatro unidades y dan lo mismo para el mismo dedo', () => {
    const porCirc = calcularTalla(54.4, 'circunferencia_mm')
    const porCircCm = calcularTalla(5.44, 'circunferencia_cm')
    const porDiam = calcularTalla(54.4 / Math.PI, 'diametro_mm')
    const porDiamCm = calcularTalla(5.44 / Math.PI, 'diametro_cm')
    for (const t of [porCircCm, porDiam, porDiamCm]) {
      expect((t as any).talla).toBe((porCirc as any).talla)
    }
  })

  it('el diámetro que devuelve es coherente con la circunferencia de la talla', () => {
    const t = calcularTalla(57.0, 'circunferencia_mm') as any
    expect(t.diametro * Math.PI).toBeCloseTo(57.0, 5)
  })

  it('por debajo de la 3 y por encima de la 12,5 manda fabricar a medida', () => {
    expect(calcularTalla(40, 'circunferencia_mm')).toMatchObject({ ok: false, motivo: 'muy_pequena', limite: '3' })
    expect(calcularTalla(75, 'circunferencia_mm')).toMatchObject({ ok: false, motivo: 'muy_grande', limite: '12.5' })
  })

  /* Confundir milímetros con centímetros es el error que más se comete al
     medir, y tiene que caer fuera de tabla en vez de dar una talla creíble. */
  it('quien mide 54 y escribe centímetros no recibe una talla plausible', () => {
    expect(calcularTalla(54, 'circunferencia_cm')).toMatchObject({ ok: false, motivo: 'muy_grande' })
  })

  it('una medida que no se entiende se dice, no se adivina', () => {
    for (const malo of [[0, 'circunferencia_mm'], [-5, 'circunferencia_mm'], ['hola', 'circunferencia_mm'],
                        [null, 'circunferencia_mm'], [54, 'pulgadas'], [54, undefined]]) {
      expect(calcularTalla(malo[0], malo[1])).toEqual({ ok: false, motivo: 'medida_invalida' })
    }
  })
})

const HOY = new Date('2026-08-23T12:00:00Z').getTime()
const hace = (dias: number) => new Date(HOY - dias * 86_400_000).toISOString()
const precios = (extra = {}) => ({
  precio_gramo_oro: 300_000,
  recargo_por_gramo: 40_000,
  gramos_minimos: 3,
  actualizado_en: hace(1),
  ...extra,
})

describe('cotizarOro', () => {
  it('el recargo va sumado al gramo, y el total es el gramo por el peso', () => {
    const c = cotizarOro(5, precios(), HOY) as any
    expect(c.ok).toBe(true)
    expect(c.porGramo).toBe(340_000)
    expect(c.total).toBe(1_700_000)
    expect(c.avisar).toBe(false)
  })

  /* En piezas livianas la merma se come la ganancia: el precio va por pieza y
     lo pone una persona, no el bot. */
  it('por debajo del mínimo no cotiza por gramo', () => {
    expect(cotizarOro(2.9, precios(), HOY)).toMatchObject({ ok: false, motivo: 'bajo_el_minimo', minimo: 3 })
    expect(cotizarOro(3, precios(), HOY)).toMatchObject({ ok: true })   // el mínimo sí entra
  })

  it('avisa cuando el precio lleva días, y calla cuando está fresco', () => {
    expect((cotizarOro(5, precios({ actualizado_en: hace(DIAS_PARA_AVISAR) }), HOY) as any).avisar).toBe(false)
    expect((cotizarOro(5, precios({ actualizado_en: hace(DIAS_PARA_AVISAR + 1) }), HOY) as any).avisar).toBe(true)
  })

  /* Es preferible que Valentina diga que consulta a que dé un número que el
     taller no puede sostener. El oro se mueve todos los días. */
  it('con el precio pasado de fecha no cotiza en absoluto', () => {
    expect(cotizarOro(5, precios({ actualizado_en: hace(DIAS_PARA_NO_COTIZAR) }), HOY)).toMatchObject({ ok: true })
    expect(cotizarOro(5, precios({ actualizado_en: hace(DIAS_PARA_NO_COTIZAR + 1) }), HOY))
      .toMatchObject({ ok: false, motivo: 'precio_viejo' })
  })

  it('una fecha ilegible se trata como precio viejo, no como precio fresco', () => {
    expect(cotizarOro(5, precios({ actualizado_en: 'cuando sea' }), HOY))
      .toMatchObject({ ok: false, motivo: 'precio_viejo' })
  })

  it('sin gramos, sin precios o con gramos absurdos no inventa un número', () => {
    expect(cotizarOro(undefined, precios(), HOY)).toEqual({ ok: false, motivo: 'sin_gramos' })
    expect(cotizarOro(0, precios(), HOY)).toEqual({ ok: false, motivo: 'sin_gramos' })
    expect(cotizarOro(-3, precios(), HOY)).toEqual({ ok: false, motivo: 'sin_gramos' })
    expect(cotizarOro('cinco', precios(), HOY)).toEqual({ ok: false, motivo: 'sin_gramos' })
    expect(cotizarOro(5, null, HOY)).toEqual({ ok: false, motivo: 'sin_gramos' })
  })

  it('lee los precios aunque la base los devuelva como texto', () => {
    const c = cotizarOro(5, precios({ precio_gramo_oro: '300000', recargo_por_gramo: '40000', gramos_minimos: '3' }), HOY) as any
    expect(c.total).toBe(1_700_000)
  })
})

describe('de dónde llegó la clienta', () => {
  it('cuenta el titular del anuncio, recortado', () => {
    expect(origen({ headline: 'Anillos de esmeralda', source_type: 'ad' }))
      .toBe('Esta persona llegó desde un anuncio que decía: "Anillos de esmeralda".')
    expect(origen({ body: 'Envío gratis', source_type: 'post' }))
      .toContain('una publicación que decía: "Envío gratis"')
    expect(origen({ source_type: 'ad' })).toBe('Esta persona llegó desde un anuncio.')
    expect(origen(null)).toBe('')
  })

  it('un titular larguísimo no se cuela entero en el prompt', () => {
    const largo = 'x'.repeat(500)
    expect(origen({ headline: largo, source_type: 'ad' })).toContain('x'.repeat(160))
    expect(origen({ headline: largo, source_type: 'ad' })).not.toContain('x'.repeat(161))
  })

  /* El ctwa_clid es lo que hay que devolverle a Meta cuando la venta se
     cierra. Sin él, Valentina vende y el anuncio nunca se entera. */
  it('el ctwa_clid se guarda como dato, no como texto en una nota', () => {
    expect(atribucionDe({ ctwa_clid: 'abc123', source_id: '99' })).toEqual({ ctwa_clid: 'abc123', anuncio_id: '99' })
    expect(atribucionDe({ source_id: '99' })).toEqual({ ctwa_clid: null, anuncio_id: '99' })
    expect(atribucionDe(null)).toEqual({ ctwa_clid: null, anuncio_id: null })
  })

  it('la nota del pedido prefiere el id del anuncio y cae al del clic', () => {
    expect(anuncioDe({ source_id: '99', ctwa_clid: 'abc' })).toBe('Anuncio: 99')
    expect(anuncioDe({ ctwa_clid: 'abc' })).toBe('Anuncio: abc')
    expect(anuncioDe({})).toBe('Llegó por anuncio')
    expect(anuncioDe(null)).toBeNull()
  })

  /* TikTok no manda identificador al abrir WhatsApp: sin esta marca, sus
     conversaciones parecerían tráfico directo y sus campañas se verían como si
     no vendieran nada. */
  it('encuentra la marca de TikTok en el primer mensaje', () => {
    expect(refDelTexto('[ref: tiktok] Hola, vi el anillo')).toBe('tiktok')
    expect(refDelTexto('[REF:TikTok] hola')).toBe('tiktok')
    expect(refDelTexto('Hola, vi el anillo')).toBeNull()
    expect(refDelTexto(null)).toBeNull()
  })

  it('no se traga una marca inventada de cien caracteres', () => {
    expect(refDelTexto(`[ref: ${'x'.repeat(100)}]`)).toBeNull()
  })
})
