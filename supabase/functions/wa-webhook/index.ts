/**
 * Webhook de la Cloud API de Meta.
 * Recibe los mensajes de los clientes y los acuses de entrega, y despierta
 * a Valentina. Sustituye al flujo de n8n.
 *
 * Meta corta a los 20 segundos y reintenta si no ve un 200, así que se
 * responde de inmediato y el trabajo largo sigue en waitUntil.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { admin, enModoManual, enviarTexto, enviarTextoNatural, idDestino, mantenerEscribiendo } from '../_shared/wa.ts'
import { responder } from '../_shared/bot.ts'
import { transcribir, verYGuardarImagen } from '../_shared/medios.ts'

/* Cuánto se espera antes de contestar. La gente reparte una idea en tres o
   cuatro mensajes seguidos: si se responde al primero, Valentina interrumpe,
   se atropella y cuesta una llamada al modelo por cada uno. Se espera a que
   termine, y el indicador de "escribiendo" hace que la pausa se lea natural. */
const ESPERA_A_QUE_TERMINE_MS = 8_000

const ok = (cuerpo: unknown = { ok: true }) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** Meta firma cada entrega; sin esto cualquiera podría escribirle a tus clientes. */
/* Cuando llega algo que no se puede abrir.
 *
 * No dice "no soporto ese formato", que es lenguaje de sistema y además no le
 * sirve de nada a quien está del otro lado: dice qué hacer. Y se disculpa una
 * vez, no cada vez — si alguien manda cinco stickers seguidos, cinco disculpas
 * idénticas se leen peor que el silencio.
 */
const AVISO_NO_ABRIO =
  'Perdona, eso no me llegó bien 🙈 ¿Me lo escribes o me mandas una foto? Así te ayudo de una.'

const MINUTOS_ENTRE_AVISOS = 30

async function avisarQueNoSeAbrio(
  db: ReturnType<typeof admin>,
  telefono: string,
  numeroPropio: string | null,
): Promise<void> {
  /* Sólo si no se dijo hace poco. Sin este candado, una ráfaga de stickers
     produce una ráfaga de disculpas. */
  const desde = new Date(Date.now() - MINUTOS_ENTRE_AVISOS * 60_000).toISOString()
  const { data: yaDicho } = await db
    .from('whatsapp_conversaciones')
    .select('id')
    .eq('phone_number', telefono)
    .eq('role', 'assistant')
    .eq('content', AVISO_NO_ABRIO)
    .gte('created_at', desde)
    .limit(1)

  if (yaDicho?.length) return

  await enviarTexto(telefono, AVISO_NO_ABRIO, 'ia', numeroPropio)
}

