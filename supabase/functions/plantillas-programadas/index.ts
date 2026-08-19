/**
 * Los avisos que salen solos por WhatsApp.
 *
 * Pasadas 24 horas del último mensaje del cliente, Meta no deja escribir texto
 * libre: sólo plantillas aprobadas. Esta función recorre la base buscando las
 * tres situaciones donde hace falta un aviso y no hay nadie mirando —un pedido
 * despachado sin avisar, un cobro generado sin pagar, una conversación que se
 * enfrió— y manda la plantilla que corresponde.
 *
 * Le escribe a clientes reales y una de las tres cuesta plata por mensaje. Los
 * frenos, entonces, no son opcionales:
 *
 *   · APAGADA por defecto. Sin PLANTILLAS_ACTIVAS='true' hace todo el recorrido
 *     y reporta qué mandaría, sin mandar nada. Es como se prueba sin riesgo.
 *   · Una sola vez. El candado es un índice único en la base, no un `if`.
 *   · Nunca a quien pidió que no le escriban, ni a una conversación que está
 *     en manos de una persona.
 *   · Tope diario para la de marketing, que es la única que se cobra siempre.
 *   · Si no se puede armar un mensaje concreto, no se manda. Un aviso vago es
 *     peor que ninguno.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { admin, enviarPlantilla } from '../_shared/wa.ts'

const ACTIVAS = Deno.env.get('PLANTILLAS_ACTIVAS') === 'true'

/* Cuántas de reactivación como máximo por día. Es la única que se cobra
   siempre, y sin tope un error de consulta se convierte en una factura. */
const TOPE_MARKETING_DIARIO = 30

/** Cada cuánto corre. Define la ventana de búsqueda para no repetir trabajo. */
const HORA = 60 * 60 * 1000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** El primer nombre. "Hola Laura" y no "Hola Laura Gómez Restrepo". */
const primerNombre = (completo: string | null): string => {
  const partes = String(completo ?? '').trim().split(/\s+/)
  return partes[0] || 'hola'
}

type Envio = {
  plantilla: string
  telefono: string
  pedidoId: string | null
  variables: string[]
}

/**
 * Manda una y la deja anotada.
 *
 * El registro se escribe ANTES de mandar, porque el índice único es lo que
 * garantiza que no salga dos veces: si dos corridas se solapan, la segunda
 * choca contra la base y se retira. Escribir después dejaría una ventana en la
 * que las dos creerían ser la primera.
 */
async function mandar(e: Envio): Promise<'enviada' | 'repetida' | 'apagada' | string> {
  const db = admin()

  const { error: choque } = await db.from('plantillas_enviadas').insert({
    phone_number: e.telefono,
    plantilla: e.plantilla,
    pedido_id: e.pedidoId,
  })

  if (choque) {
    if (choque.code === '23505') return 'repetida'
    console.error('No se pudo anotar el envío:', choque.message)
    return `no se anotó: ${choque.message}`
  }

  if (!ACTIVAS) {
    /* Modo prueba: se anotó para ver el recorrido completo, pero no se manda.
       Se borra la anotación para que la corrida real sí pueda hacerlo. */
    await db.from('plantillas_enviadas')
      .delete()
      .eq('phone_number', e.telefono)
      .eq('plantilla', e.plantilla)
      .is('pedido_id', e.pedidoId === null ? null : undefined)
      .eq('pedido_id', e.pedidoId ?? '00000000-0000-0000-0000-000000000000')
    return 'apagada'
  }

  const res = await enviarPlantilla(e.telefono, e.plantilla, e.variables)

  await db.from('plantillas_enviadas')
    .update({ wamid: res.wamid ?? null, error: res.ok ? null : (res.error ?? 'falló') })
    .eq('phone_number', e.telefono)
    .eq('plantilla', e.plantilla)

  return res.ok ? 'enviada' : (res.error ?? 'falló')
}

