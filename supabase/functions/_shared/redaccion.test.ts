import { describe, it, expect } from 'vitest'
import {
  DESC_MAX,
  NOMBRE_MAX,
  instrucciones,
  leerRespuesta,
  queFaltaParaRedactar,
  revisarBorrador,
} from './redaccion'

const FOTO = ['https://x/pieza-1254x1254.webp']

describe('queFaltaParaRedactar', () => {
  it('sin foto no hay nada que mirar', () => {
    expect(queFaltaParaRedactar({ metal: 'Plata 925' }, [])).toMatch(/foto/i)
  })

  it('sin metal no se pregunta: es un dato del taller, no de la foto', () => {
    /* Un modelo de visión dice «oro 18k» de una plata bañada sin pestañear, y
       eso acaba en la ficha, en el JSON-LD y en boca de Valentina. */
    expect(queFaltaParaRedactar({ metal: '  ' }, FOTO)).toMatch(/metal/i)
  })

  it('con foto y metal, adelante', () => {
    expect(queFaltaParaRedactar({ metal: 'Plata 925' }, FOTO)).toBe(null)
  })
})

describe('instrucciones', () => {
  it('le entrega el metal y la piedra ya escritos, y le prohíbe ampliarlos', () => {
    const t = instrucciones({ metal: 'Plata 925', piedra: 'esmeralda natural', categoria: 'Anillos' })
    expect(t).toContain('Metal: Plata 925')
    expect(t).toContain('Piedra: esmeralda natural')
    expect(t).toMatch(/no la contradigas ni la amplíes/i)
    expect(t).toMatch(/ni quilates, ni peso, ni calidad, ni origen/i)
  })

  it('dice «ninguna» cuando la pieza no lleva piedra, en vez de callar', () => {
    /* Callarlo dejaba al modelo suponiendo, y suponía que sí llevaba. */
    expect(instrucciones({ metal: 'Oro 18k' })).toContain('Piedra: ninguna')
  })

  it('le pasa los nombres ocupados para que no proponga uno que choque', () => {
    const t = instrucciones({ metal: 'Plata 925' }, ['Anillo solitario clásico'])
    expect(t).toContain('- Anillo solitario clásico')
  })

  it('lleva los dos límites escritos', () => {
    const t = instrucciones({ metal: 'Plata 925' })
    expect(t).toContain(String(NOMBRE_MAX))
    expect(t).toContain(String(DESC_MAX))
  })
})

describe('leerRespuesta', () => {
  it('lee el JSON pelado', () => {
    expect(leerRespuesta('{"nombre":"Dije de caballo","descripcion":"Dije en plata 925."}'))
      .toEqual({ nombre: 'Dije de caballo', descripcion: 'Dije en plata 925.' })
  })

  it('le quita la envoltura de bloque de código', () => {
    const crudo = '```json\n{"nombre":"Topos de esmeralda","descripcion":"Par de topos en oro."}\n```'
    expect(leerRespuesta(crudo)?.nombre).toBe('Topos de esmeralda')
  })

  it('aguanta el preámbulo que a veces se cuela', () => {
    const crudo = 'Claro, aquí va:\n{"nombre":"Anillo flor","descripcion":"Anillo en plata."}\nEspero que sirva.'
    expect(leerRespuesta(crudo)?.nombre).toBe('Anillo flor')
  })

  it('junta los saltos de línea de la descripción en una sola línea', () => {
    const r = leerRespuesta('{"nombre":"Anillo flor","descripcion":"Primera.\\n\\n  Segunda."}')
    expect(r?.descripcion).toBe('Primera. Segunda.')
  })

  it('sin JSON, sin campos o con la mitad, no devuelve nada a medias', () => {
    expect(leerRespuesta('No pude ver la foto.')).toBe(null)
    expect(leerRespuesta('{"nombre":"Anillo"}')).toBe(null)
    expect(leerRespuesta('{"nombre":"","descripcion":"algo"}')).toBe(null)
    expect(leerRespuesta('')).toBe(null)
    expect(leerRespuesta(null)).toBe(null)
  })
})

describe('revisarBorrador', () => {
  it('le quita las comillas con las que a veces envuelve el nombre', () => {
    const { borrador } = revisarBorrador({ nombre: '«Anillo flor»', descripcion: 'Anillo en plata 925.' })
    expect(borrador.nombre).toBe('Anillo flor')
  })

  it('avisa del nombre largo pero no lo recorta: la decisión es del joyero', () => {
    const largo = 'Anillo solitario clásico de esmeralda natural colombiana'
    const { borrador, avisos } = revisarBorrador({ nombre: largo, descripcion: 'Corta.' })
    expect(borrador.nombre).toBe(largo)
    expect(avisos.join(' ')).toMatch(/va largo/i)
  })

  it('avisa cuando la descripción no le cabe a Valentina', () => {
    const { avisos } = revisarBorrador({ nombre: 'Anillo flor', descripcion: 'x'.repeat(DESC_MAX + 1) })
    expect(avisos.join(' ')).toMatch(/cortada/i)
  })

  it('avisa del choque de nombres, nombrando con cuál', () => {
    const { avisos } = revisarBorrador(
      { nombre: 'Anillo solitario', descripcion: 'Corta.' },
      ['Anillo solitario clásico'],
    )
    expect(avisos.join(' ')).toContain('Anillo solitario clásico')
  })

  it('un borrador que cumple no lleva avisos', () => {
    const { avisos } = revisarBorrador(
      { nombre: 'Anillo flor con topacio', descripcion: 'Anillo en plata 925 con un topacio azul en talla pera.' },
      ['Dije de caballo'],
    )
    expect(avisos).toEqual([])
  })
})
