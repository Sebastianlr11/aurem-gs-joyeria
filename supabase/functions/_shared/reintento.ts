/**
 * Reintentar cuando el que falla es el camino, no la consulta.
 *
 * ── El incidente ──────────────────────────────────────────────────────────
 *
 * El 8 de septiembre de 2026, desde las 11 de la mañana, la puerta de enlace
 * de Supabase empezó a devolver `504 Gateway Timeout` de forma intermitente a
 * las llamadas que salen **desde las Edge Functions** hacia la base. Desde
 * fuera el API respondía perfecto —50 de 50— y las consultas afectadas tardan
 * milisegundos: `regla_del_dinero_cuadra` 3 ms, `caja_cuadra_con_la_regla`
 * 6 ms, `politicas_flojas` 28 ms. En los registros de PostgREST aparecía
 * `Warp server error: Thread killed by timeout manager` en esos mismos
 * instantes. El día anterior hubo cero. Era un tropiezo de la plataforma.
 *
 * Costó dos cosas, y ninguna hacía falta:
 *
 *   1. El vigía mandó dos correos de «REVISAR AHORA · hay 2 cosas que no
 *      están funcionando» por tres comprobaciones que, corridas a mano un
 *      rato después, pasaban las tres sin una sola queja.
 *   2. `plantillas-programadas` no pudo escribir el candado anti-duplicado de
 *      una plantilla en tres corridas seguidas, así que ese mensaje no salió
 *      esas horas. No se duplicó nada —el candado se escribe ANTES de mandar—
 *      pero la clienta esperó tres horas de más.
 *
 * ── Qué hace esto ─────────────────────────────────────────────────────────
 *
 * Un segundo intento. Nada más. Una consulta de 6 ms que contesta «504» no ha
 * fallado: no llegó. Rendirse al primer intento convierte un bache de la red
 * en un correo de emergencia o en un mensaje que no sale.
 *
 * ── Lo que NO se reintenta, y por qué importa ─────────────────────────────
 *
 * Sólo se repite lo que puede salir distinto: 502, 503, 504, conexiones
 * caídas, esperas agotadas. **Nunca una respuesta de la base**: un 23505 —el
 * candado de plantillas diciendo «ésta ya salió»— es una respuesta correcta, y
 * repetirla sería mandar el mensaje dos veces. Lo mismo con los permisos y con
 * una consulta mal escrita: reintentar no las arregla y esconde el error de
 * verdad.
 *
 * Sin nada de Deno dentro, para poder probarlo desde Node como `reglas.ts`.
 */

/** Lo que devuelve supabase-js cuando algo sale mal. */
export type Fallo = { message?: string; code?: string; status?: number } | null | undefined

/* Las señales de que no llegamos, en el texto del error. En minúsculas: los
   mensajes vienen del gateway, de Deno y de Postgres, y cada uno escribe como
   quiere. */
const SENALES = [
  'gateway timeout',
  'bad gateway',
  'service unavailable',
  'fetch failed',
  'error sending request',
  'connection closed',
  'connection reset',
  'connection refused',
  'timed out',
  'timeout',
  'socket hang up',
]

/* Los códigos de Postgres que hablan de la conexión y no de los datos:
   fallo de conexión, conexión rota, consulta cancelada por plazo y
   demasiadas conexiones. */
const CODIGOS = ['08006', '08003', '08001', '57014', '53300', '502', '503', '504']

/**
 * ¿Este fallo merece otro intento?
 *
 * Devuelve `false` ante la duda. Reintentar de más es mandarle a alguien el
 * mismo WhatsApp dos veces; reintentar de menos es lo que ya teníamos.
 */
export function esTropiezo(error: Fallo): boolean {
  if (!error) return false

  const codigo = String(error.code ?? '')

  /* Respuestas de la base, no tropiezos. La clase 23 es integridad —el 23505
     del candado de plantillas vive aquí—, la 42 es permisos y sintaxis, y
     PGRST es PostgREST diciendo que la petición está mal escrita. Repetir
     cualquiera de las tres da exactamente el mismo error, y en el caso del
     candado además duplicaría un mensaje. */
  if (/^(23|42)/.test(codigo) || codigo.startsWith('PGRST')) return false

  if (CODIGOS.includes(codigo)) return true
  if ([502, 503, 504].includes(Number(error.status))) return true

  const texto = String(error.message ?? '').toLowerCase()
  return SENALES.some((s) => texto.includes(s))
}

export interface OpcionesDeReintento {
  /** Cuántos intentos en total, contando el primero. */
  intentos?: number
  /** La espera antes del segundo intento; el tercero espera el doble. */
  esperaMs?: number
  /** Para dejarlo en el registro: sin esto los reintentos son invisibles. */
  alReintentar?: (intento: number, error: Fallo) => void
  /** Sólo para las pruebas, que no pueden esperar de verdad. */
  dormir?: (ms: number) => Promise<void>
}

const dormirDeVerdad = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Corre una llamada a la base y la repite si el fallo fue del camino.
 *
 * Recibe una función y no una promesa a propósito: una promesa ya empezó, y
 * lo que hace falta es poder empezarla otra vez.
 *
 * Devuelve el último resultado tal cual —con su `error` dentro si los dos
 * intentos fallaron—, así que quien llama sigue mirando el error como
 * siempre y no hay que cambiar cómo se leen las respuestas.
 */
export async function conReintento<T extends { error?: Fallo }>(
  hacer: () => PromiseLike<T>,
  opciones: OpcionesDeReintento = {},
): Promise<T> {
  const { intentos = 3, esperaMs = 400, alReintentar, dormir = dormirDeVerdad } = opciones

  let ultimo: T | undefined

  for (let intento = 1; intento <= intentos; intento++) {
    ultimo = await hacer()

    if (!esTropiezo(ultimo.error) || intento === intentos) return ultimo

    alReintentar?.(intento, ultimo.error)
    /* Creciente: si el gateway está congestionado, volver de inmediato es
       ponerse en la misma cola. */
    await dormir(esperaMs * intento)
  }

  return ultimo as T
}
