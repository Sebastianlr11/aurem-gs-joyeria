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
import { enviarTexto, normalizarTelefono } from '../_shared/wa.ts'

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

  let cuerpo: { telefono?: string; texto?: string }
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo ilegible' }, 400) }

  const telefono = normalizarTelefono(cuerpo.telefono ?? '')
  const texto = String(cuerpo.texto ?? '').trim()
  if (!telefono) return json({ error: 'Falta el teléfono' }, 400)
  if (!texto) return json({ error: 'El mensaje viene vacío' }, 400)

  const res = await enviarTexto(telefono, texto, 'humano')
  return res.ok ? json({ ok: true, wamid: res.wamid }) : json({ error: res.error }, 502)
})
