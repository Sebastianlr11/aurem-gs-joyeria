import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { enviarTexto, enviarPlantilla, ventanaAbierta, numeroPropioDe } from '../_shared/wa.ts'
import { avisarVenta } from '../_shared/conversiones.ts'
import { piezasDelPedido } from '../_shared/pedidos.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
}

/**
 * ¿Este aviso lo mandó Mercado Pago de verdad?
 *
 * Conviene ser preciso con lo que esto arregla y lo que no, porque el titular
 * asusta más que el hecho: **nunca se pudo falsificar un pago**. Esta función
 * no se cree lo que le mandan — toma el id del aviso y le pregunta a la API de
 * Mercado Pago con MP_ACCESS_TOKEN antes de tocar la base. Un aviso inventado
 * con un id cualquiera devuelve 404 y no pasa nada.
 *
 * Lo que sí quedaba abierto: cualquiera podía invocar el endpoint con ids
 * arbitrarios y gastarte cuota de la API. Ruido y consumo, no dinero.
 *
 * ABIERTA SI NO HAY SECRETO, y es a propósito. `wa-webhook` falla cerrado
 * siempre porque sin su secreto cualquiera podría hacer hablar al bot. Aquí no:
 * si esto fallara cerrado, desplegar el código antes de configurar el secreto
 * dejaría de procesar pagos y las clientas pagarían sin que el pedido se
 * enterara. Se activa sola el día que exista MP_WEBHOOK_SECRET.
 *
 * El esquema es el de Mercado Pago: la cabecera `x-signature` trae
 * `ts=…,v1=…`, y v1 es el HMAC SHA-256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * — cada campo se omite, junto con su clave, si no viene.
 *
 * Sin ventana de caducidad sobre el `ts` a propósito: Mercado Pago reintenta
 * un aviso durante horas, y rechazar los reintentos por viejos perdería
 * exactamente los pagos que el reintento venía a salvar.
 */
