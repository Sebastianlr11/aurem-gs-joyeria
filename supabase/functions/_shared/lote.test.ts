/**
 * El lote de Meta. Existe porque el webhook leía sólo el primer mensaje del
 * primer cambio de la primera entrada, y lo demás se perdía sin rastro.
 */
import { describe, it, expect } from 'vitest'
import { desglosarLote, contactoDe } from './lote.ts'

const cambio = (value: unknown) => ({ value })

describe('desglosarLote', () => {
  it('saca todos los mensajes de todas las entradas y todos los cambios', () => {
    const lote = desglosarLote({
      entry: [
        { changes: [cambio({ messages: [{ id: 'a' }, { id: 'b' }] })] },
        { changes: [cambio({ messages: [{ id: 'c' }] }), cambio({ messages: [{ id: 'd' }] })] },
      ],
    })
    expect(lote.mensajes.map((m) => m.mensaje.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(lote.acuses).toEqual([])
  })

  it('separa acuses y mensajes aunque vengan en el mismo cambio', () => {
    const lote = desglosarLote({
      entry: [{ changes: [cambio({ statuses: [{ id: 's1' }, { id: 's2' }], messages: [{ id: 'm1' }] })] }],
    })
    expect(lote.acuses.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(lote.mensajes.map((m) => m.mensaje.id)).toEqual(['m1'])
  })

  it('cada mensaje se lleva el value del que salió', () => {
    const lote = desglosarLote({
      entry: [{ changes: [
        cambio({ metadata: { phone_number_id: 'uno' }, messages: [{ id: 'a' }] }),
        cambio({ metadata: { phone_number_id: 'dos' }, messages: [{ id: 'b' }] }),
      ] }],
    })
    expect(lote.mensajes.map((m) => m.valor.metadata.phone_number_id)).toEqual(['uno', 'dos'])
  })

  it('aguanta cuerpos vacíos o torcidos sin reventar', () => {
    for (const cuerpo of [null, undefined, {}, { entry: null }, { entry: [{}] }, { entry: [{ changes: [{}] }] }, { entry: 'x' }]) {
      expect(desglosarLote(cuerpo)).toEqual({ acuses: [], mensajes: [] })
    }
  })
})

describe('contactoDe', () => {
  const valor = { contacts: [{ wa_id: '571', profile: { name: 'Ana' } }, { wa_id: '572', profile: { name: 'Bea' } }] }

  it('empareja el mensaje con su contacto por wa_id', () => {
    expect(contactoDe(valor, { from: '572' })?.profile.name).toBe('Bea')
  })

  it('sin from, o sin coincidencia, se queda con el primero', () => {
    expect(contactoDe(valor, { from: '' })?.profile.name).toBe('Ana')
    expect(contactoDe(valor, { from: 'CO.9' })?.profile.name).toBe('Ana')
  })

  it('sin contactos devuelve null', () => {
    expect(contactoDe({}, { from: '571' })).toBeNull()
  })
})
