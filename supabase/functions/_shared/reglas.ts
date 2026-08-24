/**
 * Las reglas de Valentina que se pueden comprobar solas.
 *
 * Salieron de `bot.ts` el 23 de agosto de 2026, y el motivo no es el orden:
 * es que **son las tres cosas del bot donde un error le cuesta dinero a
 * alguien**, y hasta hoy no había forma de comprobarlas.
 *
 *   · La talla. Si sale mal, se fabrica un anillo a medida que no entra. No
 *     hay devolución que arregle eso: la pieza ya se hizo para ese dedo.
 *   · La cotización del oro. Es el precio que una clienta acepta por WhatsApp
 *     y con el que después hay que cumplir.
 *   · La atribución. Si se pierde el `ctwa_clid`, Valentina vende y el anuncio
 *     que la trajo nunca se entera: Meta no puede aprender de esa venta y el
 *     retorno de la pauta sale por debajo de lo real.
 *
 * Aquí no se entra a Deno, ni a la base, ni a la red. **Cada función recibe
 * todo lo que necesita**, incluido el reloj, para que una prueba pueda decir
 * «el precio se actualizó hace once días» sin esperar once días. `bot.ts` pone
 * los datos y arma la frase; esto decide el número.
 */

/* ── Tallas ─────────────────────────────────────────────────────────────
   La tabla estándar de tallas de anillo: talla y circunferencia interior en
   milímetros. Es la misma que usa la calculadora del sitio, y tienen que
   seguir siendo la misma: dos tablas distintas darían dos tallas distintas
   para el mismo dedo según dónde preguntara la clienta. */
export const TALLAS: Array<[string, number]> = [
  ['3', 44.2], ['3.5', 45.5], ['4', 46.8], ['4.5', 48.0], ['5', 49.3],
  ['5.5', 50.6], ['6', 51.9], ['6.5', 53.1], ['7', 54.4], ['7.5', 55.7],
  ['8', 57.0], ['8.5', 58.3], ['9', 59.5], ['9.5', 60.8], ['10', 62.1],
  ['10.5', 63.4], ['11', 64.6], ['11.5', 65.9], ['12', 67.2], ['12.5', 68.5],
]

/** Pasa cualquier medida a circunferencia en milímetros. */
export const A_CIRCUNFERENCIA: Record<string, (v: number) => number> = {
  circunferencia_mm: (v) => v,
  circunferencia_cm: (v) => v * 10,
  diametro_mm: (v) => v * Math.PI,
  diametro_cm: (v) => v * 10 * Math.PI,
}

/** Cuánto puede separarse de la talla exacta y aun así decirse «cae justa». */
const MARGEN_JUSTA_MM = 0.15

/* ⚠️ ESTOS DOS NÚMEROS SON LOS MISMOS QUE LOS DE `src/lib/talla.js`, y tienen
   que seguir siéndolo.
   Hasta el 23 de agosto de 2026 no lo eran: la guía del sitio aceptaba 0,35 mm
   de tolerancia y 0,6 de holgura fuera de tabla, y aquí no había ninguna. Sobre
   531 medidas entre 43 y 69,5 mm **discrepaban en el 29 %** — 55,9 mm era una
   7,5 en la guía y una 8 en el chat. La clienta mide su dedo, lo comprueba en
   la página y después escribe: dos números para el mismo dedo o le hacen
   desconfiar, o le fabrican un anillo a medida que no entra.
   `src/lib/talla.test.js` barre las dos y tumba el build si se separan. */
const TOLERANCIA_MM = 0.35
const HOLGURA_FUERA_MM = 0.6

export type Talla =
  | { ok: false; motivo: 'medida_invalida' }
  | { ok: false; motivo: 'muy_pequena' | 'muy_grande'; circunferencia: number; limite: string }
  | { ok: true; talla: string; circunferencia: number; diametro: number; justa: boolean; ajustada: boolean }

/**
 * De una medida cualquiera a una talla.
 *
 * **Entre dos tallas se toma siempre la mayor**, y no es un redondeo: un
 * anillo holgado se acomoda con un ajuste, uno apretado no entra y hay que
 * rehacerlo. Cuando la duda cuesta dinero, se falla hacia el lado barato.
 */
