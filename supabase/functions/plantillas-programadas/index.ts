/**
 * Los avisos que salen solos por WhatsApp.
 *
 * Pasadas 24 horas del último mensaje del cliente, Meta no deja escribir texto
 * libre: sólo plantillas aprobadas. Esta función recorre la base buscando las
 * tres situaciones donde hace falta un aviso y no hay nadie mirando —un pedido
 * despachado sin avisar, un cobro generado sin pagar, una conversación que se
 * enfrió— y manda la plantilla que corresponde.
 *
 * Le escribe a clientes reales y una de las tres cuesta plata por mensaje. Los
 * frenos, entonces, no son opcionales:
 *
 *   · APAGADA por defecto. Sin PLANTILLAS_ACTIVAS='true' hace todo el recorrido
 *     y reporta qué mandaría, sin mandar nada. Es como se prueba sin riesgo.
 *   · Una sola vez. El candado es un índice único en la base, no un `if`.
 *   · Nunca a quien pidió que no le escriban, ni a una conversación que está
 *     en manos de una persona.
 *   · Tope diario para la de marketing, que es la única que se cobra siempre.
 *   · Si no se puede armar un mensaje concreto, no se manda. Un aviso vago es
 *     peor que ninguno.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { admin, enviarPlantilla } from '../_shared/wa.ts'
import { aNumeroDeWhatsApp } from '../_shared/reglas.ts'
import { rastreoDe } from '../_shared/envios.ts'

const ACTIVAS = Deno.env.get('PLANTILLAS_ACTIVAS') === 'true'

/* Cuántas de reactivación como máximo por día. Es la única que se cobra
   siempre, y sin tope un error de consulta se convierte en una factura. */
const TOPE_MARKETING_DIARIO = 30

/** Cada cuánto corre. Define la ventana de búsqueda para no repetir trabajo. */
const HORA = 60 * 60 * 1000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** El primer nombre. "Hola Laura" y no "Hola Laura Gómez Restrepo". */
const primerNombre = (completo: string | null): string => {
  const partes = String(completo ?? '').trim().split(/\s+/)
  return partes[0] || 'hola'
}

type Envio = {
  plantilla: string
  telefono: string
  pedidoId: string | null
  variables: string[]
}

/**
 * Manda una y la deja anotada.
 *
 * El registro se escribe ANTES de mandar, porque el índice único es lo que
 * garantiza que no salga dos veces: si dos corridas se solapan, la segunda
 * choca contra la base y se retira. Escribir después dejaría una ventana en la
 * que las dos creerían ser la primera.
 */
async function mandar(e: Envio): Promise<'enviada' | 'repetida' | 'apagada' | string> {
  const db = admin()

  const { data: anotada, error: choque } = await db.from('plantillas_enviadas').insert({
    phone_number: e.telefono,
    plantilla: e.plantilla,
    pedido_id: e.pedidoId,
  }).select('id').single()

  if (choque) {
    if (choque.code === '23505') return 'repetida'
    console.error('No se pudo anotar el envío:', choque.message)
    return `no se anotó: ${choque.message}`
  }

  if (!ACTIVAS) {
    /* Modo prueba: se anota para recorrer el camino completo —incluido el
       candado, que es lo que se quiere ver funcionar— y después se borra,
       para que la corrida de verdad sí pueda mandar.

       El borrado estaba mal escrito: filtraba por `pedido_id` con `.is(…,
       undefined)` y con un uuid inventado a la vez, así que no borraba nada
       y fallaba callado. La consecuencia era que cada prueba quemaba el
       aviso real de ese pedido para siempre — un modo prueba que saboteaba
       justo lo que decía estar probando, y sin dejar rastro.

       Ahora el filtro se arma según haya pedido o no, y si el borrado falla
       se dice, porque una anotación que sobrevive es un cliente que no
       recibe su aviso. */
    const borrado = e.pedidoId
      ? await db.from('plantillas_enviadas').delete()
          .eq('phone_number', e.telefono).eq('plantilla', e.plantilla).eq('pedido_id', e.pedidoId)
      : await db.from('plantillas_enviadas').delete()
          .eq('phone_number', e.telefono).eq('plantilla', e.plantilla).is('pedido_id', null)

    if (borrado.error) {
      console.error('MODO PRUEBA: no se pudo borrar la anotación, este aviso ya no saldrá:',
                    e.plantilla, e.pedidoId, borrado.error.message)
      return 'apagada, pero quedó anotada'
    }
    return 'apagada'
  }

  const res = await enviarPlantilla(e.telefono, e.plantilla, e.variables)

  /* Por el `id` de la fila que se acaba de anotar, no por teléfono y
     plantilla. La misma persona puede recibir la misma plantilla por dos
     pedidos distintos —el candado lo permite a propósito—, y filtrando así se
     pisaban las dos filas: el `wamid` viejo se sobrescribía con el nuevo, y un
     envío fallido de hoy marcaba como fallido el de la semana pasada. La tabla
     existe justamente para poder mirar eso después. */
  await db.from('plantillas_enviadas')
    .update({ wamid: res.wamid ?? null, error: res.ok ? null : (res.error ?? 'falló') })
    .eq('id', anotada.id)

  return res.ok ? 'enviada' : (res.error ?? 'falló')
}

