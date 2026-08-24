/**
 * El bucle de Valentina.
 *
 * Un bucle que llama a un modelo de lenguaje y ejecuta lo que le diga es, por
 * construcción, algo que puede no parar. Llevaba meses funcionando sin que
 * nadie hubiera comprobado ninguno de sus tres frenos, porque para probarlo
 * hacía falta Deno, la red y un modelo de verdad.
 *
 * Con las dependencias inyectadas se prueba entero en milisegundos: el modelo
 * es una lista de respuestas preparadas y el reloj es una variable.
 */
import { describe, it, expect, vi } from 'vitest'
import { correrElBucle, MAX_PASOS, PRESUPUESTO_MS, RESPALDO_AL_ESCALAR } from './bucle.ts'

/** Un modelo de mentira que va soltando las respuestas que se le den. */
function modeloQueDice(...respuestas: any[]) {
  const recibido: Array<{ mensajes: any[]; herramientas: any[] }> = []
  const llamarModelo = vi.fn(async (mensajes: any[], herramientas: any[]) => {
    recibido.push({ mensajes: [...mensajes], herramientas })
    const i = recibido.length - 1
    /* `??` no vale: una respuesta preparada puede SER null —el modelo que no
       contesta nada— y con `??` caería en el respaldo sin llegar a probarse. */
    return i < respuestas.length ? respuestas[i] : { content: 'se acabaron las respuestas' }
  })
  return { llamarModelo, recibido }
}

const texto = (t: string) => ({ content: t })
const pide = (nombre: string, args: any = {}, id = `call-${nombre}`) => ({
  tool_calls: [{ id, function: { name: nombre, arguments: JSON.stringify(args) } }],
})

const HERRAMIENTAS = [{ type: 'function', function: { name: 'mostrar_pieza' } }]

const correr = (respuestas: any[], extra: any = {}) => {
  const { llamarModelo, recibido } = modeloQueDice(...respuestas)
  const ejecutarHerramienta = extra.ejecutarHerramienta ?? vi.fn(async () => 'lo que sea')
  const mensajes: any[] = [{ role: 'system', content: 'eres Valentina' }]
  return {
    recibido, llamarModelo, ejecutarHerramienta, mensajes,
    resultado: correrElBucle(mensajes, { llamarModelo, ejecutarHerramienta, herramientas: HERRAMIENTAS, ...extra }),
  }
}

describe('cuando el modelo contesta y ya', () => {
  it('devuelve el texto en un solo paso', async () => {
    const c = correr([texto('  Claro que sí, ese anillo es de plata 925.  ')])
    await expect(c.resultado).resolves.toBe('Claro que sí, ese anillo es de plata 925.')
    expect(c.llamarModelo).toHaveBeenCalledTimes(1)
    expect(c.ejecutarHerramienta).not.toHaveBeenCalled()
  })

  /* Una cadena vacía no es una respuesta: quien llama tiene que poder
     distinguir «no dijo nada» de «dijo esto». */
  it('un texto en blanco se devuelve como nada, no como cadena vacía', async () => {
    await expect(correr([texto('   ')]).resultado).resolves.toBeNull()
    await expect(correr([{ content: null }]).resultado).resolves.toBeNull()
    await expect(correr([null]).resultado).resolves.toBeNull()
  })
})

