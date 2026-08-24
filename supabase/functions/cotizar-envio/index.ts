/**
 * Cuánto cuesta mandar este pedido, según las cinco transportadoras.
 *
 * Fase 1 de la integración con 99envios, del 24 de agosto de 2026. Sólo
 * COTIZA: no crea guías, no mueve pedidos, no cobra nada. Es de lectura pura,
 * y por eso es por donde se empieza — si algo está mal entendido de su API, lo
 * peor que pasa es que salga un número raro en una pantalla.
 *
 * Para qué sirve de verdad: hoy el abono del envío son $20.000 fijos, vaya el
 * paquete a Chapinero o a Leticia, y `costo_envio` se escribe a mano después
 * —por eso está casi siempre vacío y el panel avisa de que no puede decir qué
 * pieza deja más—. Esto trae el número real antes de prometer nada.
 *
 * ── Cómo se autentica ───────────────────────────────────────────────────────
 *
 * 99envios da un JWT a cambio de correo y contraseña, que viven en los
 * secretos de Supabase y no salen de aquí. Su documentación recomienda
 * renovarlo a diario; se guarda en memoria del proceso y se pide otro cuando
 * caduca o cuando la API contesta 401. No se guarda en la base a propósito:
 * es una credencial y la base la leen más manos que esta función.
 *
 * ── Los frenos ──────────────────────────────────────────────────────────────
 *
 *   · Pide sesión de admin. Cotizar es barato pero no es gratis: son 300 por
 *     hora para toda la cuenta, y dejarlo abierto es regalar ese cupo.
 *   · Si la ciudad no se puede traducir a un código DANE, no se inventa: se
 *     dice cuál era y se para. Una guía al municipio equivocado es un paquete
 *     perdido.
 *   · Nunca lanza hacia arriba. Un fallo de la API de otro no puede tumbar una
 *     pantalla del panel.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/* La URL base vive en un secreto porque la de integración y la de producción
   son distintas, y equivocarse de una es cotizar contra datos que no existen. */
const BASE = Deno.env.get('ENVIOS99_URL') ?? 'https://integration1.99envios.app'

/** El token y hasta cuándo sirve. En memoria del proceso, no en la base. */
let token: string | null = null
let tokenHasta = 0

/* Veinte horas. Su documentación dice «renuévenlo a diario»; se pide antes de
   que cumpla el día para no descubrir que caducó en mitad de una cotización. */
const DURA_MS = 20 * 60 * 60 * 1000

