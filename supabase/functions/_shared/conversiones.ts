/**
 * Le cuenta la venta a TikTok y a Meta desde el servidor.
 *
 * Por qué hace falta si los píxeles ya están puestos: el píxel del navegador
 * sólo dispara la compra si el cliente **vuelve** a la página de confirmación
 * después de pagar. Mucha gente cierra la pestaña, se le corta el banco, o
 * paga desde el link que Valentina le mandó por WhatsApp y nunca pasa por el
 * sitio. Esas ventas existen y hoy ninguna plataforma las ve.
 *
 * El webhook de Mercado Pago, en cambio, se entera siempre. Desde ahí se
 * manda la misma compra con el mismo identificador de pedido, y entre las dos
 * vías queda una sola venta: `event_id` en TikTok y `event_id` en Meta son lo
 * que les dice que es la misma, no dos.
 *
 * Qué sale de acá: el correo y el teléfono del comprador, cifrados con
 * SHA-256 —ninguna de las dos plataformas recibe el dato en claro y ninguna
 * puede revertirlo—, el monto, la pieza, los identificadores de clic, y la IP
 * y el navegador del comprador. Estos dos últimos van en claro porque así los
 * exigen ambas: Meta descarta el evento web que llega sin user agent. NO sale
 * el nombre, la dirección de entrega ni nada del medio de pago.
 *
 * Si falta el token de una plataforma, esa mitad no se envía y la otra sigue
 * funcionando. Si fallan las dos, la venta ya quedó registrada igual: esto
 * nunca puede tumbar un cobro.
 */

const TIKTOK_TOKEN = Deno.env.get('TIKTOK_ACCESS_TOKEN')
const TIKTOK_PIXEL = Deno.env.get('TIKTOK_PIXEL_ID')
const META_TOKEN = Deno.env.get('META_CAPI_TOKEN')
const META_PIXEL = Deno.env.get('META_PIXEL_ID')

const TIKTOK_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/'
const META_VERSION = 'v21.0'

/** Cuánto se espera por cada plataforma antes de rendirse. */
const TIEMPO_MAX_MS = 5_000

export type Venta = {
  pedidoId: string
  monto: number
  correo?: string | null
  telefono?: string | null
  piezaId?: string | null
  piezaNombre?: string | null
  ttclid?: string | null
  ttp?: string | null
  fbc?: string | null
  fbp?: string | null
  url?: string | null
  ua?: string | null
  ip?: string | null
  /* Cuándo ocurrió la compra, en segundos unix. Por defecto, ahora. Sólo hace
     falta pasarlo cuando el aviso llega tarde —el contraentrega se confirma
     días después— y hay que fecharlo cuando la persona compró de verdad. */
  momento?: number
}

/* ─── Cifrado ───────────────────────────────────────────────────────
   Las dos plataformas piden SHA-256 en hexadecimal, sobre el valor
   normalizado. Normalizar importa: "Ana@Gmail.com " y "ana@gmail.com" tienen
   que dar el mismo resultado o el cruce falla y el envío no sirve de nada. */

async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const resumen = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Minúsculas y sin espacios alrededor: lo que esperan ambas. */
const correoNormal = (correo: string) => correo.trim().toLowerCase()

/**
 * Teléfono en E.164, que es el formato que piden: prefijo del país y nada
 * más. Los números colombianos se guardan de muchas formas —"3001234567",
 * "+57 300 123 4567", "57 300..."— y todas tienen que terminar igual o el
 * cruce no ocurre.
 */
function telefonoNormal(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '')
  if (!digitos) return null
  if (digitos.startsWith('57') && digitos.length === 12) return `+${digitos}`
  if (digitos.length === 10) return `+57${digitos}`
  // Otro país o algo que no reconocemos: se manda tal cual con el +.
  return `+${digitos}`
}

async function identificadores(venta: Venta) {
  const correo = venta.correo ? await sha256(correoNormal(venta.correo)) : null
  const telefonoLimpio = venta.telefono ? telefonoNormal(venta.telefono) : null
  const telefono = telefonoLimpio ? await sha256(telefonoLimpio) : null
  /* El número de pedido como identificador propio: le permite a la plataforma
     reconocer al mismo comprador entre visitas sin que le mandemos quién es. */
  const externo = await sha256(venta.pedidoId)
  return { correo, telefono, externo }
}

/** Quita las claves vacías: mandar nulos ensucia y a veces la API los rechaza. */
const limpio = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ) as Partial<T>

/** fetch con tope de tiempo: el webhook de Mercado Pago no puede quedarse colgado. */
async function pedir(url: string, opciones: RequestInit): Promise<Response> {
  const corte = AbortSignal.timeout(TIEMPO_MAX_MS)
  return await fetch(url, { ...opciones, signal: corte })
}

