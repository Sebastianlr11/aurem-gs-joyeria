/**
 * Cloud API de Meta. Todo lo que sale hacia WhatsApp pasa por aquí, para
 * que el id del mensaje (wamid) se guarde siempre y los acuses de entrega
 * tengan con qué casarse.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const GRAFO = 'https://graph.facebook.com/v21.0'

/**
 * El código de idioma de las plantillas, tal como quedaron aprobadas.
 *
 * Tiene que coincidir EXACTO: una plantilla aprobada en español Colombia es
 * `es_CO`, y pedirla como `es` devuelve "la plantilla no existe en esa
 * traducción". Si algún día se aprueban en otro idioma, se cambia acá.
 */
export const IDIOMA_PLANTILLAS = 'es_CO'

export const admin = (): SupabaseClient => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

/**
 * Cómo se identifica un cliente. Puede ser un teléfono o, desde el
 * despliegue de nombres de usuario de Meta, un BSUID como "CO.1062192…".
 * Al teléfono se le quitan separadores; al BSUID NO se le toca nada,
 * porque el prefijo forma parte del identificador.
 */
export const idDestino = (v: string): string => {
  const limpio = String(v || '').trim()
  if (!limpio) return ''
  return /^\+?[\d\s()-]+$/.test(limpio) ? limpio.replace(/\D/g, '') : limpio
}

/** Se mantiene el nombre viejo como alias, para no romper llamadas. */
export const normalizarTelefono = idDestino

/**
 * Cómo nombrar al destinatario en el cuerpo de la petición.
 *
 * Meta NO acepta un BSUID en `to`: ese campo espera un teléfono, y responde
 * (#131009) Parameter value is not valid. El BSUID va en `recipient`, y
 * entonces `to` se omite. Si se mandan los dos, `to` tiene precedencia.
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/
 */
const paraQuien = (destino: string): Record<string, string> =>
  /^\d+$/.test(destino) ? { to: destino } : { recipient: destino }

/**
 * ¿Por cuál de NUESTROS números va esta conversación? Se mira el último
 * mensaje que lo dejó anotado. Sin esto, el panel responde por el número
 * por defecto aunque el cliente haya escrito a otro.
 */
export async function numeroPropioDe(telefono: string): Promise<string | null> {
  const { data } = await admin()
    .from('whatsapp_conversaciones')
    .select('wa_phone_id')
    .eq('phone_number', telefono)
    .not('wa_phone_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.wa_phone_id ?? null
}

/**
 * Envía un texto y lo guarda en la conversación.
 * `enviadoPor` distingue lo que escribe la IA de lo que escribes tú: es
 * la columna que hasta ahora no existía y que hacía imposible medir nada.
 * `desdeId` es el número propio por el que sale; si no se pasa, el de
 * siempre. Responder por el número equivocado es lo que hacía que le
 * escribieras al real y contestara el de prueba.
 */
export async function enviarTexto(
  telefono: string,
  texto: string,
  enviadoPor: 'ia' | 'humano',
  desdeId?: string | null,
): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const token = Deno.env.get('WA_TOKEN')
  const phoneId = desdeId || Deno.env.get('WA_PHONE_NUMBER_ID')
  if (!token || !phoneId) return { ok: false, error: 'Faltan WA_TOKEN o WA_PHONE_NUMBER_ID' }

  const para = idDestino(telefono)
  const res = await fetch(`${GRAFO}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...paraQuien(para),
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })

  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = cuerpo?.error?.message || `HTTP ${res.status}`
    console.error('Meta rechazó el envío:', error)
    // Se guarda igual, marcado como fallido, para que no desaparezca del hilo.
    await admin().from('whatsapp_conversaciones').insert({
      phone_number: para, role: 'assistant', content: texto,
      enviado_por: enviadoPor, delivery_status: 'failed', wa_phone_id: phoneId,
    })
    return { ok: false, error }
  }

  const wamid = cuerpo?.messages?.[0]?.id ?? null
  await admin().from('whatsapp_conversaciones').insert({
    phone_number: para, role: 'assistant', content: texto,
    enviado_por: enviadoPor, delivery_status: 'sent', wa_message_id: wamid,
    wa_phone_id: phoneId,
  })
  return { ok: true, wamid }
}

/**
 * WhatsApp NO acepta WebP para fotos.
 *
 * La Cloud API sólo entrega image/jpeg y image/png; el WebP lo reserva para
 * stickers. Y falla de la peor manera: acepta la petición con un 200 y un
 * identificador de mensaje, y recién después no entrega. Desde nuestro lado
 * todo parece bien, así que Valentina le dice al cliente "ya te la mostré" y
 * el cliente no ve nada.
 *
 * Pasó de verdad el 21 de agosto de 2026, al optimizar el catálogo a WebP.
 *
 * Cada foto del catálogo tiene su gemela en JPEG con el mismo nombre —el
 * sitio usa la WebP porque pesa una fracción, y acá se pide la otra—.
 */
const paraWhatsApp = (url: string): string =>
  url.endsWith('.webp') ? url.slice(0, -5) + '.jpeg' : url

/** Manda una foto del catálogo con su pie, como hacía el flujo de n8n. */
export async function enviarImagen(
  telefono: string,
  urlImagen: string,
  pie: string,
  enviadoPor: 'ia' | 'humano',
  desdeId?: string | null,
): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const token = Deno.env.get('WA_TOKEN')
  const phoneId = desdeId || Deno.env.get('WA_PHONE_NUMBER_ID')
  if (!token || !phoneId) return { ok: false, error: 'Faltan WA_TOKEN o WA_PHONE_NUMBER_ID' }

  const url = paraWhatsApp(urlImagen)

  /* Si la gemela no está, es mejor saberlo ahora que dejar que Meta acepte y
     no entregue: así la herramienta le puede decir a Valentina que no salió,
     en vez de que le asegure al cliente que sí. */
  if (url !== urlImagen) {
    const existe = await fetch(url, { method: 'HEAD' }).then((r) => r.ok).catch(() => false)
    if (!existe) {
      console.error('No existe la versión JPEG de la foto, WhatsApp no acepta WebP:', urlImagen)
      return { ok: false, error: 'La foto no está en un formato que WhatsApp acepte' }
    }
  }

  const para = idDestino(telefono)
  const res = await fetch(`${GRAFO}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...paraQuien(para),
      type: 'image',
      image: { link: url, caption: pie || undefined },
    }),
  })

  const cuerpo = await res.json().catch(() => ({}))
  const fila = {
    phone_number: para, role: 'assistant', content: pie,
    message_type: 'image', media_url: urlImagen, enviado_por: enviadoPor,
    wa_phone_id: phoneId,
  }

  if (!res.ok) {
    const error = cuerpo?.error?.message || `HTTP ${res.status}`
    console.error('Meta rechazó la imagen:', error)
    await admin().from('whatsapp_conversaciones').insert({ ...fila, delivery_status: 'failed' })
    return { ok: false, error }
  }

  const wamid = cuerpo?.messages?.[0]?.id ?? null
  await admin().from('whatsapp_conversaciones')
    .insert({ ...fila, delivery_status: 'sent', wa_message_id: wamid })
  return { ok: true, wamid }
}