/**
 * ¿A esta persona se le puede escribir?
 *
 * Dos frenos: que no haya pedido que no le escriban, y que no haya alguien del
 * equipo atendiendo ese chat ahora mismo.
 *
 * Lo pregunta la base y no este archivo, y no es por elegancia. Antes se hacía
 * aquí con `.eq('phone', telefono)`, comparando la cadena CRUDA — y el mismo
 * número entra de tres formas según el canal. El 23 de agosto de 2026, con 18
 * pedidos en la base, diez tenían el teléfono en un formato distinto al de su
 * ficha de cliente: para esos diez **ninguno de los dos frenos se consultaba
 * nunca**. La búsqueda no encontraba nada y el código lo leía como «adelante».
 * No daba error; simplemente decía que sí.
 *
 * La función de la base compara por los últimos diez dígitos con la misma
 * expresión del índice único de `customers`.
 *
 * Ante la duda, NO se escribe: si la consulta falla, callar es recuperable y
 * escribirle a quien pidió que no lo hicieran, no.
 */
async function sePuede(telefono: string): Promise<boolean> {
  const { data, error } = await admin().rpc('puede_recibir_plantillas', { p_telefono: telefono })
  if (error) {
    console.error('No se pudo comprobar si se le puede escribir, se calla:', error.message)
    return false
  }
  return data === true
}

/* ─── 1. Pedido despachado ──────────────────────────────────────────
   El mensaje que más tranquiliza: el cliente pagó por algo que todavía no
   vio. Se busca hacia atrás dos días y no más, para que una primera corrida
   no despierte pedidos viejos. */
async function despachados(): Promise<Envio[]> {
  const { data } = await admin()
    .from('orders')
    .select('id, customer_name, customer_phone, product_name, tracking_number, carrier, status_updated_at')
    .eq('status', 'enviado')
    /* Los pedidos del equipo no reciben avisos de cliente. El resto del panel
       ya los separa con es_prueba; esta función era la única que no. */
    .eq('es_prueba', false)
    .not('tracking_number', 'is', null)
    .not('customer_phone', 'is', null)
    .gte('status_updated_at', new Date(Date.now() - 48 * HORA).toISOString())

  const envios: Envio[] = []

  for (const o of data ?? []) {
    /* Sin transportadora no se manda.

       La plantilla dice "va por X con la guía Y": las dos son promesas
       concretas. Antes el nombre estaba escrito fijo dentro de la plantilla
       —siempre Interrapidísimo—, así que un pedido despachado por
       Servientrega le decía al cliente algo falso y lo mandaba a buscar su
       guía donde no estaba.

       El enlace de rastreo NO va acá: Meta rechazó la plantilla que lo
       llevaba dentro de una variable, y es entendible —una variable que
       inyecta una dirección es el vector clásico de phishing—. El enlace lo
       lleva el correo de despacho, que no tiene esa restricción y además
       puede ponerlo en un botón. Cada canal hace lo que puede hacer.

       El correo sale igual aunque la transportadora sea "Otro": ahí el botón
       de rastrear simplemente no se pinta. */
    const transportadora = String(o.carrier ?? '').trim()
    if (!transportadora || !rastreoDe(transportadora)) {
      console.log(`Despacho sin transportadora reconocida (${transportadora || 'vacía'}), no se avisa por WhatsApp:`, o.id)
      continue
    }

    envios.push({
      /* Nombre nuevo, no 'pedido_despachado'. Aquella se rechazó por llevar
         el enlace de rastreo dentro de una variable, y una plantilla
         rechazada no se puede editar. Reusar el nombre tampoco: Meta lo
         bloquea 30 días después de borrarla. */
      plantilla: 'pedido_en_camino',
      telefono: aNumeroDeWhatsApp(o.customer_phone),
      pedidoId: o.id,
      // {{1}} nombre · {{2}} pieza · {{3}} transportadora · {{4}} guía
      variables: [
        primerNombre(o.customer_name),
        o.product_name,
        transportadora,
        o.tracking_number!,
      ],
    })
  }

  return envios
}

