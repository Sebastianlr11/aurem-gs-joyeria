import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { enviarTexto, numeroPropioDe } from '../_shared/wa.ts'

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
      })
      .eq('id', orderId)
      .select('customer_phone, customer_name, product_name, amount')
      .maybeSingle()

    if (updateError) {
      console.error('Error actualizando orden:', orderId, updateError)
    } else {
      console.log('Orden actualizada a pagado:', orderId)
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
