/**
 * Webhook de la Cloud API de Meta.
 * Recibe los mensajes de las clientas y los acuses de entrega, y despierta
 * a Valentina. Sustituye al flujo de n8n.
 *
 * Meta corta a los 20 segundos y reintenta si no ve un 200, así que se
 * responde de inmediato y el trabajo largo sigue en waitUntil.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { admin, enModoManual, enviarTexto, idDestino } from '../_shared/wa.ts'
import { responder } from '../_shared/bot.ts'
import { transcribir } from '../_shared/audio.ts'

const ok = (cuerpo: unknown = { ok: true }) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** Meta firma cada entrega; sin esto cualquiera podría escribirle a tus clientas. */
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
    await Promise.all(valor.statuses.map((s: any) =>
      db.from('whatsapp_conversaciones')
        .update({ delivery_status: s.status })
        .eq('wa_message_id', s.id)
    ))
    return ok({ ok: true, acuses: valor.statuses.length })
  }

  // 3. Mensajes entrantes.
  const mensaje = valor.messages?.[0]
  if (!mensaje) return ok({ ok: true, ignorado: 'sin mensajes' })

  /* `from` no siempre viene: con el despliegue de nombres de usuario de Meta
     puede llegar vacío y la clienta identificarse con un BSUID ("CO.106…")
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
    ?? null

  /* El número NUESTRO al que le escribieron. La app puede tener varios
     colgando del mismo webhook; si se responde siempre por el de la
     variable de entorno, se contesta desde el número equivocado. */
  const numeroPropio = valor.metadata?.phone_number_id ?? null

  /* Nota de voz: llega sólo el id del archivo. Transcribirla toma más de lo
     que Meta espera, así que aquí no se hace; se hace en segundo plano. */
  const idAudio = mensaje.audio?.id ?? null

  if (!telefono) {
    console.error('Mensaje sin remitente identificable; no se guarda:', JSON.stringify(mensaje).slice(0, 300))
    return ok({ ok: true, ignorado: 'sin remitente' })
  }

  /* El insert es también el candado contra reentregas: wa_message_id tiene
     índice único. Si Meta reintenta —y reintenta cada vez que tardamos—, el
     insert choca y paramos aquí, en vez de contestarle dos veces a la clienta. */
  const db = admin()
  const { error: fallo } = await db.from('whatsapp_conversaciones').insert({
    phone_number: telefono,
    role: 'user',
    content: texto ?? `[${mensaje.type}]`,
    message_type: mensaje.type,
    media_url: null,
    wa_message_id: mensaje.id,
    is_read: false,
    wa_phone_id: numeroPropio,
  })

  if (fallo) {
    if (fallo.code === '23505') return ok({ ok: true, ignorado: 'reentrega de Meta' })
    console.error('No se pudo guardar el mensaje entrante:', fallo.message)
    return ok({ ok: true, ignorado: 'no se pudo guardar' })
  }

  if (nombre) {
    await db.from('customers')
      .upsert({ name: nombre, phone: telefono }, { onConflict: 'phone', ignoreDuplicates: true })
  }

  // Sin texto ni audio —una foto, un sticker—, la IA no adivina: lo deja en la
  // bandeja para que lo vea una persona.
  if (!texto && !idAudio) return ok({ ok: true, guardado: true, sinRespuesta: 'mensaje no textual' })

  if (await enModoManual(telefono)) {
    return ok({ ok: true, guardado: true, sinRespuesta: 'la conversación la lleva una persona' })
  }

  // 4. Valentina responde en segundo plano; a Meta se le contesta ya.
  const trabajo = (async () => {
    try {
      /* La nota de voz se transcribe aquí y se reescribe la fila, para que
         `responder` lea lo que dijo la clienta y no un "[audio]". */
      if (!texto) {
        const dicho = await transcribir(idAudio!)
        if (!dicho) return                       // se queda en la bandeja
        await db.from('whatsapp_conversaciones')
          .update({ content: `🎤 ${dicho}` })
          .eq('wa_message_id', mensaje.id)
      }

      const respuesta = await responder(telefono)
      if (respuesta) await enviarTexto(telefono, respuesta, 'ia', numeroPropio)
    } catch (e) {
      console.error('Valentina falló:', e instanceof Error ? e.message : e)
    }
  })()

  // @ts-ignore EdgeRuntime existe en el entorno de Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trabajo)
  else await trabajo

  return ok({ ok: true, guardado: true })
})
