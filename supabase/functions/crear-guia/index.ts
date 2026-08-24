/**
 * Pedirle la guía a 99envios.
 *
 * Fase 2, del 24 de agosto de 2026. A diferencia de `cotizar-envio`, que sólo
 * pregunta, **esto crea algo en el mundo real**: una guía de transporte que se
 * factura y que un mensajero va a ir a recoger. Todo lo de aquí abajo está
 * escrito con esa diferencia en mente.
 *
 * ── Lo que se niega a hacer ─────────────────────────────────────────────────
 *
 *   · **Pedidos de prueba, nunca.** Es el mismo cuidado que las plantillas de
 *     WhatsApp y las conversiones: probar el panel no puede costar un flete.
 *   · **Un pedido que ya tiene guía, tampoco.** Dos guías para el mismo
 *     paquete son dos fletes y un mensajero que llega dos veces.
 *   · **Sin apellido no se emite.** El rótulo lo lee una persona; un apellido
 *     inventado es un paquete que no se entrega.
 *   · **Sin ciudad traducible, tampoco.** Ya lo decía `cotizar-envio`.
 *
 * ── Y lo que hace nada más tener respuesta ──────────────────────────────────
 *
 * Guarda transportadora, número de guía y flete **antes de devolver nada**. La
 * guía ya existe y se va a cobrar; si el panel no la anotara porque alguien
 * cerró el diálogo, quedaría pagada y perdida.
 *
 * Lo que NO hace es despachar: no toca el estado, no manda el correo ni el
 * WhatsApp. Eso sigue siendo «Marcar como enviado», que es un solo camino y ya
 * está probado. Aquí sólo se consigue el número.
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

const BASE = Deno.env.get('ENVIOS99_URL') ?? 'https://integration1.99envios.app'

/* Qué se escribe en el rótulo. NO dice «joya» ni «oro» a propósito: ese papel
   lo leen varias manos entre la bodega y la puerta, y anunciar lo que va
   dentro es la forma más barata de que el paquete no llegue. */
const DICE_CONTENER = Deno.env.get('ENVIOS99_DICE_CONTENER') ?? 'Accesorio'

let token: string | null = null
let tokenHasta = 0
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
  if (!res.ok) throw new Error(`99envios rechazó el login (HTTP ${res.status})`)

  const t = cuerpo?.token ?? cuerpo?.access_token ?? cuerpo?.data?.token ?? cuerpo?.jwt
  if (!t) throw new Error('El login de 99envios no devolvió token')
  token = String(t)
  tokenHasta = Date.now() + DURA_MS
  return token
}