async function entrar(forzar = false): Promise<string> {
  if (!forzar && token && Date.now() < tokenHasta) return token

  const email = Deno.env.get('ENVIOS99_EMAIL')
  const password = Deno.env.get('ENVIOS99_PASSWORD')
  if (!email || !password) throw new Error('Faltan ENVIOS99_EMAIL o ENVIOS99_PASSWORD')

  const res = await fetch(`${BASE}/api/integration/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    /* Sin el cuerpo entero en el log: puede traer de vuelta lo que se mandó. */
    throw new Error(`99envios rechazó el login (HTTP ${res.status})`)
  }

  /* Su ejemplo devuelve `token`, pero hay APIs que lo llaman de otras formas y
     la especificación no fija el nombre. Se buscan las variantes conocidas
     antes de darse por vencido, que es más barato que un despliegue. */
  const t = cuerpo?.token ?? cuerpo?.access_token ?? cuerpo?.data?.token ?? cuerpo?.jwt
  if (!t) throw new Error('El login de 99envios no devolvió token')

  token = String(t)
  tokenHasta = Date.now() + DURA_MS
  return token
}

/** Una llamada con token, reintentando una vez si el token había caducado. */
async function conToken(ruta: string, cuerpo: unknown): Promise<{ ok: boolean; status: number; datos: any }> {
  for (const reintento of [false, true]) {
    const t = await entrar(reintento)
    const res = await fetch(`${BASE}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => ({}))

    /* 401 la primera vez es un token vencido: se pide otro y se repite. La
       segunda vez ya no, que sería un bucle contra la API de un tercero. */
    if (res.status === 401 && !reintento) { token = null; continue }
    return { ok: res.ok, status: res.status, datos }
  }
  return { ok: false, status: 401, datos: { error: 'No se pudo autenticar con 99envios' } }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const autorizacion = req.headers.get('Authorization')
  if (!autorizacion) return json({ error: 'Falta la sesión' }, 401)

  const comoUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacion } }, auth: { persistSession: false } },
  )
  const { data: { user }, error: errorSesion } = await comoUsuario.auth.getUser()
  if (errorSesion || !user) return json({ error: 'Sesión inválida' }, 401)

  let cuerpo: { pedidoId?: string }
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo ilegible' }, 400) }

  const pedidoId = String(cuerpo.pedidoId ?? '').trim()
  if (!pedidoId) return json({ error: 'Falta el pedido' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: pedido } = await admin
    .from('orders')
    .select('id, amount, shipping_city, shipping_department, product_id, payment_method')
    .eq('id', pedidoId)
    .maybeSingle()

  if (!pedido) return json({ error: 'No existe ese pedido' }, 404)

  /* La ciudad, traducida a código DANE. Si no se puede, se dice cuál era: el
     mensaje tiene que servir para arreglarlo, no sólo para saber que falló. */
  const { data: codigo } = await admin.rpc('codigo_dane', {
    p_ciudad: pedido.shipping_city,
    p_departamento: pedido.shipping_department,
  })

  if (!codigo) {
    return json({
      error: 'ciudad_no_reconocida',
      detalle: pedido.shipping_city
        ? `No se pudo traducir «${pedido.shipping_city}${pedido.shipping_department ? ', ' + pedido.shipping_department : ''}» a un municipio. Puede ser un nombre ambiguo: revísalo en el pedido.`
        : 'El pedido no tiene ciudad de envío.',
    }, 422)
  }

  /* La caja. Igual que en el panel: la de la pieza si la tiene, y si no la de
     la casa. Se lee aquí y no se recibe del navegador porque de estos cuatro
     números depende lo que cobre la transportadora. */
  const [{ data: precios }, { data: pieza }] = await Promise.all([
    admin.from('taller_precios').select('envio_peso_kg, envio_alto_cm, envio_largo_cm, envio_ancho_cm').maybeSingle(),
    pedido.product_id
      ? admin.from('products').select('envio_peso_kg, envio_alto_cm, envio_largo_cm, envio_ancho_cm').eq('id', pedido.product_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const positivo = (v: unknown, respaldo: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : respaldo
  }
  const caja = {
    peso: positivo(pieza?.envio_peso_kg, positivo(precios?.envio_peso_kg, 1)),
    alto: positivo(pieza?.envio_alto_cm, positivo(precios?.envio_alto_cm, 6)),
    largo: positivo(pieza?.envio_largo_cm, positivo(precios?.envio_largo_cm, 15)),
    ancho: positivo(pieza?.envio_ancho_cm, positivo(precios?.envio_ancho_cm, 12)),
  }

  const hoy = new Date()
  const fecha = `${String(hoy.getDate()).padStart(2, '0')}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`

  try {
    const { ok, status, datos } = await conToken('/api/integration/v1/cotizar', {
      destino: { codigo: String(codigo), nombre: pedido.shipping_city ?? '' },
      origen: { codigo: '', nombre: '' },   // lo sabe la cuenta, por el token
      IdTipoEntrega: 1,
      IdServicio: 1,
      valorDeclarado: Number(pedido.amount) || 0,
      peso: caja.peso,
      alto: caja.alto,
      largo: caja.largo,
      ancho: caja.ancho,
      fecha,
      seguro99: false,
      seguro99plus: false,
      /* Contrapago apagado: hoy el mensajero entrega la plata y punto. Que la
         transportadora cobre por nosotros es una decisión de negocio sin
         tomar, y cambiaría cómo entra el dinero. */
      AplicaContrapago: false,
    })

    if (status === 429) {
      return json({ error: 'sin_cupo', detalle: 'Se agotaron las 300 cotizaciones de esta hora. Vuelve a intentarlo más tarde.' }, 429)
    }
    if (!ok) {
      console.error('99envios no cotizó:', status, JSON.stringify(datos).slice(0, 300))
      return json({ error: 'no_cotizo', detalle: `99envios respondió ${status}`, respuesta: datos }, 502)
    }

    /* La respuesta viene con una clave por transportadora. Se aplana a una
       lista ordenada de barata a cara, que es como se mira. */
    const opciones = Object.entries(datos as Record<string, any>)
      .filter(([, v]) => v && typeof v === 'object' && v.exito !== false)
      .map(([transportadora, v]) => ({
        transportadora,
        flete: Number(v.valor) || 0,
        sobreflete: Number(v.sobreflete) || 0,
        contrapago: Number(v.valor_contrapago) || 0,
        /* `comision_interna` en cuatro de las cinco y `valor_interna` en TCC.
           No es una errata mía: su respuesta las llama distinto. */
        comision: Number(v.comision_interna ?? v.valor_interna) || 0,
        dias: v.dias ?? null,
        entregaEstimada: v.fecha_entrega ?? null,
        total: (Number(v.valor) || 0) + (Number(v.sobreflete) || 0) + (Number(v.comision_interna ?? v.valor_interna) || 0),
      }))
      .sort((a, b) => a.total - b.total)

    return json({ ok: true, ciudad: pedido.shipping_city, codigoDane: codigo, caja, opciones })
  } catch (e) {
    console.error('Cotizando con 99envios:', e instanceof Error ? e.message : e)
    return json({ error: 'no_se_pudo', detalle: e instanceof Error ? e.message : 'Error desconocido' }, 502)
  }
})
