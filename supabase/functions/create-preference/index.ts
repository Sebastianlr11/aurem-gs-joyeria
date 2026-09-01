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
    const { items, product, buyer, paymentMethod = 'mp', notes: orderNotes, atribucion, canal: canalPedido } = await req.json()

    /* 'web' por omisión para no romper al checkout del sitio, que no manda
       nada y seguirá sin mandarlo. Se acepta una lista corta y cerrada: un
       canal libre acabaría con 'whatsapp', 'WhatsApp' y 'wa' contando como
       tres cosas distintas. */
    const canal = ['whatsapp', 'web', 'manual', 'tiktok'].includes(canalPedido) ? canalPedido : 'web'

    /* Soporta formato nuevo (items array) y formato legacy (product objeto).

       La cantidad y la talla van POR PIEZA. Dos anillos para dos personas
       distintas llevan dos tallas, y meterlas en las notas del pedido —que
       es donde vivían— era garantizar que alguna se fabricara mal. */
    const crudos = items?.length
      ? items
      : product?.id
      ? [{ id: product.id, name: product.name, price: Number(product.price) }]
      : []

    type Pieza = { id: string; name: string; price: number; quantity: number; talla: string | null }

    const productItems: Pieza[] = (crudos as any[])
      .filter((i) => i?.id && i?.name && Number(i.price) >= 0)
      .map((i) => ({
        id: String(i.id),
        name: String(i.name),
        price: Number(i.price),
        // Sin cantidad válida se asume una: es el caso de siempre.
        quantity: Number.isFinite(Number(i.quantity)) && Number(i.quantity) > 0
          ? Math.min(Math.floor(Number(i.quantity)), 20)
          : 1,
        talla: i.talla ? String(i.talla).trim().slice(0, 20) : null,
      }))

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

    /* ── EL PRECIO SALE DEL CATÁLOGO, NO DEL QUE PIDE ────────────────────
    
       Esta función es pública: CORS `*`, sin JWT, sin secreto. Y hasta el 24
       de agosto de 2026 **el precio venía en el cuerpo de la petición y se
       cobraba tal cual**. Cualquiera con el id de una pieza podía pedir un
       anillo de $4.500.000 por $1.000 y recibir un enlace de Mercado Pago
       legítimo por esa cantidad: el pedido entraba a `orders` con `amount`
       falso, `mp-webhook` lo marcaba pagado, y en el panel se veía como una
       venta normal. También servía para saltarse el tope de contraentrega,
       que se compara contra ese mismo total.
    
       Nadie lo explotó —no hay pedidos reales todavía—, pero se encontró
       justo antes de prender pauta, que es cuando el enlace del catálogo
       empieza a circular.
    
       Valentina ya lo hacía bien: `crear_pedido` en `bot.ts` saca el precio
       de la pieza del catálogo con el comentario «es la diferencia entre
       cobrar lo que vale y cobrar lo que el modelo recordó». Era el checkout
       del sitio el que mandaba el precio, y el servidor el que se fiaba.
    
       Ahora se consulta `products` y se decide aquí. El nombre también: iba
       en el cuerpo y acaba en la plantilla de WhatsApp y en el correo. */
    const { data: delCatalogo, error: errorCatalogo } = await supabase
      .from('products')
      .select('id, name, price')
      .in('id', productItems.map((i) => i.id))

    if (errorCatalogo) {
      console.error('No se pudo consultar el catálogo:', errorCatalogo.message)
      return new Response(
        JSON.stringify({ error: 'No se pudo confirmar el precio' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const catalogo = new Map((delCatalogo ?? []).map((p) => [String(p.id), p]))

    /* El único descuento que existe: 2% por pagar en línea. La otra copia está
       en `MP_DISCOUNT`, en `src/pages/ProductPage.jsx`, que es quien lo
       anuncia. Si las dos se separan, aquí gana el catálogo y el cliente paga
       el precio lleno — que es el fallo correcto: cobrar de más se reclama,
       cobrar de menos se pierde y no se entera nadie. */
    const DESCUENTO_EN_LINEA = 0.02

    const desconocidas: string[] = []

    for (const item of productItems) {
      const pieza = catalogo.get(item.id)
      if (!pieza) { desconocidas.push(item.name); continue }

      const oficial = Number(pieza.price)
      const minimo = Math.round(oficial * (1 - DESCUENTO_EN_LINEA))

      if (!(item.price >= minimo && item.price <= oficial)) {
        console.error(
          `Precio fuera de rango para ${pieza.name}: pidieron $${item.price}, ` +
          `el catálogo dice $${oficial}. Se cobra el del catálogo.`,
        )
        item.price = oficial
      }

      item.name = String(pieza.name)
    }

    /* Una pieza que no está en el catálogo no se cobra. Valentina nunca manda
       una —`crear_pedido` se niega si no la encuentra— y el sitio tampoco. */
    if (desconocidas.length) {
      console.error('Piezas que no están en el catálogo:', desconocidas.join(', '))
      return new Response(
        JSON.stringify({ error: 'Alguna pieza ya no está disponible' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calcular totales combinados
    const totalAmount = productItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

    /* El nombre pegado sigue existiendo porque medio sistema lo lee: el
       panel, los avisos de WhatsApp, la búsqueda de duplicados. Lo que
       cambia es que ahora es un resumen, no la única verdad — las piezas de
       verdad viven en order_items. */
    const combinedName = productItems
      .map((i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name))
      .join(' + ')
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

      /* Cero es una DECISIÓN, no un dato malo.
       *
       * Hasta el 1 de septiembre de 2026 un cero caía en la rama de «abono
       * inválido» y se corregía solo a 20.000. Ese día el taller lo quitó
       * para Bogotá: la pauta traía gente a la ficha y se echaban atrás justo
       * al ver que había que pagar algo por adelantado. Ahora entregan ellos
       * mismos, así que un plantón cuesta el viaje y la pieza vuelve al
       * inventario — el abono ya no está cubriendo un envío pagado a un
       * tercero.
       *
       * Lo que sigue protegiendo el riesgo es el TOPE de arriba, que es la
       * línea entre lo que hay en stock y lo que se fabrica por encargo.
       *
       * El respaldo a 20.000 se queda para el caso que sí es un error: un
       * valor negativo, un texto, o un abono más grande que el pedido. */
      const configurado = Number(precios?.abono_envio ?? 20000)

      if (configurado === 0) {
        abono = 0
      } else if (!(configurado > 0) || configurado >= totalAmount) {
        console.error('Abono inválido:', configurado, 'sobre un total de', totalAmount)
        abono = Math.min(20000, Math.floor(totalAmount / 2))
      } else {
        abono = configurado
      }
    }

    /* Un contraentrega que no cobra nada por adelantado. No pasa por la
       pasarela, así que no hay enlace de pago ni nada que esperar. */
    const sinAbono = esContraEntrega && abono === 0

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
        /* Sin abono no hay pago que esperar, así que el pedido nace
           confirmado: es lo que le dice al taller que se puede alistar. Con
           abono sigue naciendo pendiente y lo confirma `mp-webhook` cuando
           entra el dinero.

           Y esto no es cosmético: `pendiente` NO cuenta como venta viva —ni
           en el panel ni en `venta_viva()`—, así que un pedido sin abono que
           se quedara pendiente sería un pedido real e invisible. */
        status: sinAbono ? 'confirmado' : 'pendiente',
        payment_method: paymentMethod === 'cod' ? 'contraentrega' : 'mercadopago',
        /* Por dónde entró la venta. Esta función la usan LOS DOS canales —el
           checkout del sitio y Valentina— y hasta ahora ninguno lo decía, así
           que todo caía en 'web' por omisión. El embudo de WhatsApp contaba
           order_source='whatsapp' y por eso daba cero conversión siempre:
           medía una etiqueta que nadie ponía, no el negocio.

           Que lo diga quien llama es lo correcto: esta función no puede saber
           de dónde viene, y adivinarlo por la forma del cuerpo sería frágil. */
        order_source: canal,
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
        /* `null` y no `0` cuando no hay abono: el cero diría «se abonaron
           cero pesos» y `null` dice «acá no hubo abono». Las cuentas del
           panel y `recibido_de()` en la base tratan los dos igual, pero el
           que lee el pedido no. */
        abono_monto: esContraEntrega && abono > 0 ? abono : null,
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

    /* Las piezas, una fila cada una, con el nombre y el precio congelados.
       Si el joyero sube un precio el mes que viene, este pedido tiene que
       seguir diciendo lo que se cobró: un pedido es un hecho del pasado, no
       una consulta al catálogo de hoy.

       Si falla, el pedido igual quedó creado y cobrable —el total y el
       nombre pegado están en orders— así que no se tumba la venta por esto.
       Pero se grita, porque sin las filas el correo enseña una pieza sola y
       el taller no sabe qué fabricar. */
    const { error: errorPiezas } = await supabase.from('order_items').insert(
      productItems.map((i) => ({
        order_id: orderId,
        product_id: i.id,
        nombre: i.name,
        precio: i.price,
        cantidad: i.quantity,
        talla: i.talla,
      })),
    )
    if (errorPiezas) {
      console.error('No se pudieron guardar las piezas del pedido:', orderId, errorPiezas.message)
    }

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
      piezaIds: productItems.map((i) => i.id),
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
    // @ts-expect-error EdgeRuntime existe en el entorno de Supabase pero no en sus tipos
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(avisoPedido)

    /* Sin abono no hay nada que cobrar hoy, así que acá se acaba: ni
       preferencia de Mercado Pago, ni enlace, ni pantalla de pago. El pedido
       ya quedó confirmado arriba y lo que sigue es entregarlo.

       Se sale DESPUÉS del aviso de conversión de arriba, a propósito: la venta
       se le cuenta a Meta y a TikTok igual, que es de lo que vive la pauta. */
    if (sinAbono) {
      return new Response(
        JSON.stringify({
          orderId,
          isCod: true,
          sinAbono: true,
          preferenceId: null,
          initPoint: null,
          abono: 0,
          /* Todo se paga al recibir. */
          saldo: totalAmount,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /* El contraentrega con abono sí pasa por Mercado Pago, pero sólo por ese
       abono. Se cobraba porque un pedido que no cuesta nada hacer es un pedido
       que la mitad de las veces no se recibe, y la devolución la pagaba el
       negocio; desde que las entregas de Bogotá las hace el taller, ese costo
       cambió y el abono quedó en cero. La rama se queda entera: el día que se
       vuelva a cobrar, o que se cobre fuera de Bogotá, funciona sola. */
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
      : productItems.map((item) => ({
          id: item.id,
          title: item.talla ? `${item.name} (talla ${item.talla})` : item.name,
          quantity: item.quantity,
          unit_price: item.price,
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
      /* AQUÍ IBA `notification_url`, y se quitó el 23 de agosto de 2026.
         Merece explicación porque parece que le estamos quitando al pago su
         único aviso, y es al revés.

         Se puso en su día porque un pago real entró y el pedido se quedó en
         "pendiente": no había webhook configurado en el panel de Mercado Pago
         y hubo que empujarlo a mano. La lección de entonces —"que no dependa
         de una casilla que nadie recuerda haber marcado"— era buena, pero la
         solución tenía un efecto que no se vio hasta el pago de prueba de hoy.

         `notification_url` en una preferencia NO configura un webhook: configura
         una notificación **IPN**, que es el mecanismo viejo. Llega como
         `?id=…&topic=payment` en vez de `?data.id=…&type=payment`, y la propia
         documentación de Mercado Pago dice que **a pesar de traer la cabecera
         `x-Signature`, las IPN no se pueden validar con la clave secreta**. O
         sea: desde que la firma está activa, cada IPN se rechaza con 401 por
         diseño. En el pago de hoy se rechazaron nueve seguidas.

         El que sí procesa el pago es el webhook del panel, en formato moderno y
         con firma verificable: respondió 200 y el diagnóstico de Mercado Pago
         lo reporta al 100 % de éxito. Con IPN fuera, queda un solo camino y
         está firmado.

         Si algún día ese webhook del panel se desconfigura, el vigía lo caza:
         comprueba que mp-webhook responde 401 a un POST sin firmar, que es
         justo lo que deja de pasar si alguien borra el secreto. */
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