/** Los dos últimos trozos son los apellidos. Espejo de `src/lib/nombre.js`. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'lo', 'los', 'y', 'da', 'do', 'san', 'santa'])

function partirNombre(completo: string | null) {
  const trozos = String(completo ?? '').trim().split(/\s+/).filter(Boolean)
  if (trozos.length < 2) return null

  const piezas: string[] = []
  let arrastre: string[] = []
  for (const t of trozos) {
    if (PARTICULAS.has(t.toLowerCase())) { arrastre.push(t); continue }
    piezas.push([...arrastre, t].join(' '))
    arrastre = []
  }
  if (arrastre.length && piezas.length) piezas[piezas.length - 1] += ' ' + arrastre.join(' ')
  if (piezas.length < 2) return null

  if (piezas.length === 2) return { nombre: piezas[0], primerApellido: piezas[1], segundoApellido: null }
  if (piezas.length === 3) return { nombre: piezas[0], primerApellido: piezas[1], segundoApellido: piezas[2] }
  return {
    nombre: piezas.slice(0, -2).join(' '),
    primerApellido: piezas[piezas.length - 2],
    segundoApellido: piezas[piezas.length - 1],
  }
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

  let cuerpo: { pedidoId?: string; transportadora?: string }
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo ilegible' }, 400) }

  const pedidoId = String(cuerpo.pedidoId ?? '').trim()
  const transportadora = String(cuerpo.transportadora ?? '').trim().toLowerCase()
  if (!pedidoId) return json({ error: 'Falta el pedido' }, 400)

  const PERMITIDAS = ['interrapidisimo', 'coordinadora', 'servientrega', 'tcc', 'envia']
  if (!PERMITIDAS.includes(transportadora)) {
    return json({ error: 'transportadora_invalida', detalle: `Elige una de: ${PERMITIDAS.join(', ')}` }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: pedido } = await admin
    .from('orders')
    .select('id, amount, customer_name, customer_phone, customer_email, shipping_address, shipping_city, shipping_department, product_id, tracking_number, carrier, es_prueba')
    .eq('id', pedidoId)
    .maybeSingle()

  if (!pedido) return json({ error: 'No existe ese pedido' }, 404)

  /* Los cuatro noes, antes de gastar un peso. */
  if (pedido.es_prueba) {
    return json({ error: 'es_prueba', detalle: 'Es un pedido de prueba. Probar el panel no puede costar un flete.' }, 422)
  }
  if (pedido.tracking_number) {
    return json({ error: 'ya_tiene_guia', detalle: `Este pedido ya tiene la guía ${pedido.tracking_number}. Dos guías son dos fletes.` }, 409)
  }
  const quien = partirNombre(pedido.customer_name)
  if (!quien) {
    return json({ error: 'sin_apellido', detalle: `«${pedido.customer_name ?? ''}» no trae apellido, y el rótulo lo necesita. Complétalo en el pedido.` }, 422)
  }
  if (!pedido.shipping_address || !pedido.customer_phone) {
    return json({ error: 'faltan_datos', detalle: 'El pedido no tiene dirección o teléfono.' }, 422)
  }

  const { data: codigo } = await admin.rpc('codigo_dane', {
    p_ciudad: pedido.shipping_city,
    p_departamento: pedido.shipping_department,
  })
  if (!codigo) {
    return json({ error: 'ciudad_no_reconocida', detalle: `No se pudo traducir «${pedido.shipping_city ?? ''}» a un municipio.` }, 422)
  }

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

  try {
    let res: Response | null = null
    let datos: any = {}

    for (const reintento of [false, true]) {
      const t = await entrar(reintento)
      res = await fetch(`${BASE}/api/integration/v1/preenvio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          IdTipoEntrega: 1,          // domicilio, es el único que acepta
          IdServicio: 1,             // estándar, ídem
          /* Apagado: que la transportadora cobre por nosotros cambiaría cómo
             entra el dinero, y esa decisión no está tomada. */
          AplicaContrapago: false,
          peso: caja.peso,
          largo: caja.largo,
          ancho: caja.ancho,
          alto: caja.alto,
          diceContener: DICE_CONTENER,
          valorDeclarado: Number(pedido.amount) || 0,
          seguro99: false,
          seguro99plus: false,
          Destinatario: {
            tipoDocumento: 'CC',
            nombre: quien.nombre,
            primerApellido: quien.primerApellido,
            ...(quien.segundoApellido ? { segundoApellido: quien.segundoApellido } : {}),
            telefono: String(pedido.customer_phone).replace(/\D/g, '').slice(-10),
            direccion: String(pedido.shipping_address),
            idLocalidad: String(codigo),
            ...(pedido.customer_email ? { correo: pedido.customer_email } : {}),
          },
          transportadora: { pais: 'colombia', nombre: transportadora },
          origenCreacion: 1,
        }),
      })
      datos = await res.json().catch(() => ({}))
      if (res.status === 401 && !reintento) { token = null; continue }
      break
    }

    if (!res || !res.ok) {
      console.error('99envios no emitió la guía:', res?.status, JSON.stringify(datos).slice(0, 300))
      return json({ error: 'no_emitio', detalle: datos?.error || `99envios respondió ${res?.status}`, respuesta: datos }, 502)
    }

    const guia = String(datos?.numeroPreenvio ?? '').trim()
    if (!guia) {
      console.error('99envios respondió sin número de guía:', JSON.stringify(datos).slice(0, 300))
      return json({ error: 'sin_numero', detalle: 'La respuesta no traía número de guía.', respuesta: datos }, 502)
    }

    /* Se anota YA. La guía existe y se va a cobrar; perderla porque alguien
       cerró el diálogo sería pagar un flete por nada. `costo_envio` es lo que
       alimenta el margen de cada pieza, que hasta hoy se escribía a mano y por
       eso estaba vacío. */
    const flete = Number(datos?.valorFlete)
    const { error: errorGuardar } = await admin.from('orders').update({
      carrier: transportadora,
      tracking_number: guia,
      ...(Number.isFinite(flete) && flete > 0 ? { costo_envio: flete, costo_anotado_en: new Date().toISOString() } : {}),
    }).eq('id', pedidoId)

    if (errorGuardar) {
      /* La guía existe aunque no se haya podido anotar: se dice el número para
         que se copie a mano antes que perderlo. */
      console.error('Guía emitida pero no anotada:', guia, errorGuardar.message)
      return json({ ok: true, guia, flete, aviso: `La guía ${guia} se emitió pero no se pudo guardar en el pedido. Anótala a mano.` })
    }

    return json({ ok: true, guia, flete: Number.isFinite(flete) ? flete : null, transportadora })
  } catch (e) {
    console.error('Emitiendo la guía:', e instanceof Error ? e.message : e)
    return json({ error: 'no_se_pudo', detalle: e instanceof Error ? e.message : 'Error desconocido' }, 502)
  }
})
