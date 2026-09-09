/**
 * El reintento, y sobre todo lo que NO se reintenta.
 *
 * La mitad de estas pruebas existen por una sola razón: repetir un 23505 del
 * candado de `plantillas_enviadas` sería mandarle a una clienta el mismo
 * WhatsApp dos veces. Un reintento de más cuesta más caro que el bache que
 * viene a tapar.
 */
import { describe, it, expect, vi } from 'vitest'
import { conReintento, esTropiezo } from './reintento.ts'

/* Sin esperas de verdad: las pruebas no pueden tardar dos segundos por caso. */
const sinDormir = { dormir: async () => {}, esperaMs: 0 }

describe('esTropiezo', () => {
  it('reconoce lo que pasó el 8 de septiembre de 2026', () => {
    expect(esTropiezo({ message: 'Gateway Timeout' })).toBe(true)
  })

  it('reconoce las demás formas de no llegar', () => {
    const caidas = [
      { message: 'Bad Gateway' },
      { message: 'Service Unavailable' },
      { message: 'error sending request for url' },
      { message: 'fetch failed' },
      { message: 'connection closed before message completed' },
      { message: 'operation timed out' },
      { status: 504 },
      { status: 503 },
      { code: '08006' },
      { code: '57014' },
      { code: '53300' },
    ]
    caidas.forEach((e) => expect(esTropiezo(e), JSON.stringify(e)).toBe(true))
  })

  /* Lo importante de todo el archivo. */
  it('NO reintenta el candado de plantillas: repetirlo manda el mensaje dos veces', () => {
    expect(esTropiezo({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false)
  })

  it('NO reintenta permisos, sintaxis ni peticiones mal escritas', () => {
    const respuestas = [
      { code: '42501', message: 'permission denied for table orders' },
      { code: '42P01', message: 'relation does not exist' },
      { code: '23503', message: 'foreign key violation' },
      { code: 'PGRST116', message: 'JSON object requested, multiple rows returned' },
      { code: 'PGRST202', message: 'function not found' },
    ]
    respuestas.forEach((e) => expect(esTropiezo(e), JSON.stringify(e)).toBe(false))
  })

  /* Un 23505 dentro de una respuesta que además menciona un plazo agotado
     sigue siendo un 23505: manda el código, no el texto. */
  it('el código manda sobre el texto del mensaje', () => {
    expect(esTropiezo({ code: '23505', message: 'timeout while writing duplicate key' })).toBe(false)
  })

  it('sin error no hay nada que reintentar', () => {
    expect(esTropiezo(null)).toBe(false)
    expect(esTropiezo(undefined)).toBe(false)
    expect(esTropiezo({})).toBe(false)
    expect(esTropiezo({ message: 'row not found' })).toBe(false)
  })
})

describe('conReintento', () => {
  it('con la primera buena, no vuelve a llamar', async () => {
    const hacer = vi.fn(async () => ({ data: 'ok', error: null }))
    const r = await conReintento(hacer, sinDormir)
    expect(r.data).toBe('ok')
    expect(hacer).toHaveBeenCalledTimes(1)
  })

  it('un 504 y a la segunda entra', async () => {
    let n = 0
    const hacer = vi.fn(async () => (++n === 1
      ? { data: null, error: { message: 'Gateway Timeout' } }
      : { data: [], error: null }))
    const r = await conReintento(hacer, sinDormir)
    expect(r.error).toBeNull()
    expect(hacer).toHaveBeenCalledTimes(2)
  })

  /* Si los tres intentos fallan se devuelve el último tal cual, con su error
     dentro: quien llama sigue mirando `error` como siempre. */
  it('se rinde después de los intentos y devuelve el último error', async () => {
    const hacer = vi.fn(async () => ({ data: null, error: { message: 'Gateway Timeout' } }))
    const r = await conReintento(hacer, { ...sinDormir, intentos: 3 })
    expect(r.error?.message).toBe('Gateway Timeout')
    expect(hacer).toHaveBeenCalledTimes(3)
  })

  it('un error que no es tropiezo no se repite ni una vez', async () => {
    const hacer = vi.fn(async () => ({ data: null, error: { code: '23505' } }))
    const r = await conReintento(hacer, sinDormir)
    expect(r.error?.code).toBe('23505')
    expect(hacer).toHaveBeenCalledTimes(1)
  })

  it('avisa de cada reintento, para que no sean invisibles en el registro', async () => {
    let n = 0
    const avisos: number[] = []
    await conReintento(
      async () => (++n < 3 ? { data: null, error: { status: 504 } } : { data: 1, error: null }),
      { ...sinDormir, alReintentar: (i) => avisos.push(i) },
    )
    expect(avisos).toEqual([1, 2])
  })

  it('espera más entre intentos, para no ponerse en la misma cola', async () => {
    const esperas: number[] = []
    await conReintento(
      async () => ({ data: null, error: { status: 504 } }),
      { intentos: 3, esperaMs: 400, dormir: async (ms) => { esperas.push(ms) } },
    )
    expect(esperas).toEqual([400, 800])
  })
})