export function calcularTalla(medida: unknown, unidad: unknown): Talla {
  const valor = Number(medida)
  const convertir = A_CIRCUNFERENCIA[String(unidad)]
  if (!Number.isFinite(valor) || valor <= 0 || !convertir) {
    return { ok: false, motivo: 'medida_invalida' }
  }

  const circunferencia = convertir(valor)

  if (circunferencia < TALLAS[0][1] - HOLGURA_FUERA_MM) {
    return { ok: false, motivo: 'muy_pequena', circunferencia, limite: TALLAS[0][0] }
  }
  const mayor = TALLAS[TALLAS.length - 1]
  if (circunferencia > mayor[1] + HOLGURA_FUERA_MM) {
    return { ok: false, motivo: 'muy_grande', circunferencia, limite: mayor[0] }
  }

  const fila = TALLAS.find(([, mm]) => mm >= circunferencia - TOLERANCIA_MM) ?? mayor
  return {
    ok: true,
    talla: fila[0],
    circunferencia,
    diametro: fila[1] / Math.PI,
    justa: Math.abs(fila[1] - circunferencia) < MARGEN_JUSTA_MM,
    /* La talla elegida queda por DEBAJO del dedo: entra dentro de la
       tolerancia, pero no es «se tomó la mayor» y no hay que decirlo así. */
    ajustada: fila[1] < circunferencia,
  }
}

/* ── El oro ──────────────────────────────────────────────────────────── */

/** Días sin actualizar a partir de los cuales se avisa, y a partir de los
    cuales ya no se cotiza. El precio del oro se mueve todos los días; dar un
    número de hace dos semanas es prometer algo que no se puede cumplir. */
export const DIAS_PARA_AVISAR = 3
export const DIAS_PARA_NO_COTIZAR = 10

export type PreciosDeTaller = {
  precio_gramo_oro: number | string
  recargo_por_gramo: number | string
  gramos_minimos: number | string
  actualizado_en: string
}

export type Cotizacion =
  | { ok: false; motivo: 'sin_gramos' }
  | { ok: false; motivo: 'bajo_el_minimo'; gramos: number; minimo: number }
  | { ok: false; motivo: 'precio_viejo'; dias: number }
  | { ok: true; total: number; porGramo: number; gramos: number; dias: number; avisar: boolean }

/**
 * Cuánto cuesta una pieza de oro a medida.
 *
 * Tres cosas que no son obvias y que por eso están aquí y no en el prompt:
 *
 *   1. **Por debajo del mínimo no se cotiza por gramo.** En piezas livianas la
 *      merma se come la ganancia, así que el precio va por pieza y lo pone una
 *      persona.
 *   2. **Con el precio viejo no se cotiza en absoluto.** Es preferible que
 *      Valentina diga que consulta a que dé un número que el taller no puede
 *      sostener.
 *   3. **El recargo no se desglosa.** Va sumado al gramo porque es el margen
 *      del negocio, y va dentro del número que se dice.
 *
 * @param ahora  se pasa en vez de leer el reloj para que una prueba pueda
 *               poner el precio con once días de viejo.
 */
export function cotizarOro(gramos: unknown, precios: PreciosDeTaller | null, ahora: number): Cotizacion {
  const peso = Number(gramos)
  if (!Number.isFinite(peso) || peso <= 0) return { ok: false, motivo: 'sin_gramos' }
  if (!precios) return { ok: false, motivo: 'sin_gramos' }

  const minimo = Number(precios.gramos_minimos)
  if (Number.isFinite(minimo) && peso < minimo) {
    return { ok: false, motivo: 'bajo_el_minimo', gramos: peso, minimo }
  }

  const dias = (ahora - new Date(precios.actualizado_en).getTime()) / 86_400_000
  if (!Number.isFinite(dias) || dias > DIAS_PARA_NO_COTIZAR) {
    return { ok: false, motivo: 'precio_viejo', dias: Number.isFinite(dias) ? dias : Infinity }
  }

  const porGramo = Number(precios.precio_gramo_oro) + Number(precios.recargo_por_gramo)
  return { ok: true, total: porGramo * peso, porGramo, gramos: peso, dias, avisar: dias > DIAS_PARA_AVISAR }
}

