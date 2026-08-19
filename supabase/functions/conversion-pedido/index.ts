/**
 * La venta que no pasa por Mercado Pago.
 *
 * El contraentrega no toca la pasarela: el cliente paga en la puerta y quien
 * lo confirma sos vos, desde el panel. Sin esto esas ventas existen pero
 * ninguna plataforma las ve, y TikTok termina optimizando con la mitad de la
 * información —justo la mitad que en Colombia suele ser la más grande.
 *
 * Va por una edge function y no desde el navegador porque los tokens de las
 * APIs de conversiones no pueden salir al cliente. El panel sólo dice qué
 * pedido se cobró; el resto ocurre acá.
 *
 * Requiere sesión de admin. Si no, cualquiera podría inventar ventas.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { avisarVenta } from '../_shared/conversiones.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/* Meta rechaza los eventos de más de siete días, y TikTok tiene un límite
   parecido. Un contraentrega puede tardar más en entregarse, así que el
   momento se recorta a ese borde en vez de perder la venta entera. */
const MAX_ATRAS_S = 7 * 24 * 60 * 60

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

  /* El mismo candado que usa el webhook de Mercado Pago, y a propósito la
     misma columna: así un pedido no puede contarse dos veces aunque llegue
     por los dos caminos, ni aunque le des dos clics al botón. Marcar y leer
     en el mismo UPDATE es lo que lo hace seguro. */
  const { data: orden, error } = await admin
    .from('orders')
    .update({ conversion_enviada_en: new Date().toISOString() })
    .eq('id', pedidoId)
    .is('conversion_enviada_en', null)
    .select('created_at, amount, customer_email, customer_phone, product_id, product_name, ttclid, ttp, fbc, fbp, client_ua, client_ip')
    .maybeSingle()

  if (error) {
    console.error('No se pudo marcar el pedido:', pedidoId, error.message)
    return json({ error: 'No se pudo registrar la conversión' }, 500)
  }
  if (!orden) {
    // Ya se había avisado. No es un error: el candado hizo su trabajo.
    return json({ ok: true, repetido: true })
  }

  /* El momento es el de la COMPRA, no el de hoy. En contraentrega la
     confirmación llega días después de que la persona vio el anuncio y pidió;
     fechar el evento hoy le diría a la plataforma que el anuncio de hace una
     semana no tuvo nada que ver. */
  const ahora = Math.floor(Date.now() / 1000)
  const pedido = Math.floor(new Date(orden.created_at).getTime() / 1000)
  const momento = Math.max(pedido, ahora - MAX_ATRAS_S)

  await avisarVenta({
    pedidoId,
    monto: Number(orden.amount),
    correo: orden.customer_email,
    telefono: orden.customer_phone,
    piezaId: orden.product_id,
    piezaNombre: orden.product_name,
    ttclid: orden.ttclid,
    ttp: orden.ttp,
    fbc: orden.fbc,
    fbp: orden.fbp,
    ua: orden.client_ua,
    ip: orden.client_ip,
    url: 'https://www.auremgsjoyeria.com/',
    momento,
  })

  return json({ ok: true })
})