/* ─── 2. Pago pendiente ─────────────────────────────────────────────
   Se generó el enlace de Mercado Pago y no entró la plata. Se espera tres
   horas —mucha gente paga en un rato, y escribirle a los diez minutos es
   apurar— y se deja de insistir a los dos días. */
async function sinPagar(): Promise<Envio[]> {
  const ahora = Date.now()
  const { data } = await admin()
    .from('orders')
    .select('id, customer_name, customer_phone, product_name')
    .eq('status', 'pendiente')
    .eq('es_prueba', false)
    .eq('payment_method', 'mercadopago')
    .not('mp_preference_id', 'is', null)
    .not('customer_phone', 'is', null)
    .lte('created_at', new Date(ahora - 3 * HORA).toISOString())
    .gte('created_at', new Date(ahora - 48 * HORA).toISOString())

  return (data ?? []).map((o) => ({
    plantilla: 'pago_pendiente',
    telefono: aNumeroDeWhatsApp(o.customer_phone),
    pedidoId: o.id,
    variables: [primerNombre(o.customer_name), o.product_name],
  }))
}

/* ─── 3. Cotización sin cerrar ──────────────────────────────────────
   La única de marketing, la única que cuesta. Se busca a quien habló, se
   interesó en una pieza concreta y no volvió.

   El requisito de "pieza concreta" no es un adorno: la plantilla dice "te
   había pasado el precio de {{2}}", y si no sabemos qué pieza era, el mensaje
   queda vago y molesta en vez de vender. Antes que mandar algo genérico, no
   se manda. */
async function enfriadas(): Promise<Envio[]> {
  const db = admin()
  const ahora = Date.now()

  /* Quiénes escribieron hace dos o cuatro días y no volvieron. Se mira el
     último mensaje de cada persona. */
  const { data: mensajes } = await db
    .from('whatsapp_conversaciones')
    .select('phone_number, created_at')
    .eq('role', 'user')
    .gte('created_at', new Date(ahora - 4 * 24 * HORA).toISOString())
    .order('created_at', { ascending: false })

  const ultimoDe = new Map<string, string>()
  for (const m of mensajes ?? []) {
    if (!ultimoDe.has(m.phone_number)) ultimoDe.set(m.phone_number, m.created_at)
  }

  const candidatos = [...ultimoDe.entries()]
    .filter(([, cuando]) => Date.now() - new Date(cuando).getTime() >= 2 * 24 * HORA)
    .map(([telefono]) => telefono)

  if (!candidatos.length) return []

  // Quien ya compró alguna vez no es una cotización sin cerrar.
  const { data: conPedido } = await db
    .from('orders')
    .select('customer_phone')
    .in('customer_phone', candidatos)

  const compraron = new Set((conPedido ?? []).map((o) => o.customer_phone))

  /* Y los contactos del equipo tampoco: probar el bot con el número de un
     amigo no es una cotización que se enfrió, y mandarle seguimiento comercial
     a la casa es ruido — o peor, si la plantilla es de Marketing.

     Se comparan los últimos diez dígitos, no la cadena entera: el mismo número
     aparece como 3143602930, +573143602930 y 573143602930 según por dónde
     entre. Es el mismo criterio que usan los disparadores de es_prueba en la
     base, y aquí hace falta porque estos teléfonos vienen de las
     conversaciones y no de un pedido. */
  const diezUltimos = (t: string | null | undefined) =>
    String(t ?? '').replace(/\D/g, '').slice(-10)

  const { data: dePrueba } = await db
    .from('customers').select('phone').eq('es_prueba', true)
  const delEquipo = new Set((dePrueba ?? []).map((c) => diezUltimos(c.phone)).filter(Boolean))

  const frios = candidatos.filter(
    (t) => !compraron.has(t) && !delEquipo.has(diezUltimos(t)),
  )
  if (!frios.length) return []

  const [{ data: piezas }, { data: clientes }] = await Promise.all([
    db.from('products').select('name'),
    db.from('customers').select('phone, name').in('phone', frios),
  ])

  const nombreDe = new Map((clientes ?? []).map((c) => [c.phone, c.name]))
  const catalogo = (piezas ?? []).map((p) => p.name)

  const envios: Envio[] = []

  for (const telefono of frios) {
    /* Qué pieza se le mostró. Se busca en lo que Valentina escribió, no en lo
       que escribió el cliente: el nombre exacto del catálogo sale de nuestro
       lado, no del suyo. */
    const { data: dichos } = await db
      .from('whatsapp_conversaciones')
      .select('content')
      .eq('phone_number', telefono)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(12)

    const texto = (dichos ?? []).map((d) => d.content ?? '').join(' ')
    const pieza = catalogo.find((n) => texto.includes(n))
    if (!pieza) continue          // sin pieza concreta no hay mensaje que valga

    envios.push({
      plantilla: 'cotizacion_sin_cerrar',
      telefono,
      pedidoId: null,             // una sola vez por persona, para siempre
      variables: [primerNombre(nombreDe.get(telefono) ?? null), pieza],
    })
  }

  return envios
}