/**
 * Acusa recibo y muestra "escribiendo…" en el chat del cliente.
 *
 * Va en una sola petición junto con el acuse de lectura, y el indicador se
 * apaga solo al responder o a los 25 segundos.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators/
 */
export async function acusarYEscribir(mensajeId: string, desdeId?: string | null): Promise<void> {
  const token = Deno.env.get('WA_TOKEN')
  const phoneId = desdeId || Deno.env.get('WA_PHONE_NUMBER_ID')
  if (!token || !phoneId || !mensajeId) return

  try {
    await fetch(`${GRAFO}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: mensajeId,
        typing_indicator: { type: 'text' },
      }),
    })
  } catch (e) {
    // Es cosmético: si falla, la respuesta igual tiene que salir.
    console.error('No se pudo acusar recibo:', e instanceof Error ? e.message : e)
  }
}

/**
 * Mantiene el "escribiendo…" encendido mientras el modelo piensa.
 *
 * El indicador de Meta se apaga solo a los 25 segundos, y un turno con
 * herramientas puede tardar más. Sin esto, el cliente ve "escribiendo",
 * después nada durante un minuto, y de golpe un mensaje: peor que no
 * mostrar nada. Se refresca antes de que expire.
 *
 * Devuelve la función para apagarlo.
 */
export function mantenerEscribiendo(mensajeId: string, desdeId?: string | null): () => void {
  let vivo = true

  ;(async () => {
    while (vivo) {
      await acusarYEscribir(mensajeId, desdeId)
      await new Promise((r) => setTimeout(r, 20_000))
    }
  })()

  return () => { vivo = false }
}

/** Cuántos mensajes seguidos como máximo. Más de tres se lee como spam. */
const MAX_TROZOS = 3

/**
 * Manda la respuesta como la mandaría una persona: en dos o tres mensajes
 * cortos, con una pausa entre uno y otro, en vez de un párrafo perfecto de
 * golpe. El modelo separa los trozos con una línea en blanco.
 */
export async function enviarTextoNatural(
  telefono: string,
  texto: string,
  enviadoPor: 'ia' | 'humano',
  desdeId?: string | null,
  mensajeIdEntrante?: string | null,
): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const trozos = texto.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)

  // Lo que pase del tope se pega al último trozo, para no perder texto.
  if (trozos.length > MAX_TROZOS) {
    trozos.splice(MAX_TROZOS - 1, trozos.length, trozos.slice(MAX_TROZOS - 1).join('\n\n'))
  }
  if (!trozos.length) return { ok: false, error: 'Respuesta vacía' }

  let ultimo: { ok: boolean; wamid?: string; error?: string } = { ok: false }

  for (let i = 0; i < trozos.length; i++) {
    if (i > 0) {
      /* Entre un mensaje y el siguiente vuelve a aparecer "escribiendo…",
         que es lo que hace una persona: manda, sigue tecleando, manda. */
      if (mensajeIdEntrante) await acusarYEscribir(mensajeIdEntrante, desdeId)
      const pausa = Math.min(900 + trozos[i].length * 22, 3500)
      await new Promise((r) => setTimeout(r, pausa))
    }
    ultimo = await enviarTexto(telefono, trozos[i], enviadoPor, desdeId)
    // Si Meta rechazó uno, no tiene sentido seguir mandando los que faltan.
    if (!ultimo.ok) return ultimo
  }

  return ultimo
}

/**
 * ¿Se le puede escribir texto libre a este cliente ahora mismo?
 *
 * Meta abre una "ventana de atención" de 24 horas con cada mensaje que
 * manda el cliente. Dentro de ella se le puede escribir cualquier cosa y no
 * se cobra. Fuera, el texto libre lo rechaza —error 131047— y sólo entran
 * plantillas aprobadas de antemano.
 *
 * No hace falta guardar nada: la ventana es el último mensaje entrante.
 */
export async function ventanaAbierta(
  telefono: string,
): Promise<{ abierta: boolean; vence: Date | null; minutosRestantes: number }> {
  const { data } = await admin()
    .from('whatsapp_conversaciones')
    .select('created_at')
    .eq('phone_number', telefono)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.created_at) return { abierta: false, vence: null, minutosRestantes: 0 }

  const vence = new Date(new Date(data.created_at).getTime() + 24 * 60 * 60 * 1000)
  const restan = Math.round((vence.getTime() - Date.now()) / 60000)
  return { abierta: restan > 0, vence, minutosRestantes: Math.max(0, restan) }
}

/**
 * Manda una plantilla aprobada. Es la única forma de escribirle a alguien
 * cuando la ventana de 24 horas ya se cerró.
 *
 * Las variables van en orden: la primera reemplaza a {{1}}, y así. La
 * plantilla tiene que existir y estar aprobada en Meta con ese nombre y ese
 * idioma exactos, o el envío se rechaza. El idioma sale de
 * IDIOMA_PLANTILLAS y no hay que pasarlo salvo excepción.
 */
export async function enviarPlantilla(
  telefono: string,
  plantilla: string,
  variables: string[] = [],
  desdeId?: string | null,
  idioma = IDIOMA_PLANTILLAS,
  /* Si se anota en el hilo de conversaciones. Por defecto sí, porque casi
     siempre le escribimos a un cliente y el panel tiene que enseñarlo.

     Los avisos internos son la excepción: van a los celulares del equipo, y
     anotarlos abriría una conversación falsa en la bandeja por cada aviso —
     el joyero apareciendo como cliente suyo, y el inbox de atención lleno de
     ruido justo el día que más clientes escriben. */
  registrar = true,
): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const token = Deno.env.get('WA_TOKEN')
  const phoneId = desdeId || Deno.env.get('WA_PHONE_NUMBER_ID')
  if (!token || !phoneId) return { ok: false, error: 'Faltan WA_TOKEN o WA_PHONE_NUMBER_ID' }

  const para = idDestino(telefono)

  const componentes = variables.length
    ? [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: String(v) })) }]
    : []

  const res = await fetch(`${GRAFO}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...paraQuien(para),
      type: 'template',
      template: {
        name: plantilla,
        language: { code: idioma },
        ...(componentes.length ? { components: componentes } : {}),
      },
    }),
  })

  const cuerpo = await res.json().catch(() => ({}))

  /* En el hilo se guarda el nombre de la plantilla y sus variables, no el
     texto final: el texto vive en Meta y puede cambiar al reaprobarse. Así
     el panel muestra qué se mandó sin inventar el contenido. */
  const resumen = `[plantilla: ${plantilla}]` + (variables.length ? ` ${variables.join(' · ')}` : '')

  if (!res.ok) {
    const error = cuerpo?.error?.message || `HTTP ${res.status}`
    console.error(`Meta rechazó la plantilla ${plantilla}:`, error)
    if (registrar) {
      await admin().from('whatsapp_conversaciones').insert({
        phone_number: para, role: 'assistant', content: resumen,
        enviado_por: 'ia', delivery_status: 'failed', wa_phone_id: phoneId,
      })
    }
    return { ok: false, error }
  }

  const wamid = cuerpo?.messages?.[0]?.id ?? null
  if (registrar) {
    await admin().from('whatsapp_conversaciones').insert({
      phone_number: para, role: 'assistant', content: resumen,
      enviado_por: 'ia', delivery_status: 'sent', wa_message_id: wamid,
      wa_phone_id: phoneId,
    })
  }
  return { ok: true, wamid }
}

/** ¿Está esta conversación en manos de una persona? Entonces la IA calla. */
export async function enModoManual(telefono: string): Promise<boolean> {
  const { data } = await admin()
    .from('chat_takeover')
    .select('is_active')
    .eq('phone_number', telefono)
    .eq('is_active', true)
    .maybeSingle()
  return !!data
}