/* ── De dónde llegó la clienta ───────────────────────────────────────── */

/** Lo que se le cuenta al modelo para que sepa de qué venía hablando. */
export function origen(r: any | null): string {
  if (!r) return ''

  const titular = r.headline || r.body || null
  const tipo = r.source_type === 'post' ? 'una publicación' : 'un anuncio'

  return titular
    ? `Esta persona llegó desde ${tipo} que decía: "${String(titular).slice(0, 160)}".`
    : `Esta persona llegó desde ${tipo}.`
}

/** Cómo anotarlo en el pedido, para poder medir qué creativo vende. */
export function anuncioDe(r: any | null): string | null {
  if (!r) return null
  const id = r.source_id || r.ctwa_clid || null
  return id ? `Anuncio: ${id}` : 'Llegó por anuncio'
}

/**
 * Los identificadores del anuncio, para guardarlos como datos y no como texto
 * en una nota.
 *
 * El `ctwa_clid` es el que importa de verdad: es lo que hay que devolverle a
 * Meta cuando la venta se cierra para que se la atribuya al anuncio que la
 * trajo. Sin él, Valentina vende y el anuncio nunca se entera.
 */
export function atribucionDe(r: any | null): { ctwa_clid: string | null; anuncio_id: string | null } {
  if (!r) return { ctwa_clid: null, anuncio_id: null }
  return {
    ctwa_clid: r.ctwa_clid ?? null,
    anuncio_id: r.source_id ?? null,
  }
}

/**
 * La marca `[ref: tiktok]` que el sitio le pega al primer mensaje.
 *
 * Existe porque TikTok, a diferencia de Meta, no manda ningún identificador
 * cuando su anuncio abre WhatsApp. Sin esto, todas esas conversaciones
 * parecerían tráfico directo y las campañas de TikTok se verían como si no
 * vendieran nada.
 */
export function refDelTexto(texto: unknown): string | null {
  const marca = String(texto ?? '').match(/\[ref:\s*([a-z0-9_-]{1,20})\]/i)
  return marca ? marca[1].toLowerCase() : null
}

/* ── Teléfonos ───────────────────────────────────────────────────────── */

/**
 * El mismo número entra de tres formas según por dónde llegue: `3143602930`
 * desde el panel, `+573143602930` desde el checkout y `573143602930` desde
 * WhatsApp. Comparar las cadenas crudas es cómo se llega a que un freno no
 * salte y a que la misma persona figure tres veces.
 *
 * Diez dígitos porque es el largo del móvil colombiano sin indicativo, y es el
 * mismo criterio del índice único de `customers` y de los disparadores de
 * `es_prueba`.
 */
export const diezUltimos = (t: unknown): string =>
  String(t ?? '').replace(/\D/g, '').slice(-10)

export const mismoTelefono = (a: unknown, b: unknown): boolean => {
  const x = diezUltimos(a)
  return x.length === 10 && x === diezUltimos(b)
}

/**
 * El número tal como lo quiere la API de WhatsApp: con indicativo.
 *
 * Un pedido cargado a mano en el panel guarda `3143602930`, sin país, y Meta
 * no entrega a eso. El 23 de agosto de 2026 diez de los dieciocho pedidos de
 * la base tenían el teléfono así.
 *
 * Sólo se le pone el 57 a lo que es inequívocamente un móvil colombiano —diez
 * dígitos empezando por 3—. Cualquier otra cosa se devuelve limpia de
 * separadores y sin inventar nada: mandarle un mensaje a un número que no es
 * el de la clienta es peor que no mandarlo.
 */
export function aNumeroDeWhatsApp(telefono: unknown): string {
  const digitos = String(telefono ?? '').replace(/\D/g, '')
  if (digitos.length === 10 && digitos.startsWith('3')) return `57${digitos}`
  return digitos
}