/** ¿A esta persona se le puede escribir? */
async function sePuede(telefono: string): Promise<boolean> {
  const db = admin()

  const [{ data: cliente }, { data: humano }] = await Promise.all([
    db.from('customers').select('no_escribir').eq('phone', telefono).maybeSingle(),
    db.from('chat_takeover').select('is_active').eq('phone_number', telefono).eq('is_active', true).maybeSingle(),
  ])

  if (cliente?.no_escribir) return false
  // Si una persona del equipo está atendiendo, el robot no interrumpe.
  if (humano) return false
  return true
}

/* ─── 1. Pedido despachado ──────────────────────────────────────────
   El mensaje que más tranquiliza: el cliente pagó por algo que todavía no
   vio. Se busca hacia atrás dos días y no más, para que una primera corrida
   no despierte pedidos viejos. */
async function despachados(): Promise<Envio[]> {
  const { data } = await admin()
    .from('orders')
    .select('id, customer_name, customer_phone, product_name, tracking_number, status_updated_at')
    .eq('status', 'enviado')
    .not('tracking_number', 'is', null)
    .not('customer_phone', 'is', null)
    .gte('status_updated_at', new Date(Date.now() - 48 * HORA).toISOString())

  return (data ?? []).map((o) => ({
    plantilla: 'pedido_despachado',
    telefono: o.customer_phone!,
    pedidoId: o.id,
    variables: [primerNombre(o.customer_name), o.product_name, o.tracking_number!],
  }))
}

/* ─── 2. Pago pendiente ─────────────────────────────────────────────
   Se generó el enlace de Mercado Pago y no entró la plata. Se espera tres
   horas —mucha gente paga en un rato, y escribirle a los diez minutos es
   apurar— y se deja de insistir a los dos días. */
async function sinPagar(): Promise<Envio[]> {
  const ahora = Date.now()
  const { data } = await admin()
    .from('orders')
    .select('id, customer_name, customer_phone, product_name')
    .eq('status', 'pendiente')
    .eq('payment_method', 'mercadopago')
    .not('mp_preference_id', 'is', null)
    .not('customer_phone', 'is', null)
    .lte('created_at', new Date(ahora - 3 * HORA).toISOString())
    .gte('created_at', new Date(ahora - 48 * HORA).toISOString())

  return (data ?? []).map((o) => ({
    plantilla: 'pago_pendiente',
    telefono: o.customer_phone!,
    pedidoId: o.id,
    variables: [primerNombre(o.customer_name), o.product_name],
  }))
}

/* ─── 3. Cotización sin cerrar ──────────────────────────────────────
   La única de marketing, la única que cuesta. Se busca a quien habló, se
   interesó en una pieza concreta y no volvió.

   El requisito de "pieza concreta" no es un adorno: la plantilla dice "te
   había pasado el precio de {{2}}", y si no sabemos qué pieza era, el mensaje
   queda vago y molesta en vez de vender. Antes que mandar algo genérico, no
   se manda. */
