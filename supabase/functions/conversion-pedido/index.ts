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

  /* Qué se está avisando. Sin nada, la venta — que es lo que esta función
     hizo siempre. 'cancelacion' es para cuando un pedido ya contado se cae. */
  const esCancelacion = cuerpo.evento === 'cancelacion'

  const CAMPOS =
    'created_at, amount, customer_email, customer_phone, product_id, product_name, ttclid, ttp, fbc, fbp, client_ua, client_ip, ctwa_clid'

  /* MODO PRUEBA.

     Con un código de prueba, el evento sale en la pestaña de eventos de
     prueba de Meta o TikTok y NO cuenta como conversión. Sirve para
     comprobar que una compra llega bien sin meter una venta falsa en los
     informes.

     Y por eso mismo NO se toca ningún candado: si una prueba consumiera
     `conversion_enviada_en`, la venta de verdad de ese pedido no se avisaría
     nunca — habríamos cambiado un informe sucio por una conversión perdida,
     que es peor y además invisible. */
  const codigoPrueba = String(cuerpo.testEventCode ?? '').trim() || null

  if (codigoPrueba) {
    const { data: ensayo } = await admin
      .from('orders').select(CAMPOS).eq('id', pedidoId).maybeSingle()

    if (!ensayo) return json({ error: 'No existe ese pedido' }, 404)

    await avisarVenta({
      pedidoId,
      monto: Number(ensayo.amount),
      correo: ensayo.customer_email,
      telefono: ensayo.customer_phone,
      piezaId: ensayo.product_id,
      piezaNombre: ensayo.product_name,
      ttclid: ensayo.ttclid,
      ttp: ensayo.ttp,
      fbc: ensayo.fbc,
      fbp: ensayo.fbp,
      ua: ensayo.client_ua,
      ip: ensayo.client_ip,
      ctwaClid: ensayo.ctwa_clid,
      url: 'https://www.auremgsjoyeria.com/',
      momento: Math.floor(Date.now() / 1000),
      testEventCode: codigoPrueba,
      ...(esCancelacion ? { evento: 'cancelacion' as const } : {}),
    })

    return json({ ok: true, prueba: true, candadoIntacto: true })
  }

  /* Y LOS PEDIDOS DE PRUEBA NO SE AVISAN NUNCA.
  
     Esto faltaba, y no era teórico: el 23 de agosto de 2026 había **tres
     compras ya enviadas a Meta y a TikTok desde pedidos `es_prueba`**, por
     $1.550.000 en total, una de ellas de un pedido que después se canceló. Y
     como el píxel no tenía ninguna otra historia, esas tres ventas inventadas
     eran literalmente todo lo que Meta sabía del negocio — justo lo que iba a
     usar para arrancar a optimizar el día que se prendiera pauta.

     El resto del sistema ya se defendía: `plantillas-programadas` excluye las
     pruebas desde el 22 de agosto. Las conversiones se habían quedado atrás.

     Se comprueba ANTES de tocar el candado, a diferencia del resto de las
     salidas: así `conversion_enviada_en` sigue significando «esto se le contó
     a una plataforma» y no «esto se intentó». Si un pedido dejara de ser de
     prueba, su venta todavía podría avisarse.

     Para probar de verdad está el modo de arriba, con `testEventCode`: el
     evento sale en la pestaña de eventos de prueba de Meta y no cuenta como
     conversión. */
  const { data: cual } = await admin
    .from('orders').select('es_prueba').eq('id', pedidoId).maybeSingle()

  if (!cual) return json({ error: 'No existe ese pedido' }, 404)

  if (cual.es_prueba) {
    console.log('Pedido de prueba: no se le cuenta a Meta ni a TikTok:', pedidoId)
    return json({ ok: true, esPrueba: true, avisado: false, candadoIntacto: true })
  }

  /* El mismo candado que usa el webhook de Mercado Pago, y a propósito la
     misma columna: así un pedido no puede contarse dos veces aunque llegue
     por los dos caminos, ni aunque le des dos clics al botón. Marcar y leer
     en el mismo UPDATE es lo que lo hace seguro.

     La cancelación tiene su propio candado, y además una condición: sólo se
     avisa si la VENTA se avisó antes. Contarle a Meta que se cayó un pedido
     del que nunca supo no informa de nada y le mete ruido al modelo. */
  const marca = new Date().toISOString()

  const { data: orden, error } = esCancelacion
    ? await admin.from('orders')
        .update({ cancelacion_enviada_en: marca })
        .eq('id', pedidoId)
        .is('cancelacion_enviada_en', null)
        .not('conversion_enviada_en', 'is', null)
        .select(CAMPOS)
        .maybeSingle()
    : await admin.from('orders')
        .update({ conversion_enviada_en: marca })
        .eq('id', pedidoId)
        .is('conversion_enviada_en', null)
        .select(CAMPOS)
        .maybeSingle()

  if (error) {
    console.error('No se pudo marcar el pedido:', pedidoId, error.message)
    return json({ error: 'No se pudo registrar la conversión' }, 500)
  }
  if (!orden) {
    /* Ya se había avisado y el candado hizo su trabajo — o, si es una
       cancelación, el pedido nunca se contó como venta y no hay nada que
       cancelar. Las dos son salidas normales, no errores. */
    return json({ ok: true, repetido: true })
  }

  /* El momento.

     Para la VENTA es el de la compra, no el de hoy: en contraentrega la
     confirmación llega días después de que la persona vio el anuncio y pidió,
     y fechar el evento hoy le diría a la plataforma que el anuncio de hace una
     semana no tuvo nada que ver.

     Para la CANCELACIÓN es ahora, y es lo correcto: el hecho que se está
     contando —que el pedido se cayó— acaba de ocurrir. */
  const ahora = Math.floor(Date.now() / 1000)
  const pedido = Math.floor(new Date(orden.created_at).getTime() / 1000)
  const momento = esCancelacion ? ahora : Math.max(pedido, ahora - MAX_ATRAS_S)

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
    ctwaClid: orden.ctwa_clid,
    url: 'https://www.auremgsjoyeria.com/',
    momento,
    ...(esCancelacion ? { evento: 'cancelacion' as const } : {}),
  })

  return json({ ok: true })
})