async function firmaValida(req: Request, url: URL): Promise<boolean> {
  const secreto = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!secreto) return true

  const cabecera = req.headers.get('x-signature')
  if (!cabecera) {
    console.error('Aviso sin x-signature con el secreto configurado: se rechaza')
    return false
  }

  const partes: Record<string, string> = {}
  for (const trozo of cabecera.split(',')) {
    const i = trozo.indexOf('=')
    if (i > 0) partes[trozo.slice(0, i).trim()] = trozo.slice(i + 1).trim()
  }
  const ts = partes.ts
  const recibido = partes.v1
  if (!ts || !recibido) return false

  /* El id va en minúsculas cuando es alfanumérico, según su documentación. */
  const idAviso = (url.searchParams.get('data.id') || url.searchParams.get('id') || '').toLowerCase()
  const idPeticion = req.headers.get('x-request-id') ?? ''

  let manifiesto = ''
  if (idAviso) manifiesto += `id:${idAviso};`
  if (idPeticion) manifiesto += `request-id:${idPeticion};`
  manifiesto += `ts:${ts};`

  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(manifiesto))
  const esperado = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('')

  /* Comparación de tiempo constante, igual que en wa-webhook: una comparación
     que sale antes cuando el primer carácter no coincide filtra la firma. */
  if (recibido.length !== esperado.length) return false
  let dif = 0
  for (let i = 0; i < esperado.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i)
  return dif === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    /* Antes de nada. Con el secreto puesto, un aviso sin firma válida no llega
       ni a consultarle nada a la API de Mercado Pago — que es justo el consumo
       que esto viene a cerrar. */
    if (!await firmaValida(req, url)) {
      return new Response(JSON.stringify({ error: 'Firma inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* El identificador del pago llega de dos formas según la clase de aviso.
       El IPN antiguo lo pone en la URL (?id=…&topic=payment); el webhook
       nuevo manda un POST con el cuerpo {type:'payment', data:{id}} y no
       siempre repite los parámetros. Leer sólo la URL era quedarse con la
       mitad de los avisos, y los que faltaran se descartaban en silencio con
       un 200: el pago entra, el pedido nunca se entera. */
    let cuerpo: Record<string, unknown> = {}
    if (req.method === 'POST') {
      try { cuerpo = await req.json() } catch { /* aviso sin cuerpo: normal en IPN */ }
    }
    const datos = (cuerpo.data ?? {}) as Record<string, unknown>

    /* Ojo: esto es el id del AVISO, que no siempre es el id del pago. Si el
       aviso es de una orden comercial, este número es el de la orden. */
    const avisoId = url.searchParams.get('data.id')
      || url.searchParams.get('id')
      || (datos.id != null ? String(datos.id) : null)

    const topic = url.searchParams.get('topic')
      || url.searchParams.get('type')
      || (typeof cuerpo.type === 'string' ? cuerpo.type : null)
      /* "payment.created", "payment.updated": nos quedamos con lo de antes
         del punto. */
      || (typeof cuerpo.action === 'string' ? cuerpo.action.split('.')[0] : null)

    // Solo procesamos notificaciones de pagos
    if (!avisoId || (topic && topic !== 'payment' && topic !== 'merchant_order')) {
      /* Se deja rastro: un aviso descartado sin explicación fue justo lo que
         escondió que Mercado Pago no estaba avisando. */
      console.log('Aviso descartado:', { avisoId, topic, metodo: req.method })
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!

    /* Mercado Pago avisa por dos vías distintas del mismo hecho: una por el
       pago y otra por la orden comercial que lo contiene. La segunda trae el
       número de la ORDEN, y buscarlo en /v1/payments/ devuelve 404 —que es
       justo lo que veníamos haciendo tres veces por compra—.

       Se podría ignorar y ya. Pero las dos vías son independientes, y el día
       que el aviso del pago se pierda, el de la orden va a llegar igual: si
       lo botamos, ese cliente pagó y nadie se entera. Así que en vez de
       descartarlo se abre la orden y se saca de ahí el pago aprobado.

       No hay riesgo de procesar dos veces: el candado de la base
       —conversion_enviada_en— sólo deja pasar al primero que llegue. */
    let paymentId = avisoId
    if (topic === 'merchant_order') {
      paymentId = await pagoAprobadoDe(avisoId, mpAccessToken)
      if (!paymentId) {
        console.log('Orden comercial sin pago aprobado todavía:', avisoId)
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      console.log(`Orden ${avisoId} → pago ${paymentId}`)
    }

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

    /* ¿Este pago es el total, o el abono que confirma un contraentrega? Los
       dos llegan por el mismo webhook y significan cosas distintas: uno cierra
       la venta, el otro apenas la confirma. Confundirlos daría por cobrado
       medio millón que todavía está en la puerta del cliente. */
    const { data: previo } = await supabase
      .from('orders').select('abono_monto').eq('id', orderId).maybeSingle()
    const esAbono = previo?.abono_monto != null

    const { data: orden, error: updateError } = await supabase
      .from('orders')
      .update({
        /* En contraentrega el pedido queda confirmado y entra a producción,
           pero NO pagado: la plata grande llega en la puerta. Ahí es donde el
           flujo del panel lo retoma. */
        /* El abono deja el pedido en `confirmado`, no en `procesando`.
           `procesando` significa una sola cosa —el taller ya empezó— y cuando
           entra el abono el joyero todavía no se ha enterado: el estado estaría
           mintiendo desde el primer minuto. `confirmado` dice lo que de verdad
           pasó: la clienta abonó el envío y hay compromiso. */
        status: esAbono ? 'confirmado' : 'pagado',
        ...(esAbono ? { abono_pagado_en: new Date().toISOString() } : {}),
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
      .select('es_prueba, customer_phone, customer_email, customer_name, product_id, product_name, amount, abono_monto, shipping_address, shipping_city, notes, ttclid, ttp, fbc, fbp, client_ua, client_ip, ctwa_clid')
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
      console.log(esAbono ? 'Abono recibido, pedido confirmado:' : 'Orden actualizada a pagado:', orderId)
    }

    /* Qué piezas lleva el pedido. Se leen una vez y sirven para todo lo que
       viene: la venta que se le cuenta a Meta y TikTok, y el correo. */
    const piezas = orden ? await piezasDelPedido(supabase, orderId, orden) : []

    /* La venta a TikTok y a Meta. Va antes del aviso por WhatsApp porque no
       depende de él y porque es lo que tiene ventana de tiempo: cuanto más
       cerca del pago llegue, mejor atribuye. Nunca lanza.

       Los pedidos de prueba NO se avisan. Se le habían contado tres a Meta y a
       TikTok antes de prender pauta, y con un píxel sin más historia esas
       ventas inventadas son todo lo que la plataforma sabe. Aquí el pedido sí
       se procesa entero —cambia de estado, sale el correo—: lo único que se
       salta es contárselo a las plataformas.

       `conversion_enviada_en` sí se marca igual, porque en esta función esa
       columna es además el candado contra los reintentos de Mercado Pago, que
       reenvía el mismo pago varias veces. Sin ella, una prueba repetiría el
       correo y el WhatsApp en cada reintento. */
    if (orden?.es_prueba) {
      console.log('Pedido de prueba: no se le cuenta a Meta ni a TikTok:', orderId)
    } else if (orden) {
      await avisarVenta({
        pedidoId: orderId,
        monto: Number(orden.amount),
        correo: orden.customer_email,
        telefono: orden.customer_phone,
        piezaId: orden.product_id,
        piezaIds: piezas.map((p) => p.productId).filter((id): id is string => !!id),
        piezaNombre: orden.product_name,
        ttclid: orden.ttclid,
        ttp: orden.ttp,
        fbc: orden.fbc,
        fbp: orden.fbp,
        ua: orden.client_ua,
        ip: orden.client_ip,
        ctwaClid: orden.ctwa_clid,
        url: 'https://www.auremgsjoyeria.com/confirmacion',
      })
    }

    /* Si el pedido entró por WhatsApp, se avisa por ahí mismo. Sin esto el
       cliente paga y se queda sin señal de que llegó: la pantalla de Mercado
       Pago se cierra y el chat, que es donde estuvo toda la conversación,
       queda mudo. */
    if (orden?.customer_phone) {
      try {
        const enPesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
        const total = Number(orden.amount)
        const abono = Number(orden.abono_monto)
        const saldo = total - abono
        const desdeId = await numeroPropioDe(orden.customer_phone)

        /* Por dónde sale el aviso depende de la ventana de 24 horas de Meta.

           Dentro de ella se puede escribir texto libre. Fuera, Meta lo rechaza
           con el error 131047 y sólo pasan plantillas aprobadas de antemano.

           Y "fuera" es el caso normal, no la excepción: entre que el cliente
           escribió por última vez y que el pago se aprueba pueden pasar días
           —sobre todo si la pieza se cotizó, se pensó y se pagó después—. En
           la primera prueba con plata real la ventana llevaba 28 horas
           cerrada: el pago entró y el cliente no recibió nada.

           Cuando la ventana está abierta se prefiere el texto libre porque
           dice más y no cuesta; la plantilla es el plan B, no el plan A. */
        const { abierta, minutosRestantes } = await ventanaAbierta(orden.customer_phone)

        if (abierta) {
          /* Se le repite el saldo exacto. Es el número que va a tener que
             tener listo en efectivo cuando toquen la puerta, y no saberlo es
             el motivo más tonto por el que se rechaza una entrega. */
          const texto = esAbono
            ? `¡Listo! Recibimos tu abono de ${enPesos(abono)} y tu ` +
              `${orden.product_name} queda confirmado. Al recibirlo pagas ` +
              `${enPesos(saldo)} en efectivo. ` +
              `Te aviso apenas se despache con el número de guía. 🌿`
            : `¡Listo! Recibimos tu pago de ${enPesos(total)} por ${orden.product_name}. ` +
              `Ya lo estamos preparando y te aviso apenas se despache. 🌿`

          await enviarTexto(orden.customer_phone, texto, 'ia', desdeId)
          console.log(`Pago avisado por texto (ventana abierta, ${minutosRestantes} min):`, orderId)
        } else {
          /* Sólo el primer nombre: la plantilla saluda con él y "Hola María
             Fernanda Rodríguez Gómez," no lo dice nadie. */
          const nombre = String(orden.customer_name ?? '').trim().split(/\s+/)[0]

          if (!nombre) {
            /* Meta rechaza una variable vacía, y un "Hola ," es peor que el
               silencio. No debería pasar —el checkout exige el nombre— pero
               si pasa, que quede dicho en el log y no se pierda callando. */
            console.error('Ventana cerrada y pedido sin nombre: no se pudo avisar', orderId)
          } else {
            /* El orden de las variables es el de la plantilla aprobada en
               Meta, y cambiarlo aquí sin cambiarlo allá manda el saldo donde
               va el abono. Si alguna vez se reaprueba la plantilla, revisar
               este orden es lo primero. */
            const envio = esAbono
              ? await enviarPlantilla(
                  orden.customer_phone,
                  'pedido_confirmado_abono',
                  // {{1}} nombre · {{2}} abono · {{3}} pieza · {{4}} saldo
                  [nombre, enPesos(abono), String(orden.product_name), enPesos(saldo)],
                  desdeId,
                )
              : await enviarPlantilla(
                  orden.customer_phone,
                  'pedido_confirmado',
                  // {{1}} nombre · {{2}} total · {{3}} pieza
                  [nombre, enPesos(total), String(orden.product_name)],
                  desdeId,
                )

            console.log(
              envio.ok
                ? 'Pago avisado por plantilla (ventana cerrada):'
                : `Plantilla rechazada (${envio.error}):`,
              orderId,
            )
          }
        }
      } catch (e) {
        // El pago ya quedó registrado: que falle el aviso no lo invalida.
        console.error('No se pudo avisar el pago por WhatsApp:', e instanceof Error ? e.message : e)
      }
    }

    /* Y el mismo aviso por correo, que es el que queda como documento: lo que
       la clienta reenvía, guarda para el seguro, o busca dos años después
       para la garantía. WhatsApp es la conversación; esto es el respaldo.

       Va detrás del WhatsApp a propósito. Si algo se cae, que se caiga lo que
       menos duele: el chat es donde la clienta está mirando ahora mismo.

       No se manda desde acá directamente porque las plantillas son
       componentes React y esto es Deno. La función de Vercel las renderiza y
       las envía; ver api/correo.js. */
    if (orden?.customer_email) {
      try {
        await avisarPorCorreo(orden, orderId, esAbono, piezas)
      } catch (e) {
        /* Nunca tumba el webhook. El pago ya está cobrado y registrado; que
           no salga un correo no puede hacer que Mercado Pago reintente ni que
           la venta quede sin contar. */
        console.error('No se pudo avisar el pago por correo:', e instanceof Error ? e.message : e)
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

/**
 * Saca el pago aprobado de una orden comercial.
 *
 * Devuelve null en dos casos que NO son errores:
 *
 * - La orden todavía no tiene pago aprobado. Pasa de verdad: su aviso suele
 *   llegar antes de que el pago se acredite, y el aviso del pago vendrá
 *   después.
 * - No la podemos leer. El primer intento con el host de Mercado Pago
 *   devolvió 403 con el mismo token que sí lee los pagos, así que se prueba
 *   también el host de MercadoLibre, que es contra el que los avisos IPN
 *   antiguos resuelven sus recursos.
 *
 * Si ninguno responde no se rompe nada: el aviso del pago es el que hace el
 * trabajo y siempre ha llegado. Esto es red de seguridad, no camino
 * principal, y una red que no se puede tender no puede tumbar el trapecio.
 */
const HOSTS_ORDEN = [
  'https://api.mercadopago.com/merchant_orders',
  'https://api.mercadolibre.com/merchant_orders',
]

async function pagoAprobadoDe(ordenId: string, token: string): Promise<string | null> {
  const fallos: string[] = []

  for (const host of HOSTS_ORDEN) {
    let res: Response
    try {
      res = await fetch(`${host}/${ordenId}`, { headers: { Authorization: `Bearer ${token}` } })
    } catch (e) {
      fallos.push(`${host}: ${e instanceof Error ? e.message : e}`)
      continue
    }
    if (!res.ok) {
      fallos.push(`${host}: ${res.status}`)
      continue
    }
    const orden = await res.json()
    const pagos = Array.isArray(orden?.payments) ? orden.payments : []
    const aprobado = pagos.find((p: Record<string, unknown>) => p?.status === 'approved')
    return aprobado?.id != null ? String(aprobado.id) : null
  }

  /* Un log, no uno por host, y sin console.error: no es una falla del cobro
     y no quiero que encienda alarmas por algo que no las merece. */
  console.log(`No se pudo leer la orden ${ordenId} (${fallos.join(' · ')}); manda el aviso del pago`)
  return null
}

/**
 * Le pide a la función de Vercel que mande la confirmación por correo.
 *
 * Trae la foto y la ficha de la pieza porque el correo las enseña: una
 * tarjeta con el nombre a secas se lee como una factura, y en una joyería el
 * producto es la mitad del mensaje. Si la consulta falla, el correo sale
 * igual con el rombo de la marca en vez de la foto — mejor eso que no
 * mandarlo.
 */
async function avisarPorCorreo(
  orden: Record<string, any>,
  orderId: string,
  esAbono: boolean,
  piezas: PiezaDePedido[],
) {
  const base = Deno.env.get('APP_URL') ?? 'https://www.auremgsjoyeria.com'
  const secreto = Deno.env.get('CORREO_SECRETO')
  if (!secreto) {
    console.error('correo: falta CORREO_SECRETO, no se manda')
    return
  }

  /* La referencia que ve la clienta es la misma que enseña la ficha de la
     pieza en el sitio. Si acá saliera otra, un reclamo por correo y otro por
     WhatsApp parecerían dos pedidos distintos. */
  const referencia = `AG-${String(orden.product_id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`

  const fecha = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  })

  const res = await fetch(`${base}/api/correo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-correo-secreto': secreto },
    body: JSON.stringify({
      plantilla: 'pedido-confirmado',
      para: orden.customer_email,
      /* La referencia del pedido y no la de la pieza: es lo que hace que un
         reenvío del webhook no mande el correo dos veces. */
      referencia: orderId,
      datos: {
        nombre: orden.customer_name,
        pieza: orden.product_name,
        referencia,
        total: Number(orden.amount),
        abono: esAbono ? Number(orden.abono_monto) : null,
        ciudad: orden.shipping_city ?? 'Colombia',
        direccion: orden.shipping_address ?? '',
        piezas,
        fecha,
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`api/correo respondió ${res.status}: ${(await res.text()).slice(0, 160)}`)
  }
  console.log('Confirmación por correo enviada:', orderId)
}