async function firmaValida(crudo: string, cabecera: string | null): Promise<boolean> {
  const secreto = Deno.env.get('WA_APP_SECRET')
  if (!secreto) {
    // Falla cerrado. Este endpoint es público: sin secreto, cualquiera podría
    // fabricar mensajes entrantes y hacer que el bot conteste o cree pedidos.
    console.error('WA_APP_SECRET sin configurar: se rechaza todo hasta que exista')
    return false
  }
  if (!cabecera?.startsWith('sha256=')) return false

  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(crudo))
  const esperado = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const recibido = cabecera.slice(7)

  // Comparación de tiempo constante.
  if (recibido.length !== esperado.length) return false
  let dif = 0
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i)
  return dif === 0
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // 1. Meta verifica la URL una vez, con un GET.
  if (req.method === 'GET') {
    const token = url.searchParams.get('hub.verify_token')
    const reto = url.searchParams.get('hub.challenge')
    if (token && token === Deno.env.get('WA_VERIFY_TOKEN')) {
      return new Response(reto ?? '', { status: 200 })
    }
    return new Response('Token de verificación incorrecto', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  const crudo = await req.text()
  if (!(await firmaValida(crudo, req.headers.get('x-hub-signature-256')))) {
    console.error('Firma inválida: se descarta la entrega')
    return new Response('Firma inválida', { status: 401 })
  }

  let cuerpo: any
  try { cuerpo = JSON.parse(crudo) } catch { return ok({ ok: true, ignorado: 'json ilegible' }) }

  const valor = cuerpo?.entry?.[0]?.changes?.[0]?.value
  if (!valor) return ok({ ok: true, ignorado: 'sin cambios' })

  // 2. Acuses de entrega y lectura: el doble check que hasta ahora no se pintaba.
  if (valor.statuses?.length) {
    const db = admin()
    await Promise.all(valor.statuses.map((s: any) => {
      /* Cuando algo no se entrega, Meta dice por qué. Guardarlo es la
         diferencia entre saberlo y reconstruirlo adivinando: sin el código
         de error, un mensaje fallido es sólo la palabra "failed" y horas
         comparando archivos para no concluir nada. */
      const fallo = s.errors?.[0]
      if (fallo) {
        console.error(
          `WhatsApp no entregó ${s.id}: [${fallo.code}] ${fallo.title}` +
          (fallo.error_data?.details ? ` · ${fallo.error_data.details}` : ''),
        )
      }
      return db.from('whatsapp_conversaciones')
        .update({
          delivery_status: s.status,
          error_wa: fallo
            ? { code: fallo.code, title: fallo.title, detalle: fallo.error_data?.details ?? fallo.message ?? null }
            : null,
        })
        .eq('wa_message_id', s.id)
    }))
    return ok({ ok: true, acuses: valor.statuses.length })
  }

  // 3. Mensajes entrantes.
  const mensaje = valor.messages?.[0]
  if (!mensaje) return ok({ ok: true, ignorado: 'sin mensajes' })

  /* `from` no siempre viene: con el despliegue de nombres de usuario de Meta
     puede llegar vacío y el cliente identificarse con un BSUID ("CO.106…")
     en from_user_id. Sin esto la conversación se guarda huérfana y no se le
     puede responder. Se usa || y no ??: Meta manda cadena vacía, no null. */
  const telefono = idDestino(
    mensaje.from
    || valor.contacts?.[0]?.wa_id
    || mensaje.from_user_id          // BSUID: cuentas con nombre de usuario
    || valor.contacts?.[0]?.user_id
    || '',
  )
  const nombre = valor.contacts?.[0]?.profile?.name ?? null
  const texto = mensaje.text?.body
    ?? mensaje.button?.text
    ?? mensaje.interactive?.button_reply?.title
    ?? mensaje.interactive?.list_reply?.title
    ?? mensaje.image?.caption          // "así en plata cuanto" viene como pie de foto
    ?? null

  /* El número NUESTRO al que le escribieron. La app puede tener varios
     colgando del mismo webhook; si se responde siempre por el de la
     variable de entorno, se contesta desde el número equivocado. */
  const numeroPropio = valor.metadata?.phone_number_id ?? null

  /* Nota de voz y foto: llega sólo el id del archivo. Interpretarlo toma más
     de lo que Meta espera, así que aquí no se hace; se hace en segundo plano.

     La foto importa tanto como el texto: los clientes mandan la referencia y
     escriben "así en plata cuánto" señalándola. */
  const idAudio = mensaje.audio?.id ?? null
  const idImagen = mensaje.image?.id ?? null

  /* De qué anuncio viene. Sólo llega en el primer mensaje de quien entró por
     un clic-a-WhatsApp, así que si se descarta se pierde para siempre: es el
     único momento en que Meta lo cuenta.

     Se guarda entero. El esquema completo no está documentado en abierto, y
     quedarse con tres campos elegidos de memoria es perder el resto. */
  const referral = mensaje.referral ?? null
  if (referral) {
    console.log('Llegó por anuncio · referral:', JSON.stringify(referral).slice(0, 500))
  }

  if (!telefono) {
    console.error('Mensaje sin remitente identificable; no se guarda:', JSON.stringify(mensaje).slice(0, 300))
    return ok({ ok: true, ignorado: 'sin remitente' })
  }

  /* El insert es también el candado contra reentregas: wa_message_id tiene
     índice único. Si Meta reintenta —y reintenta cada vez que tardamos—, el
     insert choca y paramos aquí, en vez de contestarle dos veces al cliente. */
  const db = admin()
  const { data: guardado, error: fallo } = await db.from('whatsapp_conversaciones').insert({
    phone_number: telefono,
    role: 'user',
    content: texto ?? `[${mensaje.type}]`,
    message_type: mensaje.type,
    media_url: null,
    wa_message_id: mensaje.id,
    is_read: false,
    wa_phone_id: numeroPropio,
    referral,
  }).select('created_at').single()

  if (fallo) {
    if (fallo.code === '23505') return ok({ ok: true, ignorado: 'reentrega de Meta' })
    console.error('No se pudo guardar el mensaje entrante:', fallo.message)
    return ok({ ok: true, ignorado: 'no se pudo guardar' })
  }

  if (nombre) {
    await db.from('customers')
      .upsert({ name: nombre, phone: telefono }, { onConflict: 'phone', ignoreDuplicates: true })
  }

  /* Un sticker, una ubicación, una encuesta, un video de una sola vista: nada
     que interpretar. Queda en la bandeja para que lo vea una persona — pero
     antes se le contesta algo.

     Dejarlo sólo en la bandeja era la decisión original y tenía sentido, hasta
     que se vio en la práctica: un número escribió cuatro veces en cuatro días,
     las cuatro llegaron así, y las cuatro se quedaron sin respuesta. Desde el
     otro lado eso no se distingue de que el negocio no exista. La bandeja
     avisa a las horas; la clienta está mirando el teléfono ahora. */
  if (!texto && !idAudio && !idImagen) {
    if (!(await enModoManual(telefono))) {
      await avisarQueNoSeAbrio(db, telefono, numeroPropio)
    }
    return ok({ ok: true, guardado: true, sinRespuesta: 'mensaje no interpretable' })
  }

  if (await enModoManual(telefono)) {
    return ok({ ok: true, guardado: true, sinRespuesta: 'la conversación la lleva una persona' })
  }

  /* Acuse de lectura y "escribiendo…" mientras el modelo piensa. Se
     refresca solo, porque el indicador de Meta expira a los 25 segundos y
     un turno con herramientas puede tardar más. */
  const dejarDeEscribir = mantenerEscribiendo(mensaje.id, numeroPropio)

  // 4. Valentina responde en segundo plano; a Meta se le contesta ya.
  const trabajo = (async () => {
    try {
      /* El audio y la foto se interpretan acá y se reescribe la fila, para que
         `responder` lea lo que el cliente quiso decir y no un "[audio]". */
      if (idAudio) {
        const dicho = await transcribir(idAudio)
        if (!dicho && !texto) return             // se queda en la bandeja
        if (dicho) {
          await db.from('whatsapp_conversaciones')
            .update({ content: `🎤 ${dicho}` })
            .eq('wa_message_id', mensaje.id)
        }
      }

      if (idImagen) {
        const { descripcion, ruta } = await verYGuardarImagen(idImagen, telefono)
        if (!descripcion && !ruta && !texto) return   // se queda en la bandeja

        /* La descripción es para que Valentina siga la conversación; la ruta
           es para que el joyero vea la pieza en el panel y pueda cotizarla.
           Se guarda lo que haya salido: si falla una, la otra sirve igual. */
        const parche: Record<string, unknown> = {}
        if (descripcion) {
          /* El pie es lo que el cliente escribió, y la descripción es lo que
             Valentina "vio". */
          parche.content = texto ? `📷 ${descripcion}\n\n"${texto}"` : `📷 ${descripcion}`
        }
        if (ruta) parche.media_url = ruta

        if (Object.keys(parche).length) {
          await db.from('whatsapp_conversaciones')
            .update(parche)
            .eq('wa_message_id', mensaje.id)
        }
      }

      /* Se espera a que el cliente termine de escribir. Si mientras tanto
         llegó otro mensaje suyo, esta invocación se retira: la que atendió al
         último es la que va a responder, con todo el contexto junto. */
      await new Promise((r) => setTimeout(r, ESPERA_A_QUE_TERMINE_MS))

      const { data: masNuevos } = await db.from('whatsapp_conversaciones')
        .select('wa_message_id')
        .eq('phone_number', telefono)
        .eq('role', 'user')
        .gt('created_at', guardado!.created_at)
        .limit(1)

      if (masNuevos?.length) {
        console.log('Siguió escribiendo; responde la siguiente invocación')
        return
      }

      const respuesta = await responder(telefono, numeroPropio)
      if (respuesta) await enviarTextoNatural(telefono, respuesta, 'ia', numeroPropio, mensaje.id)
    } catch (e) {
      console.error('Valentina falló:', e instanceof Error ? e.message : e)
    } finally {
      // Que no quede "escribiendo…" para siempre si algo falla.
      dejarDeEscribir()
    }
  })()

  // @ts-ignore EdgeRuntime existe en el entorno de Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trabajo)
  else await trabajo

  return ok({ ok: true, guardado: true })
})
