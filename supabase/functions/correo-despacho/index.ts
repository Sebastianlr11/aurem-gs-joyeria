/**
 * El correo de "tu pieza va en camino", disparado desde el panel del taller.
 *
 * Va por una función de borde y no desde el navegador por la misma razón que
 * las conversiones: el secreto que autoriza a mandar correos con la marca de
 * la joyería no puede salir al cliente. Si saliera, cualquiera podría
 * escribirle a quien quisiera firmando como Aurem Gs, que es peor que una
 * fuga de datos: es suplantación.
 *
 * El panel sólo dice qué pedido se despachó. Todo lo demás —la guía, el
 * saldo, la foto de la pieza— sale de la base acá adentro, para que el correo
 * no dependa de lo que el navegador tenga cargado en ese momento.
 *
 * Requiere sesión de admin.
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

/* Páginas de rastreo, las tres comprobadas una por una contra el sitio real.

   La primera versión las puse de memoria y dos de las tres daban 404. No es
   un detalle: es el botón que pulsa una clienta que ya pagó y está esperando
   su pieza, y caer en un "esta dirección no existe" es exactamente el
   momento en que se pregunta si la tienda es real.

   Ninguna lleva a la guía concreta. Los enlaces directos de estas tres
   cambian de forma cada tanto, y prefiero una página viva donde se pega el
   número —que el correo enseña justo encima— a un enlace exacto que se rompa
   en seis meses sin que nos enteremos.

   Inter Rapidísimo va a su portada a propósito: el buscador de guías está
   ahí mismo, no en una página aparte. Por eso ninguna de sus rutas existía.

   Si la transportadora es "Otro" o está vacía no hay página, y la plantilla
   se encarga: sin URL, el botón de rastrear no se pinta. */
const RASTREO: Record<string, string> = {
  servientrega: 'https://www.servientrega.com/wps/portal/rastreo-envio',
  interrapidisimo: 'https://www.interrapidisimo.com/',
  coordinadora: 'https://coordinadora.com/rastreo/',
}

const sinTildes = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

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

  const secreto = Deno.env.get('CORREO_SECRETO')
  if (!secreto) {
    console.error('correo-despacho: falta CORREO_SECRETO')
    return json({ error: 'Sin configurar' }, 500)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: orden, error } = await admin
    .from('orders')
    .select('customer_email, customer_name, product_id, product_name, amount, abono_monto, payment_method, shipping_city, carrier, tracking_number')
    .eq('id', pedidoId)
    .maybeSingle()

  if (error) {
    console.error('correo-despacho: no se pudo leer el pedido', pedidoId, error.message)
    return json({ error: 'No se pudo leer el pedido' }, 500)
  }
  if (!orden) return json({ error: 'Pedido no encontrado' }, 404)

  /* Las dos razones legítimas para no mandar nada. No son errores: el panel
     las muestra tal cual para que sepas por qué no salió, en vez de dejarte
     creyendo que sí. */
  if (!orden.customer_email) {
    return json({ ok: true, enviado: false, motivo: 'El pedido no tiene correo' })
  }
  if (!orden.tracking_number) {
    return json({ ok: true, enviado: false, motivo: 'El pedido no tiene número de guía' })
  }

  /* La foto y la ficha, igual que en la confirmación: una tarjeta con el
     nombre a secas se lee como una factura. Si falla, sale el rombo. */
  let pieza: Record<string, unknown> | null = null
  try {
    const { data } = await admin
      .from('products').select('images, image_url, metal, piedra')
      .eq('id', orden.product_id).maybeSingle()
    pieza = data
  } catch { /* sin foto, el correo sale igual */ }

  const imagenes = pieza?.images
  const imagen = (Array.isArray(imagenes) && imagenes[0]) || pieza?.image_url || null
  const ficha = [pieza?.metal, pieza?.piedra].filter(Boolean).join(' · ') || null

  /* Cuánto falta por pagar en la puerta.

     En contraentrega el pedido se despacha ANTES de cobrarse: lo que se pagó
     en línea fue apenas el abono del envío, y el resto llega en efectivo. Ese
     número es lo más importante del correo, porque es el que la clienta tiene
     que tener listo cuando toquen el timbre.

     Se mira el método de pago y no sólo el abono: un pedido que tomó
     Valentina por WhatsApp puede ser contraentrega sin abono ninguno, y ahí
     se debe todo. Si no es contraentrega, ya está pagado y no va el bloque. */
  const esContraentrega = orden.payment_method === 'contraentrega' || orden.abono_monto != null
  const bruto = Number(orden.amount ?? 0) - Number(orden.abono_monto ?? 0)
  const saldo = esContraentrega && bruto > 0 ? bruto : null

  const transportadora = String(orden.carrier ?? '').trim()
  const urlRastreo = RASTREO[sinTildes(transportadora)] ?? null

  const referencia = `AG-${String(orden.product_id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`

  const fecha = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  })

  const base = Deno.env.get('APP_URL') ?? 'https://www.auremgsjoyeria.com'

  const res = await fetch(`${base}/api/correo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-correo-secreto': secreto },
    body: JSON.stringify({
      plantilla: 'pedido-despachado',
      para: orden.customer_email,
      /* El pedido MÁS la guía. Con el pedido solo, dos clics seguidos mandan
         un correo (bien), pero corregir una guía mal tecleada dentro de las
         24 horas siguientes chocaría contra la misma clave y Resend lo
         rechazaría. Con la guía dentro, el clic repetido se ignora y la
         corrección sí sale. */
      referencia: `${pedidoId}:${orden.tracking_number}`,
      datos: {
        nombre: orden.customer_name,
        pieza: orden.product_name,
        referencia,
        guia: orden.tracking_number,
        transportadora: transportadora || 'la transportadora',
        urlRastreo,
        ciudad: orden.shipping_city ?? 'Colombia',
        saldo,
        imagen,
        ficha,
        fecha,
      },
    }),
  })

  if (!res.ok) {
    const detalle = (await res.text()).slice(0, 160)
    console.error(`correo-despacho: api/correo respondió ${res.status}: ${detalle}`)
    return json({ error: 'No se pudo enviar el correo' }, 502)
  }

  console.log('Correo de despacho enviado:', pedidoId)
  return json({ ok: true, enviado: true })
})
