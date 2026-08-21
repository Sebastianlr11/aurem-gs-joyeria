import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { avisarVenta } from '../_shared/conversiones.ts'

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
    const { items, product, buyer, paymentMethod = 'mp', notes: orderNotes, atribucion } = await req.json()

    // Soporta formato nuevo (items array) y formato legacy (product objeto)
    const productItems: Array<{ id: string; name: string; price: number }> =
      items?.length
        ? items
        : product?.id
        ? [{ id: product.id, name: product.name, price: Number(product.price) }]
        : []

    /* Basta con uno de los dos: correo o teléfono. Los pedidos que entran por
       WhatsApp pueden no traer correo, y bloquear la venta por eso sería
       cambiar plata por un dato.

       Sí conviene tenerlo, y por eso se le pide: es donde Mercado Pago manda
       el comprobante del pago (ver el pagador, más abajo). Cuando no lo hay,
       el pedido sigue y el comprobante se pierde — que es peor que antes,
       pero mucho mejor que no vender. */
    if (!productItems.length || !buyer?.name || (!buyer?.email && !buyer?.phone)) {
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

    const esContraEntrega = paymentMethod === 'cod'

    /* El abono que confirma un contraentrega. Vive en taller_precios y no acá
       para que se pueda cambiar desde el panel; si la fila no existe se usa un
       valor de respaldo, porque quedarse sin poder tomar pedidos por eso sería
       peor que cobrar un número desactualizado. */
    let abono = 0
    if (esContraEntrega) {
      const { data: precios } = await supabase
        .from('taller_precios').select('abono_envio, tope_contraentrega').maybeSingle()

      /* El tope. Por encima de este monto la pieza no sale contra entrega:
         si la rechazan en la puerta, el taller paga ida y vuelta de media
         joya y el abono del envío no alcanza ni de lejos a cubrirlo.

         El candado va acá y no sólo en la interfaz porque acá es donde nace
         el pedido de verdad. La web puede esconder el botón y Valentina
         puede tener la regla en sus instrucciones, pero un modelo se puede
         equivocar y una pantalla se puede saltar; esto no.

         Si la fila no existe se usa un respaldo conservador: mejor rechazar
         un contraentrega legítimo que despachar medio millón a ciegas. */
      const tope = Number(precios?.tope_contraentrega ?? 500000)
      if (totalAmount > tope) {
        console.log(`Contraentrega rechazado: $${totalAmount} pasa el tope de $${tope}`)
        return new Response(JSON.stringify({
          error: 'contraentrega_no_disponible',
          tope,
          mensaje: `Los pedidos de más de $${tope.toLocaleString('es-CO')} se pagan en línea, no contra entrega.`,
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      abono = Number(precios?.abono_envio ?? 20000)
      if (!(abono > 0) || abono >= totalAmount) {
        console.error('Abono inválido:', abono, 'sobre un total de', totalAmount)
        abono = Math.min(20000, Math.floor(totalAmount / 2))
      }
    }

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
        customer_email: buyer.email ?? null,
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
        /* De qué anuncio vino. Se guarda ahora porque después no hay dónde
           sacarlo: cuando Mercado Pago confirma el pago, el navegador que
           tenía estas cookies ya no está en la conversación. */
        ttclid: atribucion?.ttclid ?? null,
        ttp: atribucion?.ttp ?? null,
        fbc: atribucion?.fbc ?? null,
        fbp: atribucion?.fbp ?? null,
        client_ua: atribucion?.ua ?? null,
        /* La IP sale del encabezado y no del cuerpo: el cliente la podría
           inventar, y este es el único momento en que su navegador nos habla
           directamente. El primero de la lista es el suyo; los siguientes son
           los proxis por los que pasó. */
        client_ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
        ctwa_clid: atribucion?.ctwa_clid ?? null,
        anuncio_id: atribucion?.anuncio_id ?? null,
        utm_source: atribucion?.utm_source ?? null,
        utm_campaign: atribucion?.utm_campaign ?? null,
        abono_monto: esContraEntrega ? abono : null,
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

    /* Se le avisa a TikTok y a Meta que alguien se comprometió a comprar,
       ahora mismo y no cuando entre la plata.
       
       En contraentrega esas dos cosas están separadas por días —el cliente
       paga en la puerta y el cobro se confirma después— y las plataformas
       sólo atribuyen dentro de siete días desde el clic en el anuncio. Si la
       única señal fuera el pago, buena parte de las ventas llegaría fuera de
       la ventana y no se le acreditaría a ningún anuncio. Peor todavía: el
       algoritmo necesita decenas de conversiones para dejar de tantear, y con
       una semana de retraso aprende de lo que pasó hace una semana.
       
       La compra sigue saliendo cuando el dinero entra, con el valor real.
       Este evento dice "se comprometió", no "pagó", y por eso es
       InitiateCheckout y no Purchase. */
    const avisoPedido = avisarVenta({
      pedidoId: orderId,
      monto: totalAmount,
      evento: 'pedido',
      correo: buyer.email ?? null,
      telefono: buyer.phone ?? null,
      piezaId: firstProductId,
      piezaNombre: combinedName,
      ttclid: atribucion?.ttclid ?? null,
      ttp: atribucion?.ttp ?? null,
      fbc: atribucion?.fbc ?? null,
      fbp: atribucion?.fbp ?? null,
      ua: atribucion?.ua ?? null,
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      ctwaClid: atribucion?.ctwa_clid ?? null,
      url: 'https://www.auremgsjoyeria.com/',
    })

    /* No se espera: el cliente está mirando una pantalla de carga y la
       medición no puede costarle segundos. Si el entorno no deja trabajo en
       segundo plano, se deja correr sin await —avisarVenta nunca lanza. */
    // @ts-ignore EdgeRuntime existe en el entorno de Supabase
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(avisoPedido)

    /* El contraentrega también pasa por Mercado Pago, pero sólo por el abono.
       Antes se confirmaba solo, y un pedido que no cuesta nada hacer es un
       pedido que la mitad de las veces no se recibe: la devolución la paga el
       negocio y, peor, le enseña a los anuncios que ese público compra. */
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const appUrl = (Deno.env.get('APP_URL') ?? 'https://auremgsjoyeria.vercel.app').replace(/\/$/, '')

    /* En contraentrega se cobra un solo renglón por el abono, y no las piezas:
       el cliente no está pagando el anillo todavía, y ver el precio completo
       en la pasarela cuando va a girar veinte mil confunde y tumba el pago. */
    const mpItems = esContraEntrega
      ? [{
          id: orderId,
          title: `Abono de envío — ${combinedName}`,
          description: `Se descuenta del total. Al recibir pagas $${(totalAmount - abono).toLocaleString('es-CO')}.`,
          quantity: 1,
          unit_price: abono,
          currency_id: 'COP',
        }]
      : productItems.map(item => ({
          id: item.id,
          title: item.name,
          quantity: 1,
          unit_price: Number(item.price),
          currency_id: 'COP',
        }))

    /* Quién paga, con sus datos reales.

       Antes iba una dirección fija inventada —comprador@auremgsjoyeria.com—
       porque el campo es obligatorio y los pedidos de WhatsApp podían no
       traer correo. El efecto era que Mercado Pago le mandaba el comprobante
       del pago a un buzón que no existe: la clienta pagaba y no le llegaba
       ningún respaldo del medio de pago.

       Ahora se usa el suyo cuando lo hay, y el de relleno sólo cuando no.

       OJO al probar: Mercado Pago no deja que alguien se pague a sí mismo.
       Si el correo del comprador es el mismo de la cuenta que cobra, el
       botón de pagar sale deshabilitado. Para probar hay que usar otro
       correo, no el de la cuenta del negocio.

       El nombre y el teléfono van también: llegan precargados a la pantalla
       de pago y son tres campos menos que teclear con el pulgar.

       Y sólo si parece un correo. Con el valor fijo no había forma de que
       fallara; ahora que viene del formulario, uno mal escrito hace que
       Mercado Pago rechace la preferencia entera y la clienta vea "Error al
       crear preferencia de pago" en vez de la pantalla de pago. Ante la duda,
       el de relleno: peor es no poder cobrar. */
    const correoValido = typeof buyer.email === 'string'
      && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(buyer.email.trim())

    const [nombrePila, ...resto] = String(buyer.name).trim().split(/\s+/)
    const soloDigitos = String(buyer.phone ?? '').replace(/\D/g, '')
    /* En E.164 colombiano el indicativo son los dos primeros dígitos si el
       número viene con prefijo; si no, son los diez de siempre. */
    const numeroLocal = soloDigitos.length > 10 ? soloDigitos.slice(-10) : soloDigitos

    const preference: Record<string, unknown> = {
      items: mpItems,
      payer: {
        email: correoValido ? buyer.email.trim() : 'comprador@auremgsjoyeria.com',
        name: nombrePila,
        ...(resto.length ? { surname: resto.join(' ') } : {}),
        ...(numeroLocal.length === 10
          ? { phone: { area_code: '57', number: numeroLocal } }
          : {}),
      },
      back_urls: {
        success: `${appUrl}/confirmacion`,
        failure: `${appUrl}/confirmacion`,
        pending: `${appUrl}/confirmacion`,
      },
      external_reference: orderId,
      /* A dónde avisa Mercado Pago cuando el pago cambia de estado.
         Sin esto no avisa a ninguna parte: el cliente paga, la orden se queda
         en "pendiente" para siempre, no sale el WhatsApp de confirmación y la
         venta no llega ni a TikTok ni a Meta. Se descubrió en la primera
         prueba con plata real —el pago entró y hubo que empujar el webhook a
         mano—. Va en la preferencia y no en el panel de Mercado Pago para que
         no dependa de una casilla que nadie recuerda haber marcado. */
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
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
        isCod: esContraEntrega,
        abono: esContraEntrega ? abono : null,
        saldo: esContraEntrega ? totalAmount - abono : null,
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
