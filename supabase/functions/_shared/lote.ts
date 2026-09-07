/**
 * Lo que trae un POST de Meta, desmenuzado.
 *
 * Un solo POST puede traer varias entradas, cada una con varios cambios, y
 * cada cambio con varios mensajes y varios acuses a la vez. Hasta el 6 de
 * septiembre de 2026 `wa-webhook` leía `entry[0].changes[0].value` y de ahí
 * `messages[0]`: **todo lo demás se tiraba sin guardarlo**. Cuando una
 * clienta mandaba la foto y el texto tan seguidos que Meta los juntaba en un
 * lote, uno de los dos no existía para nadie — ni para Valentina ni para el
 * panel—, y no quedaba rastro de que hubiera llegado.
 *
 * Sin nada de Deno dentro, para poder probarlo desde Node como `reglas.ts`.
 */

// deno-lint-ignore no-explicit-any
type Cualquiera = any

export interface Lote {
  /** Acuses de entrega y lectura, de todos los cambios del lote. */
  acuses: Cualquiera[]
  /** Cada mensaje con el `value` del que salió, que trae el contacto y el
      número nuestro al que le escribieron. */
  mensajes: Array<{ valor: Cualquiera; mensaje: Cualquiera }>
}

export function desglosarLote(cuerpo: Cualquiera): Lote {
  const acuses: Cualquiera[] = []
  const mensajes: Lote['mensajes'] = []

  for (const entrada of asLista(cuerpo?.entry)) {
    for (const cambio of asLista(entrada?.changes)) {
      const valor = cambio?.value
      if (!valor) continue
      for (const s of asLista(valor.statuses)) acuses.push(s)
      for (const m of asLista(valor.messages)) mensajes.push({ valor, mensaje: m })
    }
  }

  return { acuses, mensajes }
}

/**
 * El contacto de un mensaje. Meta manda `contacts[]` en paralelo a
 * `messages[]`; se busca por `wa_id`, y si no cuadra —o si el mensaje viene
 * sin `from`— se cae al primero, que es lo que había siempre.
 */
export function contactoDe(valor: Cualquiera, mensaje: Cualquiera): Cualquiera {
  const contactos = asLista(valor?.contacts)
  const de = mensaje?.from
  return (de ? contactos.find((c) => c?.wa_id === de) : undefined) ?? contactos[0] ?? null
}

const asLista = (v: unknown): Cualquiera[] => (Array.isArray(v) ? v : [])
