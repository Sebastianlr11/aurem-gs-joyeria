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

  /* Español, no "cliente(s)". Este bloque se lee con prisa y en el celular:
     el paréntesis obliga a resolver la concordancia mentalmente justo cuando
     lo que hace falta es entender qué pasó. */
  const plural = (n: number, uno: string, varios: string) =>
    n === 1 ? `1 ${uno}` : `${n} ${varios}`

  /* 573167414801 no se lee. 316 741 4801 sí, y además es como está guardado
     en el celular de quien va a llamar. */
  const telLegible = (t: string) =>
    (t || '').replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')

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
      que: fallidos.length === 1
        ? 'Un mensaje de WhatsApp no se entregó'
        : `${fallidos.length} mensajes de WhatsApp no se entregaron`,
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
      que: esperando.length === 1
        ? 'Una clienta escribió y nadie respondió'
        : `${esperando.length} clientas escribieron y nadie respondió`,
      detalle: esperando.slice(0, 5).map(telLegible).join(' · '),
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
      que: colgados.length === 1
        ? 'Un pago cobrado y sin procesar'
        : `${colgados.length} pagos cobrados y sin procesar`,
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
  /* Cada plazo mira el flujo y no sólo el estado, porque 'pagado' significa
     lo contrario en cada uno: en pago anticipado es un pedido cobrado que
     todavía no arranca —justo lo que hay que perseguir— y en contraentrega es
     la plata ya recogida, el final del camino. Sin esta distinción cada venta
     contraentrega terminada se convertía en una alarma grave que no se apagaba
     nunca, y contraentrega es como se vende casi todo. */
  type Pedido = { status: string; payment_method: string | null }
  const esCOD = (o: Pedido) => o.payment_method === 'contraentrega'

  /* 'entregado' no está: es el final del camino en los dos flujos. En prepago
     la plata entró al principio, y en contraentrega el mensajero entrega y trae
     el efectivo el mismo día, así que marcar entregado ya declara el cobro. Un
     pedido entregado no espera nada de nadie. */
  const ESTADOS_VIGILADOS = ['pendiente', 'pagado', 'procesando', 'enviado']

  const PLAZOS: Array<{ id: string; horas: number; que: string; aplica: (o: Pedido) => boolean }> = [
    { id: 'pendiente',  horas: 24,      que: 'sin confirmar',
      aplica: (o) => o.status === 'pendiente' },
    { id: 'pagado',     horas: 48,      que: 'pagados y sin empezar',
      aplica: (o) => o.status === 'pagado' && !esCOD(o) },
    { id: 'procesando', horas: 24 * 7,  que: 'en el taller',
      aplica: (o) => o.status === 'procesando' },
    { id: 'enviado',    horas: 24 * 8,  que: 'en camino sin llegar',
      aplica: (o) => o.status === 'enviado' },
  ]

  const { data: vivos } = await db
    .from('orders')
    .select('customer_name, amount, status, payment_method, status_updated_at, created_at')
    .in('status', ESTADOS_VIGILADOS)
    .eq('es_prueba', false)

  for (const plazo of PLAZOS) {
    const limite = ahora - plazo.horas * 60 * 60_000
    const quietos = (vivos ?? []).filter((o) => {
      if (!plazo.aplica(o)) return false
      // status_updated_at es null en los pedidos que nunca cambiaron de
      // estado; para esos el reloj corre desde que se crearon.
      const desde = o.status_updated_at ?? o.created_at
      return new Date(desde).getTime() < limite
    })

    if (quietos.length) {
      const dias = Math.round(plazo.horas / 24)
      hallazgos.push({
        que: `${plural(quietos.length, 'pedido', 'pedidos')} ${plazo.que} hace más de ${dias === 1 ? 'un día' : `${dias} días`}`,
        detalle: quietos
          .map((o) => `${o.customer_name} · $${Number(o.amount).toLocaleString('es-CO')}`)
          .join(' | '),
        // Que un pedido pagado no arranque es peor que uno sin confirmar: la
        // clienta ya puso la plata.
        grave: plazo.id !== 'pendiente',
      })
    }
  }

  /* ── 5. Pauta corriendo a ciegas sobre el margen ────────────────────
     Un pedido despachado del que no se anotó qué costó no hace daño mientras
     no haya plata en juego. El día que entra el primer peso de pauta cambia
     de naturaleza: sin ese número el panel puede decir cuánto se vendió pero
     no cuánto quedó, y se decide mal cuánto gastar — siempre hacia arriba,
     que es el lado caro.

     El aviso vive acá y no sólo en el panel porque el panel hay que abrirlo,
     y esto es justo lo que se olvida. */
  const { data: gastoReciente } = await db
    .from('gasto_pauta')
    .select('fecha')
    .gte('fecha', new Date(ahora - 7 * 24 * 60 * 60_000).toISOString().slice(0, 10))
    .limit(1)

  if (gastoReciente?.length) {
    /* Antes esto miraba `products.costo_provisional`: un costo de relleno en
       el catálogo. Desde el 23 de agosto de 2026 el costo no vive en el
       catálogo sino en el pedido —se anota al despachar, con el oro del día—,
       así que la pregunta cambió: ya no es "¿hay costos inventados?" sino
       "¿hay pedidos despachados de los que no sabemos qué costaron?".

       Sólo cuentan los despachados: pedirle el costo a un pedido que el
       taller todavía no ha entregado sería pedir algo que nadie sabe. */
    const { data: sinCosto } = await db
      .from('orders')
      .select('id')
      .in('status', ['enviado', 'entregado'])
      .is('costo_taller', null)
      .eq('es_prueba', false)
      .gte('created_at', new Date(ahora - 60 * 24 * 60 * 60_000).toISOString())

    if (sinCosto?.length) {
      hallazgos.push({
        que: `Hay pauta corriendo y ${plural(sinCosto.length, 'pedido', 'pedidos')} sin costo anotado`,
        detalle: `${sinCosto.length} ${sinCosto.length === 1 ? 'pedido despachado no dice' : 'pedidos despachados no dicen'} qué costaron, así que la utilidad que enseña el panel sale corta y el retorno de la pauta no se puede leer. Se anota al editar el pedido, en «Lo que costó».`,
        grave: true,
      })
    }
  }

  /* ── 6. ¿Responden las funciones y el sitio? ────────────────────────
     Una función caída no deja rastro en la base: hay que preguntarle. */
  const base = Deno.env.get('SUPABASE_URL')!
  const sitio = Deno.env.get('APP_URL') ?? 'https://www.auremgsjoyeria.com'

  /* El webhook espera 401 y NO 200, que es lo que decía antes.
     Desde que `MP_WEBHOOK_SECRET` está puesto (23 de agosto de 2026), esta
     sonda —un POST vacío y sin firmar— es exactamente lo que la función debe
     rechazar. Con [200] el vigía llevaba días gritando "el webhook respondió
     401" por un webhook que funcionaba perfectamente, y una alarma que siempre
     suena es una alarma que nadie lee: justo lo que este archivo dice evitar.

     Y esperar 401 vale doble: si alguien borra el secreto, la función vuelve a
     fallar ABIERTA —acepta cualquier cosa y devuelve 200— y entonces esta
     prueba se enciende. Es la única cosa del sistema que avisaría de eso. */
  const pruebas: Array<[string, string, number[]]> = [
    ['El webhook de Mercado Pago', `${base}/functions/v1/mp-webhook`, [401]],
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

  /* ── 7. El candado del panel ────────────────────────────────────────
     La premisa de seguridad del panel —que tener sesión es ser del equipo—
     estuvo rota seis meses y no lo dijo nadie: las políticas decían
     `using (true)` y el registro público estaba abierto, así que cualquiera
     con un correo podía leer y borrar los pedidos. Se arregló el 23 de agosto
     de 2026, pero arreglarlo no basta. Esto es para que la próxima vez lo diga
     alguien sin que haya que preguntar.

     Son dos preguntas distintas y hacen falta las dos: una mira la base y la
     otra mira la configuración de Supabase, que no deja rastro en la base y se
     cambia con un clic desde el navegador. */

  /* La regla del dinero vive en dos idiomas: `recibidoDe` en el panel y
     `recibido_de` en la base, que es la que alimenta el libro de caja. Son dos
     copias por obligación —el panel calcula sobre filas que ya tiene y el
     disparador corre dentro de Postgres—, así que se comprueba que la de la
     base siga diciendo lo que dice la tabla de CLAUDE.md §8.

     No es paranoia: el mismo día que se escribió esto, una tabla de tallas
     duplicada resultó discrepar en el 29 % de los casos sin que nadie lo
     supiera. Aquello eran anillos; esto es la caja. */
  const { data: descuadre, error: errDinero } = await db.rpc('regla_del_dinero_cuadra')
  if (errDinero) {
    hallazgos.push({
      que: 'No se pudo revisar la regla del dinero',
      detalle: errDinero.message,
      grave: true,
    })
  } else if (descuadre?.length) {
    for (const d of descuadre as Array<{ regla: string; caso: string; dice: string; deberia_decir: string }>) {
      hallazgos.push({
        que: `La regla «${d.regla}» de la base dejó de cuadrar en: ${d.caso}`,
        detalle: `dice ${d.dice} y debería decir ${d.deberia_decir}`,
        grave: true,
      })
    }
  }

  /* Y un piso más abajo: que el LIBRO le haga caso a la regla.

     `pagos` lo llena el disparador `registrar_pago`, y de esa tabla salen las
     cifras de la portada y del retorno de la pauta. La tabla y la regla son
     dos formas de responder «cuánto entró por este pedido», y como toda
     pareja de este proyecto pueden separarse sin que nadie lo note: el número
     seguiría saliendo redondo y creíble.

     La de arriba comprueba que la regla diga lo que debe; ésta, que el libro
     le haga caso. */
  const { data: caja, error: errCaja } = await db.rpc('caja_cuadra_con_la_regla')
  if (errCaja) {
    hallazgos.push({
      que: 'No se pudo cuadrar el libro de caja',
      detalle: errCaja.message,
      grave: true,
    })
  } else if (caja?.length) {
    for (const c of caja as Array<{ pedido: string; estado: string; forma_de_pago: string; dice_el_libro: number; dice_la_regla: number }>) {
      hallazgos.push({
        que: `El libro de caja no cuadra en un pedido ${c.estado} por ${c.forma_de_pago}`,
        detalle: `el libro dice $${c.dice_el_libro} y la regla dice $${c.dice_la_regla} · pedido ${c.pedido}`,
        grave: true,
      })
    }
  }

  const { data: flojas, error: errFlojas } = await db.rpc('politicas_flojas')
  if (errFlojas) {
    hallazgos.push({
      que: 'No se pudo revisar el candado del panel',
      detalle: errFlojas.message,
      grave: true,
    })
  } else if (flojas?.length) {
    for (const f of flojas as Array<{ donde: string; politica: string; motivo: string }>) {
      hallazgos.push({
        que: `${f.donde} quedó sin candado`,
        detalle: `${f.motivo}${f.politica === '—' ? '' : ` · política «${f.politica}»`}`,
        grave: true,
      })
    }
  }

  /* La configuración de Auth. Esto habría cazado los DOS problemas del 23 de
     agosto: el registro abierto, que era el agujero, y el susto de después
     —apagar «Enable email provider» creyendo cerrar el registro, que apaga
     también la ENTRADA—. Lo segundo es especialmente traicionero porque no se
     nota: la sesión abierta se sigue renovando sola con el token de refresco,
     y el fallo aparece días más tarde, cuando alguien cierre sesión o entre
     desde otro aparato.

     El endpoint es público y no necesita secreto: es el mismo que consulta el
     navegador para saber qué botones de entrada pintar. */
  try {
    const conf = await fetch(`${base}/auth/v1/settings`, {
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!conf.ok) throw new Error(`respondió ${conf.status}`)
    const auth = await conf.json()

    if (auth.disable_signup === false) {
      hallazgos.push({
        que: 'El registro público está abierto',
        detalle: 'Cualquiera con un correo puede crearse una cuenta. Authentication → Sign In / Providers → «Allow new users to sign up».',
        grave: true,
      })
    }
    if (auth.external?.email === false) {
      hallazgos.push({
        que: 'Nadie puede entrar al panel',
        detalle: 'El proveedor de correo está apagado, así que la entrada con correo y contraseña no funciona. No se nota hasta que alguien cierre sesión. Authentication → Sign In / Providers → Email → «Enable email provider».',
        grave: true,
      })
    }
  } catch (e) {
    hallazgos.push({
      que: 'No se pudo revisar la configuración de acceso',
      detalle: e instanceof Error ? e.message : String(e),
      grave: false,
    })
  }

  console.log(`vigilancia · ${plural(hallazgos.length, 'hallazgo', 'hallazgos')}`)

  /* Se deja escrito SIEMPRE, encuentre o no encuentre. Escribir sólo cuando
     hay problemas dejaría el panel enseñando la avería de anteayer como si
     fuera de ahora, que es peor que no enseñar nada: el aviso viejo hace
     desconfiar de todos los demás. Cero hallazgos es una respuesta, y además
     es la que dice que la revisión corrió. */
  await db.from('vigilancia_ultima')
    .update({ corrida_en: new Date().toISOString(), hallazgos })
    .eq('id', 1)

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
