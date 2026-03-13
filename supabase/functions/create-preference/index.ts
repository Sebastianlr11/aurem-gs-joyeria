import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { items, product, buyer, paymentMethod = 'mp', notes: orderNotes } = await req.json()

    // Soporta formato nuevo (items array) y formato legacy (product objeto)
    const productItems: Array<{ id: string; name: string; price: number }> =
      items?.length
        ? items
        : product?.id
        ? [{ id: product.id, name: product.name, price: Number(product.price) }]
        : []

    if (!productItems.length || !buyer?.name || !buyer?.email) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calcular totales combinados
    const totalAmount = productItems.reduce((sum, item) => sum + Number(item.price), 0)
    const combinedName = productItems.map(i => i.name).join(' + ')
    const firstProductId = productItems[0].id

    // Cancelar pedidos pendientes duplicados del mismo cliente + producto
    // (ej: cliente cambia de MercadoPago a contraentrega)
    if (buyer.phone) {
      const { error: cancelError } = await supabase
        .from('orders')
        .update({ status: 'cancelado' })
        .eq('status', 'pendiente')
        .eq('product_name', combinedName)
        .eq('customer_phone', buyer.phone)
      if (cancelError) console.warn('Error cancelando duplicados:', cancelError)
    } else if (buyer.email) {
      const { error: cancelError } = await supabase
        .from('orders')
        .update({ status: 'cancelado' })
        .eq('status', 'pendiente')
        .eq('product_name', combinedName)
        .eq('customer_email', buyer.email)
      if (cancelError) console.warn('Error cancelando duplicados:', cancelError)
    }

    // Insertar una sola orden con todos los productos
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: buyer.name,
        customer_email: buyer.email,
        customer_phone: buyer.phone ?? null,
        product_id: firstProductId,
        product_name: combinedName,
        amount: totalAmount,
        status: 'pendiente',
        payment_method: paymentMethod === 'cod' ? 'contraentrega' : 'mercadopago',
        notes: [
          buyer.address ? `Dirección: ${buyer.address}` : null,
          buyer.city ? `Ciudad: ${buyer.city}` : null,
          buyer.department ? `Departamento: ${buyer.department}` : null,
          orderNotes || null,
        ].filter(Boolean).join(' | ') || null,
        shipping_address: buyer.address ?? null,
        shipping_city: buyer.city ?? null,
        shipping_department: buyer.department ?? null,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('Order insert error:', orderError)
      return new Response(
        JSON.stringify({ error: 'Error al crear la orden' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orderId = order.id

    // Contraentrega: no necesita preferencia MP
    if (paymentMethod === 'cod') {
      return new Response(
        JSON.stringify({ orderId, isCod: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Flujo Mercado Pago (producción)
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const appUrl = (Deno.env.get('APP_URL') ?? 'https://auremgsjoyeria.vercel.app').replace(/\/$/, '')

    const mpItems = productItems.map(item => ({
      id: item.id,
      title: item.name,
      quantity: 1,
      unit_price: Number(item.price),
      currency_id: 'COP',
    }))

    const preference: Record<string, unknown> = {
      items: mpItems,
      payer: {
        email: 'comprador@auremgsjoyeria.com',
      },
      back_urls: {
        success: `${appUrl}/confirmacion`,
        failure: `${appUrl}/confirmacion`,
        pending: `${appUrl}/confirmacion`,
      },
      external_reference: orderId,
      statement_descriptor: 'AUREM GS JOYERIA',
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': orderId,
      },
      body: JSON.stringify(preference),
    })

    if (!mpRes.ok) {
      const mpError = await mpRes.text()
      console.error('MP error:', mpError)
      return new Response(
        JSON.stringify({ error: 'Error al crear preferencia de pago' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mpData = await mpRes.json()
    const preferenceId = mpData.id

    await supabase.from('orders').update({ mp_preference_id: preferenceId }).eq('id', orderId)

    return new Response(
      JSON.stringify({
        preferenceId,
        orderId,
        initPoint: mpData.init_point ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
