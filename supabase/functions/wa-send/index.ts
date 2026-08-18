/**
 * Envío manual desde el panel. Sustituye al webhook de n8n en
 * http://localhost:5678, que sólo funcionaba si n8n corría en la misma
 * máquina que el navegador.
 *
 * Requiere sesión de admin: el JWT viaja en Authorization y se verifica
 * antes de escribirle a nadie.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { enviarImagen, enviarTexto, idDestino, numeroPropioDe, ventanaAbierta } from '../_shared/wa.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const autorizacion = req.headers.get('Authorization')
  if (!autorizacion) return json({ error: 'Falta la sesión' }, 401)

  const comoUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacion } }, auth: { persistSession: false } },
  )
  const { data: { user }, error } = await comoUsuario.auth.getUser()
  if (error || !user) return json({ error: 'Sesión inválida' }, 401)

  let cuerpo: { telefono?: string; texto?: string; imagenUrl?: string }
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo ilegible' }, 400) }

  const telefono = idDestino(cuerpo.telefono ?? '')
  const texto = String(cuerpo.texto ?? '').trim()
  const imagenUrl = String(cuerpo.imagenUrl ?? '').trim()
  if (!telefono) return json({ error: 'Falta el teléfono' }, 400)
  if (!texto && !imagenUrl) return json({ error: 'El mensaje viene vacío' }, 400)

  /* Meta sólo deja escribir texto libre dentro de las 24 horas siguientes al
     último mensaje del cliente. Fuera de eso lo rechaza, y el error que
     devuelve no dice qué hacer. Se avisa antes de intentarlo, con el motivo
     y la salida. */
  const ventana = await ventanaAbierta(telefono)
  if (!ventana.abierta) {
    return json({
      error: ventana.vence
        ? 'Pasaron más de 24 horas desde el último mensaje de esta persona, así que WhatsApp no deja escribirle texto libre. Sólo se le puede mandar una plantilla aprobada.'
        : 'Esta persona nunca ha escrito, así que no hay ventana abierta. Sólo se le puede mandar una plantilla aprobada.',
      ventanaCerrada: true,
    }, 409)
  }

  // Se responde por el mismo número al que el cliente escribió, no por el
  // de la variable de entorno.
  const desdeId = await numeroPropioDe(telefono)

  const res = imagenUrl
    ? await enviarImagen(telefono, imagenUrl, texto, 'humano', desdeId)
    : await enviarTexto(telefono, texto, 'humano', desdeId)

  return res.ok ? json({ ok: true, wamid: res.wamid }) : json({ error: res.error }, 502)
})