async function enfriadas(): Promise<Envio[]> {
  const db = admin()
  const ahora = Date.now()

  /* Quiénes escribieron hace dos o cuatro días y no volvieron. Se mira el
     último mensaje de cada persona. */
  const { data: mensajes } = await db
    .from('whatsapp_conversaciones')
    .select('phone_number, created_at')
    .eq('role', 'user')
    .gte('created_at', new Date(ahora - 4 * 24 * HORA).toISOString())
    .order('created_at', { ascending: false })

  const ultimoDe = new Map<string, string>()
  for (const m of mensajes ?? []) {
    if (!ultimoDe.has(m.phone_number)) ultimoDe.set(m.phone_number, m.created_at)
  }

  const candidatos = [...ultimoDe.entries()]
    .filter(([, cuando]) => Date.now() - new Date(cuando).getTime() >= 2 * 24 * HORA)
    .map(([telefono]) => telefono)

  if (!candidatos.length) return []

  // Quien ya compró alguna vez no es una cotización sin cerrar.
  const { data: conPedido } = await db
    .from('orders')
    .select('customer_phone')
    .in('customer_phone', candidatos)

  const compraron = new Set((conPedido ?? []).map((o) => o.customer_phone))
  const frios = candidatos.filter((t) => !compraron.has(t))
  if (!frios.length) return []

  const [{ data: piezas }, { data: clientes }] = await Promise.all([
    db.from('products').select('name'),
    db.from('customers').select('phone, name').in('phone', frios),
  ])

  const nombreDe = new Map((clientes ?? []).map((c) => [c.phone, c.name]))
  const catalogo = (piezas ?? []).map((p) => p.name)

  const envios: Envio[] = []

  for (const telefono of frios) {
    /* Qué pieza se le mostró. Se busca en lo que Valentina escribió, no en lo
       que escribió el cliente: el nombre exacto del catálogo sale de nuestro
       lado, no del suyo. */
    const { data: dichos } = await db
      .from('whatsapp_conversaciones')
      .select('content')
      .eq('phone_number', telefono)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(12)

    const texto = (dichos ?? []).map((d) => d.content ?? '').join(' ')
    const pieza = catalogo.find((n) => texto.includes(n))
    if (!pieza) continue          // sin pieza concreta no hay mensaje que valga

    envios.push({
      plantilla: 'cotizacion_sin_cerrar',
      telefono,
      pedidoId: null,             // una sola vez por persona, para siempre
      variables: [primerNombre(nombreDe.get(telefono) ?? null), pieza],
    })
  }

  return envios
}

/** Cuántas de marketing salieron hoy, para no pasarse del tope. */
async function marketingDeHoy(): Promise<number> {
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)

  const { count } = await admin()
    .from('plantillas_enviadas')
    .select('id', { count: 'exact', head: true })
    .eq('plantilla', 'cotizacion_sin_cerrar')
    .is('error', null)
    .gte('enviada_en', desde.toISOString())

  return count ?? 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const t0 = Date.now()
  const resultado: Record<string, unknown> = { activas: ACTIVAS, enviadas: 0, saltadas: 0, detalle: [] as unknown[] }
  const detalle = resultado.detalle as unknown[]

  try {
    const [aDespachar, aCobrar, aRetomar] = await Promise.all([despachados(), sinPagar(), enfriadas()])

    let cupoMarketing = Math.max(0, TOPE_MARKETING_DIARIO - (await marketingDeHoy()))

    for (const envio of [...aDespachar, ...aCobrar, ...aRetomar]) {
      const esMarketing = envio.plantilla === 'cotizacion_sin_cerrar'

      if (esMarketing && cupoMarketing <= 0) {
        detalle.push({ ...envio, resultado: 'tope diario de marketing' })
        resultado.saltadas = (resultado.saltadas as number) + 1
        continue
      }

      if (!(await sePuede(envio.telefono))) {
        detalle.push({ plantilla: envio.plantilla, telefono: envio.telefono, resultado: 'no se le escribe' })
        resultado.saltadas = (resultado.saltadas as number) + 1
        continue
      }

      const res = await mandar(envio)
      detalle.push({ plantilla: envio.plantilla, telefono: envio.telefono, variables: envio.variables, resultado: res })

      if (res === 'enviada') {
        resultado.enviadas = (resultado.enviadas as number) + 1
        if (esMarketing) cupoMarketing--
      } else {
        resultado.saltadas = (resultado.saltadas as number) + 1
      }
    }

    resultado.ms = Date.now() - t0
    console.log(`plantillas · ${resultado.enviadas} enviadas · ${resultado.saltadas} saltadas · ${resultado.ms} ms` +
                (ACTIVAS ? '' : ' · MODO PRUEBA, no se mandó nada'))
    return json(resultado)
  } catch (e) {
    console.error('plantillas-programadas falló:', e instanceof Error ? e.message : e)
    return json({ error: 'falló', detalle: String(e) }, 500)
  }
})
