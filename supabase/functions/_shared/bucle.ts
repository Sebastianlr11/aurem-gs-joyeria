/**
 * El bucle de Valentina: pedirle al modelo, ejecutar lo que pida, y volver.
 *
 * Salió de `bot.ts` el 23 de agosto de 2026, y **recibe sus dependencias en
 * vez de importarlas**. No es una preferencia de estilo: es lo único que lo
 * vuelve comprobable. `bot.ts` no se puede cargar fuera de Deno —importa de
 * `jsr:` y llama a `Deno.env`—, y con las dependencias inyectadas se puede
 * probar el bucle entero sin Deno, sin red y sin gastar un céntimo de modelo.
 *
 * Es un bucle y no una sola ronda porque mostrar una foto y después comentarla
 * son dos pasos, y con una sola vuelta el segundo nunca ocurría.
 *
 * ── Los tres frenos ─────────────────────────────────────────────────────────
 *
 * Un bucle que llama a un modelo de lenguaje y ejecuta lo que le diga es, por
 * construcción, algo que puede no parar. Los tres frenos son:
 *
 *   1. **Un máximo de pasos.** Tres.
 *   2. **Un presupuesto de tiempo.** Meta corta la petición del webhook mucho
 *      antes de que a nadie le importe la respuesta perfecta.
 *   3. **El último paso va SIN herramientas.** Esto es lo que garantiza que
 *      siempre salga texto: si se le dejaran, el modelo podría gastar el
 *      último paso pidiendo otra herramienta y la clienta se quedaría mirando
 *      un chat en silencio. Nunca se deja el chat mudo.
 */

/** Tres. Suficiente para mirar el catálogo, mandar una foto y comentarla. */
export const MAX_PASOS = 3

/** 25 s. Meta corta la petición del webhook antes de eso. */
export const PRESUPUESTO_MS = 25_000

export type LlamadaAHerramienta = {
  id: string
  function: { name: string; arguments: string }
}

export type PasoDelModelo = {
  content?: string | null
  tool_calls?: LlamadaAHerramienta[]
} | null

export type Dependencias = {
  /** Le pide al modelo. Con `herramientas` vacío, obliga a responder texto. */
  llamarModelo: (mensajes: any[], herramientas: any[]) => Promise<PasoDelModelo>
  /** Ejecuta lo que el modelo pidió y devuelve qué contarle a la clienta. */
  ejecutarHerramienta: (nombre: string, args: any) => Promise<string>
  herramientas: any[]
  /** El reloj, para que una prueba pueda agotar el presupuesto sin esperar. */
  ahora?: () => number
  registrar?: (linea: string) => void
  avisar?: (linea: string) => void
}

/** Lo que se dice si el modelo escala sin escribir nada. */
export const RESPALDO_AL_ESCALAR =
  'Dame un momento, te comunico con alguien del equipo que te ayuda con eso. 🌿'

export async function correrElBucle(mensajes: any[], dep: Dependencias): Promise<string | null> {
  const ahora = dep.ahora ?? (() => Date.now())
  const registrar = dep.registrar ?? (() => {})
  const avisar = dep.avisar ?? (() => {})

  const empezo = ahora()

  for (let paso = 0; paso < MAX_PASOS; paso++) {
    const sinTiempo = ahora() - empezo > PRESUPUESTO_MS
    const ultimo = paso === MAX_PASOS - 1 || sinTiempo

    const tModelo = ahora()
    const respuesta = await dep.llamarModelo(mensajes, ultimo ? [] : dep.herramientas)
    const llamadas = respuesta?.tool_calls ?? []
    registrar(
      `modelo · paso ${paso + 1} · ${ahora() - tModelo} ms · ` +
      `${llamadas.length ? llamadas.map((l) => l.function.name).join('+') : 'texto'}`,
    )

    if (!llamadas.length) {
      registrar(`turno resuelto en ${ahora() - empezo} ms y ${paso + 1} paso(s)`)
      return String(respuesta?.content || '').trim() || null
    }

    mensajes.push(respuesta)

    for (const llamada of llamadas) {
      /* Los argumentos los escribe el modelo y a veces salen rotos. Un JSON
         que no parsea no puede tumbar el turno: se sigue con los argumentos
         vacíos y que la herramienta diga que le falta algo, que es una
         respuesta útil para la clienta. */
      let args: any = {}
      try { args = JSON.parse(llamada.function.arguments || '{}') } catch { /* argumentos rotos */ }

      // Escalar corta el bucle: a partir de acá contesta una persona.
      if (llamada.function.name === 'escalar_a_humano') {
        await dep.ejecutarHerramienta(llamada.function.name, args)
        /* Lo que escribió el modelo, que sabe de qué venían hablando. El
           respaldo sólo aparece si no escribió nada: mejor una frase genérica
           que un silencio. */
        const suyo = String(args?.mensaje ?? '').trim()
        return suyo || RESPALDO_AL_ESCALAR
      }

      /* Se registra qué herramienta y cuánto tardó. Sin esto, un turno de 86
         segundos es un misterio: no se sabe si fue el modelo, la base o Meta,
         ni cuántas vueltas dio el bucle. */
      const t0 = ahora()
      const resultado = await dep.ejecutarHerramienta(llamada.function.name, args)
      registrar(`herramienta ${llamada.function.name} · paso ${paso + 1} · ${ahora() - t0} ms`)
      mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: resultado })
    }
  }

  avisar(`Se agotaron los ${MAX_PASOS} pasos sin respuesta, tras ${ahora() - empezo} ms`)
  return null
}
