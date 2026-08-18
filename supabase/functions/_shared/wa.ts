/**
 * Cloud API de Meta. Todo lo que sale hacia WhatsApp pasa por aquí, para
 * que el id del mensaje (wamid) se guarde siempre y los acuses de entrega
 * tengan con qué casarse.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const GRAFO = 'https://graph.facebook.com/v21.0'

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

  const para = idDestino(telefono)
  const res = await fetch(`${GRAFO}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...paraQuien(para),
      type: 'image',
      image: { link: urlImagen, caption: pie || undefined },
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
