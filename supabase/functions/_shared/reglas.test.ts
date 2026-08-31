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
  DIAS_PARA_AVISAR, DIAS_PARA_NO_COTIZAR, diezUltimos, mismoTelefono, aNumeroDeWhatsApp,
  cantidadPedida, piezasDelPedido, esContraentrega, piezaDelAnuncio,
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

/* Los tres formatos con los que el MISMO número entra al sistema, según por
   dónde llegue la clienta. Están tomados de la base tal cual el 23 de agosto
   de 2026: la ficha de cliente guardaba uno y diez de los dieciocho pedidos
   guardaban otro. */
const MISMA_PERSONA = ['3143602930', '+573143602930', '573143602930', '+57 314 360 2930', '57 (314) 360-2930']

describe('el mismo número escrito de cinco formas', () => {
  it('todas se reducen a los mismos diez dígitos', () => {
    for (const forma of MISMA_PERSONA) expect(diezUltimos(forma)).toBe('3143602930')
  })

  /* Este es el fallo que se arregló: comparar las cadenas crudas hacía que el
     freno de «no me escriban» y el de «hay una persona atendiendo» no saltaran
     nunca para diez de los dieciocho pedidos. No daba error: decía que sí. */
  it('se reconocen entre sí, comparen como comparen', () => {
    for (const a of MISMA_PERSONA) {
      for (const b of MISMA_PERSONA) expect(mismoTelefono(a, b), `${a} vs ${b}`).toBe(true)
    }
  })

  it('y no se confunden con otra persona', () => {
    expect(mismoTelefono('573143602930', '573224847819')).toBe(false)
    expect(mismoTelefono('3143602930', '3143602931')).toBe(false)
  })

  /* Un número incompleto no puede parecerse a nadie: si se compararan los
     últimos dígitos de "2930", media agenda coincidiría. */
  it('lo que no llega a diez dígitos no coincide con nada, ni consigo mismo', () => {
    expect(mismoTelefono('2930', '2930')).toBe(false)
    expect(mismoTelefono('', '')).toBe(false)
    expect(mismoTelefono(null, undefined)).toBe(false)
  })
})

describe('el número que se le pasa a WhatsApp', () => {
  /* Un pedido cargado a mano en el panel guarda el móvil sin país, y Meta no
     entrega a diez dígitos pelados. */
  it('le pone el indicativo a un móvil colombiano sin país', () => {
    expect(aNumeroDeWhatsApp('3143602930')).toBe('573143602930')
    expect(aNumeroDeWhatsApp('314 360 2930')).toBe('573143602930')
  })

  it('deja en paz lo que ya lo trae', () => {
    expect(aNumeroDeWhatsApp('573143602930')).toBe('573143602930')
    expect(aNumeroDeWhatsApp('+573143602930')).toBe('573143602930')
    expect(aNumeroDeWhatsApp('+57 (314) 360-2930')).toBe('573143602930')
  })

  /* No se inventa un país para lo que no es inequívocamente un móvil
     colombiano: mandarle un mensaje a un número que no es el de la clienta es
     peor que no mandarlo. */
  it('no le inventa el 57 a lo que no lo pide', () => {
    expect(aNumeroDeWhatsApp('6012345678')).toBe('6012345678')   // fijo de Bogotá, no empieza por 3
    expect(aNumeroDeWhatsApp('12025550143')).toBe('12025550143') // otro país
    expect(aNumeroDeWhatsApp('31436029')).toBe('31436029')       // incompleto
    expect(aNumeroDeWhatsApp('')).toBe('')
    expect(aNumeroDeWhatsApp(null)).toBe('')
  })

  it('lo que sale ya no lleva separadores', () => {
    for (const forma of MISMA_PERSONA) expect(aNumeroDeWhatsApp(forma)).toBe('573143602930')
  })
})

describe('lo que el modelo pide al tomar un pedido', () => {
  it('lee la lista de piezas con sus tallas', () => {
    expect(piezasDelPedido({ piezas: [
      { producto: 'Anillo Trinidad', talla: '7', cantidad: 2 },
      { producto: 'Dije Cruz de Esmeraldas' },
    ] })).toEqual([
      { producto: 'Anillo Trinidad', talla: '7', cantidad: 2 },
      { producto: 'Dije Cruz de Esmeraldas', talla: null, cantidad: 1 },
    ])
  })

  /* El modelo tiene el historial delante y a veces repite la forma vieja, de
     una pieza suelta. Rechazar un pedido bien tomado por la forma de los
     argumentos sería perder una venta por una tecnicidad. */
  it('acepta el formato viejo de una sola pieza', () => {
    expect(piezasDelPedido({ producto: 'Anillo Trinidad', talla: '7' }))
      .toEqual([{ producto: 'Anillo Trinidad', talla: '7', cantidad: 1 }])
  })

  it('la lista manda sobre el formato viejo si vienen los dos', () => {
    const r = piezasDelPedido({ piezas: [{ producto: 'Anillo Majestuosa' }], producto: 'Otra cosa' })
    expect(r).toHaveLength(1)
    expect(r[0].producto).toBe('Anillo Majestuosa')
  })

  it('descarta las piezas sin nombre en vez de pedir "(sin nombre)"', () => {
    expect(piezasDelPedido({ piezas: [{ producto: '' }, { talla: '7' }, { producto: '  ' }] })).toEqual([])
    expect(piezasDelPedido({})).toEqual([])
    expect(piezasDelPedido(null)).toEqual([])
    expect(piezasDelPedido({ piezas: [] })).toEqual([])
  })

  it('limpia los espacios del nombre y de la talla', () => {
    expect(piezasDelPedido({ piezas: [{ producto: '  Anillo Trinidad ', talla: ' 7 ' }] })[0])
      .toEqual({ producto: 'Anillo Trinidad', talla: '7', cantidad: 1 })
  })
})