/** Cuántas de marketing salieron hoy, para no pasarse del tope. */
async function marketingDeHoy(): Promise<number> {
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)

  const { count } = await admin()
    .from('plantillas_enviadas')
    .select('id', { count: 'exact', head: true })
    .eq('plantilla', 'cotizacion_sin_cerrar')
    .is('error', null)
    .gte('enviada_en', desde.toISOString())

  return count ?? 0
}

/**
 * Comparación de largo constante: con un === normal, lo que tarda en fallar
 * delata cuántos caracteres se acertaron.
 */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  /* Un secreto propio, además del JWT.
  
     El JWT lo satisface la clave anónima del proyecto, que es pública por
     diseño: cualquiera que mire el sitio la tiene. Con los envíos apagados
     eso da igual, pero encendidos significa que un desconocido puede
     dispararla cuando quiera — y una de las tres plantillas es de marketing
     y se cobra por mensaje.

     El candado de la base impide que un mismo aviso salga dos veces, así que
     lo peor que lograría es adelantar mensajes que igual iban a salir. Pero
     no hay razón para dejar la puerta abierta.

     Vive en ajustes_internos y no en una variable de entorno para que no
     tenga que pasar por ninguna mano: lo generó la base, lo lee el cron para
     firmar su llamada, y lo lee esta función para verificarla. Rotarlo es un
     UPDATE, sin redesplegar nada. */
  const { data: ajuste } = await admin()
    .from('ajustes_internos').select('valor').eq('clave', 'cron_secreto').maybeSingle()

  const secreto = String(ajuste?.valor ?? '')
  if (!secreto) {
    console.error('Falta el secreto del cron en ajustes_internos: se rechaza todo')
    return json({ error: 'sin configurar' }, 500)
  }
  if (!iguales(String(req.headers.get('x-cron-secreto') ?? ''), secreto)) {
    return json({ error: 'no autorizado' }, 401)
  }

  const t0 = Date.now()
  const resultado: Record<string, unknown> = { activas: ACTIVAS, enviadas: 0, saltadas: 0, detalle: [] as unknown[] }
  const detalle = resultado.detalle as unknown[]

  try {
    const [aDespachar, aCobrar, aRetomar] = await Promise.all([despachados(), sinPagar(), enfriadas()])

    let cupoMarketing = Math.max(0, TOPE_MARKETING_DIARIO - (await marketingDeHoy()))

    for (const envio of [...aDespachar, ...aCobrar, ...aRetomar]) {
      const esMarketing = envio.plantilla === 'cotizacion_sin_cerrar'

      if (esMarketing && cupoMarketing <= 0) {
        detalle.push({ ...envio, resultado: 'tope diario de marketing' })
        resultado.saltadas = (resultado.saltadas as number) + 1
        continue
      }

      if (!(await sePuede(envio.telefono))) {
        detalle.push({ plantilla: envio.plantilla, telefono: envio.telefono, resultado: 'no se le escribe' })
        resultado.saltadas = (resultado.saltadas as number) + 1
        continue
      }

      const res = await mandar(envio)
      detalle.push({ plantilla: envio.plantilla, telefono: envio.telefono, variables: envio.variables, resultado: res })

      if (res === 'enviada') {
        resultado.enviadas = (resultado.enviadas as number) + 1
        if (esMarketing) cupoMarketing--
      } else {
        resultado.saltadas = (resultado.saltadas as number) + 1
      }
    }

    resultado.ms = Date.now() - t0
    console.log(`plantillas · ${resultado.enviadas} enviadas · ${resultado.saltadas} saltadas · ${resultado.ms} ms` +
                (ACTIVAS ? '' : ' · MODO PRUEBA, no se mandó nada'))
    return json(resultado)
  } catch (e) {
    console.error('plantillas-programadas falló:', e instanceof Error ? e.message : e)
    return json({ error: 'falló', detalle: String(e) }, 500)
  }
})
