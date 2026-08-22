/**
 * El vigía: revisa que el negocio esté funcionando y avisa sólo si no.
 *
 * Existe por lo que pasó el 21 de agosto de 2026. Se rompieron dos cosas
 * —las fotos por WhatsApp y las fuentes del sitio— y las dos las encontró
 * una persona probando a mano. Nada avisaba. Con pauta encendida, un webhook
 * caído o un bot mudo son ventas perdidas durante horas sin que nadie sepa.
 *
 * Las comprobaciones NO son genéricas: cada una corresponde a algo que ya
 * falló o que, si falla, cuesta plata directamente.
 *
 * SÓLO manda correo cuando algo está mal. Un resumen diario de "todo bien"
 * se convierte en un correo que nadie abre, y el día que diga otra cosa
 * tampoco lo van a abrir.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { admin } from '../_shared/wa.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secreto',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (c: unknown, s = 200) =>
  new Response(JSON.stringify(c), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

type Hallazgo = { que: string; detalle: string; grave: boolean }

/** Comparación de largo constante, para que el error no delate el secreto. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const db = admin()

  const { data: ajuste } = await db
    .from('ajustes_internos').select('valor').eq('clave', 'cron_secreto').maybeSingle()
  const secreto = String(ajuste?.valor ?? '')
  if (!secreto) return json({ error: 'sin configurar' }, 500)
  if (!iguales(String(req.headers.get('x-cron-secreto') ?? ''), secreto)) {
    return json({ error: 'no autorizado' }, 401)
  }

  const hallazgos: Hallazgo[] = []
  const ahora = Date.now()
  const hace = (min: number) => new Date(ahora - min * 60_000).toISOString()

  /* ── 1. Mensajes que Meta no entregó ────────────────────────────────
     Esta es la que habría cazado el fallo de las fotos WebP el mismo día:
     Meta aceptaba la petición y después no entregaba, y en la base quedaba
     delivery_status 'failed' sin que nadie lo mirara. */
  const { data: fallidos } = await db
    .from('whatsapp_conversaciones')
    .select('content, message_type')
    .eq('delivery_status', 'failed')
    .gte('created_at', hace(70))

  if (fallidos?.length) {
    const tipos = [...new Set(fallidos.map((m) => m.message_type ?? 'texto'))].join(', ')
    hallazgos.push({
      que: `${fallidos.length} mensaje(s) de WhatsApp no se entregaron`,
      detalle: `Tipo: ${tipos}. Ejemplo: "${String(fallidos[0].content ?? '').slice(0, 90)}"`,
      grave: true,
    })
  }

  /* ── 2. Clientes esperando ──────────────────────────────────────────
     Alguien escribió y no le contestó ni el bot ni una persona. Valentina
     tarda segundos; si pasan veinte minutos, algo se rompió. Se ignoran las
     conversaciones en manos de una persona: ahí el silencio es decisión. */
  const { data: recientes } = await db
    .from('whatsapp_conversaciones')
    .select('phone_number, created_at, role')
    .gte('created_at', hace(180))
    .order('created_at', { ascending: true })

  const ultimoPorChat = new Map<string, { role: string; created_at: string }>()
  for (const m of recientes ?? []) ultimoPorChat.set(m.phone_number, m)

  const esperando: string[] = []
  for (const [telefono, m] of ultimoPorChat) {
    if (m.role !== 'user') continue
    if (Date.now() - new Date(m.created_at).getTime() < 20 * 60_000) continue
    const { data: manual } = await db
      .from('chat_takeover').select('id')
      .eq('phone_number', telefono).eq('is_active', true).maybeSingle()
    if (!manual) esperando.push(telefono)
  }
  if (esperando.length) {
    hallazgos.push({
      que: `${esperando.length} cliente(s) escribieron y nadie respondió`,
      detalle: esperando.slice(0, 5).join(', '),
      grave: true,
    })
  }

  /* ── 3. Plata cobrada sin procesar ──────────────────────────────────
     El pago entró en Mercado Pago pero el webhook no terminó su trabajo: sin
     conversion_enviada_en no salieron ni el correo, ni el WhatsApp, ni la
     venta a Meta y TikTok. Es el fallo más caro de todos. */
  const { data: colgados } = await db
    .from('orders')
    .select('id, customer_name, amount')
    .not('mp_payment_id', 'is', null)
    .is('conversion_enviada_en', null)
    .gte('created_at', hace(24 * 60))

  if (colgados?.length) {
    hallazgos.push({
      que: `${colgados.length} pago(s) cobrados sin procesar`,
      detalle: colgados.map((o) => `${o.customer_name} · $${Number(o.amount).toLocaleString('es-CO')}`).join(' | '),
      grave: true,
    })
  }

  /* ── 4. Pedidos que se quedaron quietos ─────────────────────────────
     Nadie extraña un pedido estancado. No falla nada, no sale ningún error:
     simplemente una clienta que ya pagó lleva días esperando y el panel lo
     enseña igual que a los demás. Se nota cuando la clienta escribe a
     preguntar, que es tarde.

     Cada estado tiene su propio plazo porque significan cosas distintas: un
     pedido sin confirmar se enfría en un día, uno en el taller tarda por
     buenas razones, y uno en camino depende de la transportadora. Los
     números son los que la tienda ya promete en la página. */
  const PLAZOS: Array<{ estado: string; horas: number; que: string }> = [
    { estado: 'pendiente',  horas: 24,      que: 'sin confirmar' },
    { estado: 'pagado',     horas: 48,      que: 'pagados y sin empezar' },
    { estado: 'procesando', horas: 24 * 7,  que: 'en el taller' },
    { estado: 'enviado',    horas: 24 * 8,  que: 'en camino sin llegar' },
  ]

  const { data: vivos } = await db
    .from('orders')
    .select('customer_name, amount, status, status_updated_at, created_at')
    .in('status', PLAZOS.map((p) => p.estado))
    .eq('es_prueba', false)

  for (const plazo of PLAZOS) {
    const limite = ahora - plazo.horas * 60 * 60_000
    const quietos = (vivos ?? []).filter((o) => {
      if (o.status !== plazo.estado) return false
      // status_updated_at es null en los pedidos que nunca cambiaron de
      // estado; para esos el reloj corre desde que se crearon.
      const desde = o.status_updated_at ?? o.created_at
      return new Date(desde).getTime() < limite
    })

    if (quietos.length) {
      const dias = Math.round(plazo.horas / 24)
      hallazgos.push({
        que: `${quietos.length} pedido(s) ${plazo.que} hace más de ${dias === 1 ? 'un día' : `${dias} días`}`,
        detalle: quietos
          .map((o) => `${o.customer_name} · $${Number(o.amount).toLocaleString('es-CO')}`)
          .join(' | '),
        // Que un pedido pagado no arranque es peor que uno sin confirmar: la
        // clienta ya puso la plata.
        grave: plazo.estado !== 'pendiente',
      })
    }
  }

  /* ── 5. ¿Responden las funciones y el sitio? ────────────────────────
     Una función caída no deja rastro en la base: hay que preguntarle. */
  const base = Deno.env.get('SUPABASE_URL')!
  const sitio = Deno.env.get('APP_URL') ?? 'https://www.auremgsjoyeria.com'

  const pruebas: Array<[string, string, number[]]> = [
    ['El webhook de Mercado Pago', `${base}/functions/v1/mp-webhook`, [200]],
    ['El sitio', sitio, [200]],
  ]

  for (const [nombre, url, esperados] of pruebas) {
    try {
      const res = await fetch(url, {
        method: url.includes('mp-webhook') ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: url.includes('mp-webhook') ? '{}' : undefined,
        signal: AbortSignal.timeout(12_000),
      })
      if (!esperados.includes(res.status)) {
        hallazgos.push({ que: `${nombre} respondió ${res.status}`, detalle: url, grave: true })
      }
    } catch (e) {
      hallazgos.push({
        que: `${nombre} no respondió`,
        detalle: e instanceof Error ? e.message : String(e),
        grave: true,
      })
    }
  }

  console.log(`vigilancia · ${hallazgos.length} hallazgo(s)`)
  if (!hallazgos.length) return json({ ok: true, hallazgos: 0 })

  /* Se avisa por correo a quien tenga acceso al panel. La clave de
     idempotencia lleva la hora: si el problema sigue mañana vuelve a avisar,
     pero no manda un correo por cada pasada mientras dura. */
  await avisar(db, sitio, hallazgos)
  return json({ ok: true, hallazgos: hallazgos.length, detalle: hallazgos })
})

async function avisar(
  db: ReturnType<typeof admin>,
  sitio: string,
  hallazgos: Hallazgo[],
): Promise<void> {
  try {
    const secreto = Deno.env.get('CORREO_SECRETO')
    if (!secreto) { console.error('vigilancia: falta CORREO_SECRETO'); return }

    const { data: usuarios } = await db.auth.admin.listUsers()
    const destinos = (usuarios?.users ?? []).map((u) => u.email).filter((e): e is string => !!e)
    if (!destinos.length) return

    const hora = new Date().toLocaleString('es-CO', {
      day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota',
    })

    const res = await fetch(`${sitio}/api/correo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correo-secreto': secreto },
      body: JSON.stringify({
        plantilla: 'alerta-sistema',
        para: destinos,
        referencia: `${new Date().toISOString().slice(0, 13)}:${hallazgos.map((h) => h.que).join('|')}`.slice(0, 200),
        datos: { hallazgos, hora },
      }),
    })
    if (!res.ok) console.error(`vigilancia: api/correo respondió ${res.status}`)
  } catch (e) {
    console.error('vigilancia: no se pudo avisar:', e instanceof Error ? e.message : e)
  }
}
