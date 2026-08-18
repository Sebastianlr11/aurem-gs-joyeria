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

/** Deja el número como lo maneja Meta: sólo dígitos. */
export const normalizarTelefono = (t: string) => String(t || '').replace(/\D/g, '')

/**
 * Envía un texto y lo guarda en la conversación.
 * `enviadoPor` distingue lo que escribe la IA de lo que escribes tú: es
 * la columna que hasta ahora no existía y que hacía imposible medir nada.
 */
export async function enviarTexto(
  telefono: string,
  texto: string,
  enviadoPor: 'ia' | 'humano',
): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const token = Deno.env.get('WA_TOKEN')
  const phoneId = Deno.env.get('WA_PHONE_NUMBER_ID')
  if (!token || !phoneId) return { ok: false, error: 'Faltan WA_TOKEN o WA_PHONE_NUMBER_ID' }

  const para = normalizarTelefono(telefono)
  const res = await fetch(`${GRAFO}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: para,
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
      enviado_por: enviadoPor, delivery_status: 'failed',
    })
    return { ok: false, error }
  }

  const wamid = cuerpo?.messages?.[0]?.id ?? null
  await admin().from('whatsapp_conversaciones').insert({
    phone_number: para, role: 'assistant', content: texto,
    enviado_por: enviadoPor, delivery_status: 'sent', wa_message_id: wamid,
  })
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