describe('cuántas unidades', () => {
  it('sin cantidad, una', () => {
    for (const v of [undefined, null, 0, -3, 'dos', NaN, {}]) expect(cantidadPedida(v)).toBe(1)
  })

  it('acepta la cantidad que se pidió', () => {
    expect(cantidadPedida(3)).toBe(3)
    expect(cantidadPedida('4')).toBe(4)
    expect(cantidadPedida(2.7)).toBe(2)      // no existen dos anillos y medio
  })

  /* Lo que llega son argumentos de un modelo de lenguaje: un `cantidad: 1000`
     por alucinación crearía un pedido de cientos de millones que alguien
     tendría que cancelar a mano. */
  it('acota una alucinación', () => {
    expect(cantidadPedida(1000)).toBe(20)
    expect(cantidadPedida(Infinity)).toBe(1)
  })
})

describe('contraentrega o pago en línea', () => {
  it('reconoce los dos valores que la herramienta admite', () => {
    expect(esContraentrega('Contra entrega')).toBe(true)
    expect(esContraentrega('Mercado Pago')).toBe(false)
  })

  it('aguanta las formas que un modelo escribe igual', () => {
    for (const v of ['contraentrega', 'CONTRA ENTREGA', 'pago contra entrega', 'contra-entrega  '])
      expect(esContraentrega(v), v).toBe(true)
  })

  /* La regla está sesgada a propósito hacia el lado barato: hace falta la
     palabra «entrega» para que sea contraentrega. Los dos errores no cuestan
     igual — registrar como pago en línea algo que era contraentrega manda un
     enlace de más, molesto y recuperable en la misma conversación; al revés se
     despacha una pieza sin haberla cobrado. */
  it('ante un valor que no reconoce se va al pago en línea, nunca al contraentrega', () => {
    for (const v of ['COD', 'efectivo', 'transferencia', 'Nequi', '', null, undefined, 42, {}])
      expect(esContraentrega(v), String(v)).toBe(false)
  })
})

/**
 * De qué joya viene el lead.
 *
 * Se prueba porque el fallo es caro y silencioso en las dos direcciones: si no
 * resuelve la pieza, la clienta que pagó un clic tiene que volver a explicar
 * lo que ya vio —y eso es fricción sobre algo que costó plata—; y si resuelve
 * la equivocada, Valentina abre nombrando una joya que esa persona no miró
 * nunca, que es peor que no saber nada.
 */
describe('la pieza del anuncio', () => {
  const MAPA = {
    '120251419397950566': 'adac2d70-e50f-44a5-afe3-5059833c5944',
    '120251419398080566': '91c55f65-27e2-4985-9654-1edb8ccc6ebe',
  }

  it('resuelve el anuncio que está en la tabla', () => {
    expect(piezaDelAnuncio({ source_type: 'ad', source_id: '120251419398080566' }, MAPA))
      .toBe('91c55f65-27e2-4985-9654-1edb8ccc6ebe')
  })

  it('lee la tabla igual si viene como texto, que es como la guarda ajustes_internos', () => {
    expect(piezaDelAnuncio({ source_id: '120251419397950566' }, JSON.stringify(MAPA)))
      .toBe('adac2d70-e50f-44a5-afe3-5059833c5944')
  })

  /* El caso de todos los días: se publica un creativo nuevo —Meta obliga a
     crear otro anuncio con id nuevo por cada cambio— y nadie actualizó la
     tabla todavía. */
  it('un anuncio que no está en la tabla no resuelve nada', () => {
    expect(piezaDelAnuncio({ source_type: 'ad', source_id: '999999999999' }, MAPA)).toBe(null)
  })

  it('sin referral no hay pieza: es tráfico orgánico', () => {
    expect(piezaDelAnuncio(null, MAPA)).toBe(null)
    expect(piezaDelAnuncio({}, MAPA)).toBe(null)
  })

  /* Nunca inventar una pieza es la regla número uno de Valentina, y acá
     empieza: un uuid mal copiado en el ajuste no puede salir a la base. */
  it('un valor que no es un uuid se descarta, no se consulta', () => {
    for (const malo of ['Anillo solitario sencillo', '91c55f65', '', '   ', 123, null, {}])
      expect(piezaDelAnuncio({ source_id: 'x' }, { x: malo }), String(malo)).toBe(null)
  })

  /* Si alguien deja el ajuste a medio escribir, la conversación NO se cae:
     Valentina pregunta como siempre. */
  it('un JSON roto no tumba la conversación', () => {
    expect(piezaDelAnuncio({ source_id: 'x' }, '{esto no es json')).toBe(null)
    expect(piezaDelAnuncio({ source_id: 'x' }, null)).toBe(null)
    expect(piezaDelAnuncio({ source_id: 'x' }, 42)).toBe(null)
  })

  it('acepta el uuid en mayúsculas y lo devuelve en minúsculas', () => {
    expect(piezaDelAnuncio({ source_id: 'x' }, { x: 'ADAC2D70-E50F-44A5-AFE3-5059833C5944' }))
      .toBe('adac2d70-e50f-44a5-afe3-5059833c5944')
  })
})