/* ─── TikTok ────────────────────────────────────────────────────────
   Events API 2.0, endpoint /open_api/v1.3/event/track/. El token va en la
   cabecera Access-Token, no como Bearer. */

async function aTikTok(venta: Venta, momento: number): Promise<string> {
  if (!TIKTOK_TOKEN || !TIKTOK_PIXEL) return 'sin configurar'

  const { correo, telefono, externo } = await identificadores(venta)

  const cuerpo = {
    event_source: 'web',
    event_source_id: TIKTOK_PIXEL,
    data: [{
      /* TikTok renombró CompletePayment a Purchase en mayo de 2025. Este
         nombre tiene que ser idéntico al que dispara el píxel del navegador
         o la deduplicación por event_id no ocurre. */
      event: 'Purchase',
      event_time: momento,
      event_id: venta.pedidoId,
      user: limpio({
        email: correo,
        phone: telefono,
        external_id: externo,
        ttclid: venta.ttclid,
        ttp: venta.ttp,
        ip: venta.ip,
        user_agent: venta.ua,
      }),
      properties: limpio({
        currency: 'COP',
        value: venta.monto,
        contents: venta.piezaId
          ? [limpio({
              content_id: venta.piezaId,
              content_type: 'product',
              content_name: venta.piezaNombre,
              quantity: 1,
              price: venta.monto,
            })]
          : undefined,
      }),
      page: limpio({ url: venta.url }),
    }],
  }

  const res = await pedir(TIKTOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': TIKTOK_TOKEN },
    body: JSON.stringify(cuerpo),
  })

  const texto = await res.text()
  /* TikTok responde 200 aunque rechace el evento: el resultado real viene en
     el campo `code` del cuerpo, donde 0 es éxito. Mirar sólo res.ok haría
     pasar por bueno un envío que no se registró. */
  let codigo: unknown = null
  try { codigo = JSON.parse(texto)?.code } catch { /* respuesta no-JSON */ }

  if (!res.ok || codigo !== 0) {
    throw new Error(`TikTok ${res.status} code=${codigo}: ${texto.slice(0, 200)}`)
  }
  return 'ok'
}

/* ─── Meta ──────────────────────────────────────────────────────────
   API de Conversiones. Aquí el token va como parámetro access_token y los
   identificadores del usuario en user_data. */

async function aMeta(venta: Venta, momento: number): Promise<string> {
  if (!META_TOKEN || !META_PIXEL) return 'sin configurar'

  const { correo, telefono, externo } = await identificadores(venta)

  const cuerpo = {
    data: [{
      event_name: 'Purchase',
      event_time: momento,
      /* El mismo identificador que usa el píxel del navegador. Meta junta las
         dos y cuenta una sola venta. */
      event_id: venta.pedidoId,
      action_source: 'website',
      event_source_url: venta.url || undefined,
      user_data: limpio({
        em: correo,
        ph: telefono,
        external_id: externo,
        fbc: venta.fbc,
        fbp: venta.fbp,
        /* Meta descarta los eventos con action_source 'website' que llegan
           sin client_user_agent. No es opcional: sin esto la venta no se
           registra. Viene del checkout, guardado con el pedido. */
        client_user_agent: venta.ua,
        client_ip_address: venta.ip,
      }),
      custom_data: limpio({
        currency: 'COP',
        value: venta.monto,
        content_type: venta.piezaId ? 'product' : undefined,
        content_ids: venta.piezaId ? [venta.piezaId] : undefined,
        content_name: venta.piezaNombre,
      }),
    }],
  }

  const url = `https://graph.facebook.com/${META_VERSION}/${META_PIXEL}/events?access_token=${encodeURIComponent(META_TOKEN)}`
  const res = await pedir(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })

  if (!res.ok) {
    throw new Error(`Meta ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return 'ok'
}

/**
 * Manda la venta a las dos plataformas.
 *
 * Nunca lanza: el pago ya está cobrado y registrado cuando esto corre, y que
 * falle la medición no puede romper el webhook ni hacer que Mercado Pago
 * reintente. Los fallos quedan en el log, que es donde se miran.
 */
export async function avisarVenta(venta: Venta): Promise<void> {
  if (!venta.pedidoId || !(venta.monto > 0)) return

  const momento = venta.momento ?? Math.floor(Date.now() / 1000)

  const [tiktok, meta] = await Promise.allSettled([
    aTikTok(venta, momento),
    aMeta(venta, momento),
  ])

  const contar = (r: PromiseSettledResult<string>, quien: string) => {
    if (r.status === 'fulfilled') {
      if (r.value === 'ok') console.log(`conversión → ${quien}: ok`)
      else console.log(`conversión → ${quien}: ${r.value}`)
    } else {
      console.error(`conversión → ${quien} falló:`, r.reason?.message ?? r.reason)
    }
  }

  contar(tiktok, 'TikTok')
  contar(meta, 'Meta')
}
