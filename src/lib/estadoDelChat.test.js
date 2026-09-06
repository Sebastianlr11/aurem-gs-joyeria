import { describe, it, expect } from 'vitest'
import { ESTADOS, estadoDe, definicionDe, estaAbierto, SIGUE_ABIERTO } from './estadoDelChat'

/**
 * El estado de una conversación.
 *
 * Se prueba porque un chat que cae fuera de todos los filtros desaparece de la
 * vista sin que nadie note que desapareció — y ahí dentro hay una persona
 * esperando respuesta. Es el mismo fallo silencioso de siempre, con la
 * diferencia de que este cuesta un cliente.
 */
describe('el estado de un chat', () => {
  it('sin fila en la base, es nuevo', () => {
    for (const nada of [null, undefined, {}]) expect(estadoDe(nada), String(nada)).toBe('nuevo')
  })

  it('lee el que trae la fila', () => {
    for (const e of ESTADOS) expect(estadoDe({ estado: e.id })).toBe(e.id)
  })

  /* Un valor que no reconoce cae a `nuevo` en vez de quedarse sin pintar y sin
     filtro. La base tiene un CHECK, pero el panel no puede confiar en que la
     fila que le llega venga de ahí. */
  it('un valor desconocido cae a nuevo, no al vacío', () => {
    for (const raro of ['VENDIDO', 'en_proceso', '', 42, null])
      expect(estadoDe({ estado: raro }), String(raro)).toBe('nuevo')
  })

  it('siempre hay una definición con la que pintar', () => {
    expect(definicionDe({ estado: 'inventado' }).etiqueta).toBe('Nuevo')
    expect(definicionDe({ estado: 'vendido' }).color).toBe('#2F6B57')
  })

  /* `nuevo` sin color es deliberado: si los cuarenta chats sin tocar se
     pintaran, el color dejaría de señalar lo que necesita algo. */
  it('nuevo no lleva color y los demás sí', () => {
    expect(definicionDe({ estado: 'nuevo' }).color).toBe(null)
    for (const e of ESTADOS.filter(x => x.id !== 'nuevo'))
      expect(e.color, e.id).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('los tres primeros siguen abiertos, los dos finales no', () => {
    expect(SIGUE_ABIERTO).toEqual(['nuevo', 'atendiendo', 'cotizado'])
    expect(estaAbierto({ estado: 'cotizado' })).toBe(true)
    expect(estaAbierto({ estado: 'vendido' })).toBe(false)
    expect(estaAbierto({ estado: 'perdido' })).toBe(false)
    /* Un chat sin tocar cuenta como abierto: es justo el que hay que atender. */
    expect(estaAbierto(null)).toBe(true)
  })

  it('cada estado tiene etiqueta y ayuda, que es lo que se lee en pantalla', () => {
    for (const e of ESTADOS) {
      expect(e.etiqueta, e.id).toBeTruthy()
      expect(e.ayuda, e.id).toBeTruthy()
    }
  })
})
