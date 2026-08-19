import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { enviarTexto, numeroPropioDe } from '../_shared/wa.ts'
import { avisarVenta } from '../_shared/conversiones.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    // MercadoPago envía el payment ID como query param
    const paymentId = url.searchParams.get('data.id') || url.searchParams.get('id')
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')

    // Solo procesamos notificaciones de pagos
    if (!paymentId || (topic && topic !== 'payment' && topic !== 'merchant_order')) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!

    // Consultar el pago en la API de MercadoPago para verificar su estado
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    })

    if (!mpRes.ok) {
      console.error('Error consultando pago MP:', paymentId, mpRes.status)
      return new Response(JSON.stringify({ error: 'Error consultando pago' }), {
        status: 200, // Siempre 200 para que MP no reintente
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const payment = await mpRes.json()
    console.log('MP Payment:', payment.id, 'status:', payment.status, 'external_ref:', payment.external_reference)

    // Solo actualizamos si el pago está aprobado
    if (payment.status !== 'approved') {
      return new Response(JSON.stringify({ ok: true, status: payment.status }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Actualizar la orden en Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const orderId = payment.external_reference

    if (!orderId) {
      console.error('No external_reference en el pago:', paymentId)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: orden, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'pagado',
        mp_payment_id: String(payment.id),
        mp_status: payment.status,
        /* El candado contra reintentos: Mercado Pago reenvía el webhook varias
           veces por el mismo pago, y sin esto la venta se le contaría repetida
           a TikTok y a Meta, y el cliente recibiría el aviso otras tantas.
           Se marca acá y no después de enviar, en el mismo update que filtra
           por null: así dos webhooks que lleguen a la vez no pueden pasar los
           dos, porque Postgres serializa la escritura sobre la fila. */
        conversion_enviada_en: new Date().toISOString(),
      })
      .eq('id', orderId)
      .is('conversion_enviada_en', null)
      .select('customer_phone, customer_email, customer_name, product_id, product_name, amount, ttclid, ttp, fbc, fbp, client_ua, client_ip')
      .maybeSingle()

    if (updateError) {
      console.error('Error actualizando orden:', orderId, updateError)
    } else if (!orden) {
      /* Ya se procesó en un intento anterior. No es un error: es el candado
         haciendo su trabajo. */
      console.log('Pago ya procesado antes, no se repite:', orderId)
      return new Response(JSON.stringify({ ok: true, repetido: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.log('Orden actualizada a pagado:', orderId)
    }

    /* La venta a TikTok y a Meta. Va antes del aviso por WhatsApp porque no
       depende de él y porque es lo que tiene ventana de tiempo: cuanto más
       cerca del pago llegue, mejor atribuye. Nunca lanza. */
    if (orden) {
      await avisarVenta({
        pedidoId: orderId,
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
        url: 'https://www.auremgsjoyeria.com/confirmacion',
      })
    }

    /* Si el pedido entró por WhatsApp, se avisa por ahí mismo. Sin esto el
       cliente paga y se queda sin señal de que llegó: la pantalla de Mercado
       Pago se cierra y el chat, que es donde estuvo toda la conversación,
       queda mudo. */
    if (orden?.customer_phone) {
      try {
        const monto = `$${Math.round(Number(orden.amount)).toLocaleString('es-CO')}`
        const desdeId = await numeroPropioDe(orden.customer_phone)
        await enviarTexto(
          orden.customer_phone,
          `¡Listo! Recibimos tu pago de ${monto} por ${orden.product_name}. ` +
          `Ya lo estamos preparando y te aviso apenas se despache. 🌿`,
          'ia',
          desdeId,
        )
      } catch (e) {
        // El pago ya quedó registrado: que falle el aviso no lo invalida.
        console.error('No se pudo avisar el pago por WhatsApp:', e instanceof Error ? e.message : e)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, // Siempre 200 para MP
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