describe('cuando pide herramientas', () => {
  it('la ejecuta y le devuelve el resultado para que siga', async () => {
    const ejecutarHerramienta = vi.fn(async () => 'La pieza cuesta $550.000')
    const c = correr([pide('mostrar_pieza', { producto: 'Trinidad' }), texto('Ahí la tienes')], { ejecutarHerramienta })

    await expect(c.resultado).resolves.toBe('Ahí la tienes')
    expect(ejecutarHerramienta).toHaveBeenCalledWith('mostrar_pieza', { producto: 'Trinidad' })
    /* El resultado vuelve al modelo atado al id de SU llamada: sin el
       tool_call_id el modelo no sabe qué contestó a qué. */
    expect(c.mensajes.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call-mostrar_pieza', content: 'La pieza cuesta $550.000' })
  })

  it('si pide varias en un paso, las ejecuta todas y en orden', async () => {
    const llamadas: string[] = []
    const ejecutarHerramienta = vi.fn(async (n: string) => { llamadas.push(n); return 'ok' })
    const dos = { tool_calls: [
      { id: 'a', function: { name: 'calcular_talla', arguments: '{}' } },
      { id: 'b', function: { name: 'mostrar_pieza', arguments: '{}' } },
    ] }
    await correr([dos, texto('listo')], { ejecutarHerramienta }).resultado
    expect(llamadas).toEqual(['calcular_talla', 'mostrar_pieza'])
  })

  /* Los argumentos los escribe el modelo y a veces salen rotos. Un JSON que no
     parsea no puede tumbar el turno: se sigue con los argumentos vacíos y que
     la herramienta diga que le falta algo. */
  it('unos argumentos rotos no tumban el turno', async () => {
    const ejecutarHerramienta = vi.fn(async () => 'me falta el nombre')
    const roto = { tool_calls: [{ id: 'x', function: { name: 'mostrar_pieza', arguments: '{no es json' } }] }
    const c = correr([roto, texto('perdona, ¿cuál era?')], { ejecutarHerramienta })
    await expect(c.resultado).resolves.toBe('perdona, ¿cuál era?')
    expect(ejecutarHerramienta).toHaveBeenCalledWith('mostrar_pieza', {})
  })
})

describe('los tres frenos', () => {
  it('nunca da más de los pasos permitidos', async () => {
    const siempreHerramienta = Array.from({ length: 10 }, () => pide('mostrar_pieza'))
    const c = correr(siempreHerramienta)
    await expect(c.resultado).resolves.toBeNull()
    expect(c.llamarModelo).toHaveBeenCalledTimes(MAX_PASOS)
  })

  /* Lo que garantiza que siempre salga texto. Si se le dejaran herramientas en
     el último paso, el modelo podría gastarlo pidiendo otra y la clienta se
     quedaría mirando un chat en silencio. */
  it('el último paso va SIN herramientas', async () => {
    const c = correr([pide('mostrar_pieza'), pide('mostrar_pieza'), texto('ya está')])
    await c.resultado
    expect(c.recibido[0].herramientas).toEqual(HERRAMIENTAS)
    expect(c.recibido[1].herramientas).toEqual(HERRAMIENTAS)
    expect(c.recibido[2].herramientas).toEqual([])
  })

  it('agotado el presupuesto de tiempo, el paso siguiente ya va sin herramientas', async () => {
    let reloj = 0
    const ahora = () => reloj
    const c = correr([pide('mostrar_pieza'), texto('me quedé sin tiempo pero contesto')], {
      ahora,
      ejecutarHerramienta: vi.fn(async () => { reloj += PRESUPUESTO_MS + 1; return 'ok' }),
    })
    await expect(c.resultado).resolves.toBe('me quedé sin tiempo pero contesto')
    expect(c.recibido[0].herramientas).toEqual(HERRAMIENTAS)   // el primero sí las tuvo
    expect(c.recibido[1].herramientas).toEqual([])             // el segundo ya no
    expect(c.llamarModelo).toHaveBeenCalledTimes(2)            // y no llegó al tercero
  })

  it('avisa cuando se queda sin pasos, que es lo único que lo delataría', async () => {
    const avisar = vi.fn()
    await correr(Array.from({ length: 5 }, () => pide('mostrar_pieza')), { avisar }).resultado
    expect(avisar).toHaveBeenCalledTimes(1)
    expect(avisar.mock.calls[0][0]).toContain('sin respuesta')
  })
})

describe('cuando escala a una persona', () => {
  it('corta el bucle y dice lo que el modelo escribió', async () => {
    const ejecutarHerramienta = vi.fn(async () => 'escalado')
    const c = correr([
      pide('escalar_a_humano', { motivo: 'pide precio de esmeraldas', mensaje: 'Déjame consultarlo con el taller 🌿' }),
      texto('esto no debería llegar a decirse'),
    ], { ejecutarHerramienta })

    await expect(c.resultado).resolves.toBe('Déjame consultarlo con el taller 🌿')
    expect(c.llamarModelo).toHaveBeenCalledTimes(1)   // no siguió preguntando
    expect(ejecutarHerramienta).toHaveBeenCalledWith('escalar_a_humano', expect.objectContaining({ motivo: 'pide precio de esmeraldas' }))
  })

  /* Mejor una frase genérica que un silencio: si escala sin escribir nada, la
     clienta se quedaría sin respuesta justo cuando más está esperando. */
  it('si escala sin escribir nada, hay respaldo', async () => {
    for (const args of [{ motivo: 'x' }, { motivo: 'x', mensaje: '   ' }]) {
      const c = correr([pide('escalar_a_humano', args)])
      await expect(c.resultado).resolves.toBe(RESPALDO_AL_ESCALAR)
    }
  })

  it('escala aunque venga junto a otra herramienta, y lo que va después no se ejecuta', async () => {
    const hechas: string[] = []
    const ejecutarHerramienta = vi.fn(async (n: string) => { hechas.push(n); return 'ok' })
    const juntas = { tool_calls: [
      { id: 'a', function: { name: 'escalar_a_humano', arguments: '{"mensaje":"ya te ayudo"}' } },
      { id: 'b', function: { name: 'mostrar_pieza', arguments: '{}' } },
    ] }
    await expect(correr([juntas], { ejecutarHerramienta }).resultado).resolves.toBe('ya te ayudo')
    expect(hechas).toEqual(['escalar_a_humano'])
  })
})
