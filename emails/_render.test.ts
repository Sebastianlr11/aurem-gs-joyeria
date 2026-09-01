import { describe, it, expect } from 'vitest'
import { asunto } from './_render'

/**
 * El asunto de un correo.
 *
 * Se prueba porque es lo primero que se lee y muchas veces lo único, y porque
 * **no vive donde uno lo busca**: lo decide `_render.ts`, no la plantilla. El
 * 1 de septiembre de 2026 se cambió la plantilla entera para el contraentrega
 * sin abono —tres casos en vez de dos— y el asunto se quedó atrás diciendo
 * «Recibimos tu pago» a alguien que va a pagar en su puerta. Se veía desde la
 * bandeja de entrada, sin abrir el correo.
 *
 * Los tres casos del pedido confirmado son los mismos de la plantilla:
 * abonó · no pagó nada y paga todo al recibir · pagó completo en línea.
 */
describe('el asunto de un pedido confirmado', () => {
  const base = { pieza: 'Anillo solitario clásico', total: 250_000 }

  it('sin abono dice lo que se va a pagar al recibir, no que se pagó', () => {
    const linea = asunto('pedido-confirmado', { ...base, abono: null, contraentrega: true })
    expect(linea).toBe('Pedido confirmado — al recibir pagas $250.000')
    expect(linea).not.toMatch(/recibimos tu pago/i)
  })

  it('con abono descuenta lo abonado del saldo', () => {
    expect(asunto('pedido-confirmado', { pieza: 'x', total: 550_000, abono: 20_000, contraentrega: true }))
      .toBe('Pedido confirmado — al recibir pagas $530.000')
  })

  it('pagando en línea sí dice que se recibió el pago', () => {
    expect(asunto('pedido-confirmado', { ...base, abono: null, contraentrega: false }))
      .toBe('Recibimos tu pago — Anillo solitario clásico')
  })

  /* La bandera es la que manda, no el abono: un abono ausente en un pedido
     pagado en línea es lo normal, y ahí «recibimos tu pago» es correcto. */
  it('sin la bandera de contraentrega se comporta como antes', () => {
    expect(asunto('pedido-confirmado', { ...base })).toMatch(/^Recibimos tu pago/)
  })
})

describe('los demás asuntos', () => {
  it('el despacho nombra la pieza', () => {
    expect(asunto('pedido-despachado', { pieza: 'Dije de caballo' })).toBe('Tu Dije de caballo va en camino')
  })

  /* Este correo se lee en la lista sin abrirlo, que es cuando se decide si
     urge: por eso el asunto dice el problema y no «alerta del sistema». */
  it('la alerta dice el hallazgo, y cuántos más hay', () => {
    expect(asunto('alerta-sistema', { hallazgos: [{ que: 'El cron no corrió' }] }))
      .toBe('El cron no corrió')
    expect(asunto('alerta-sistema', { hallazgos: [{ que: 'El cron no corrió' }, { que: 'Otra' }] }))
      .toBe('El cron no corrió (y 1 más)')
    expect(asunto('alerta-sistema', { hallazgos: [] })).toBe('Revisión del sistema')
  })

  it('el chat escalado lleva el nombre, y cae al teléfono si no hay', () => {
    expect(asunto('chat-escalado', { nombre: 'Martín' })).toBe('Martín necesita que le respondas')
    expect(asunto('chat-escalado', { nombre: '  ', telefono: '3105599570' }))
      .toBe('3105599570 necesita que le respondas')
  })
})
