/**
 * El borrador del nombre y la descripción de una pieza, mirándole la foto.
 *
 * Del 30 de agosto de 2026. El catálogo se reescribió entero ese día con una
 * fórmula —nombre de 33 caracteres, descripción de dos frases y 180, el metal
 * fuera del nombre— y funcionó; lo que no escala es acordarse de la fórmula a
 * las once de la noche subiendo la pieza número 32. Esto la aplica por ti.
 *
 * **Devuelve un borrador, no guarda nada.** El panel rellena los dos campos y
 * quien sube la pieza corrige y guarda. Esa distinción es todo el diseño: el
 * modelo propone, el joyero decide, y los guardarraíles del formulario —la
 * cuenta de caracteres, el choque de nombres— siguen ahí como red.
 *
 * ── Los frenos ──────────────────────────────────────────────────────────────
 *
 *   · Pide sesión de admin. Cada llamada gasta modelo, y dejarla abierta es
 *     regalar la llave de OpenRouter a quien pase por la URL.
 *   · **Sin metal escrito no redacta.** El metal y la piedra son datos del
 *     taller: un modelo de visión dice «oro 18k» de una plata bañada sin
 *     pestañear, y eso acabaría en la ficha, en el dato estructurado que lee
 *     Google y en boca de Valentina. Se le entregan ya escritos y se le
 *     prohíbe ampliarlos; lo suyo es la forma, no los hechos.
 *   · Las fotos tienen que ser del bucket público del catálogo. Una URL
 *     cualquiera convertiría esto en un lector de imágenes ajenas pagado con
 *     la llave de la casa.
 *   · Nunca lanza hacia arriba: un fallo del modelo no puede tumbar el
 *     formulario a mitad de una pieza.
 *
 * La lógica que se puede probar sin Deno vive en `_shared/redaccion.ts`, con
 * sus pruebas al lado. Aquí sólo queda la sesión, la llamada y los frenos.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  instrucciones,
  leerRespuesta,
  queFaltaParaRedactar,
  revisarBorrador,
} from '../_shared/redaccion.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MODELO = Deno.env.get('OPENROUTER_VISION_MODEL') ||
  Deno.env.get('OPENROUTER_MODEL') ||
  'openai/gpt-5.6-luna-pro'

/* Tres bastan y sobran: son tres ángulos de la misma pieza, y cada foto que se
   manda es dinero y segundos de espera con el formulario abierto. */
const MAX_FOTOS = 3

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
  const { data: { user }, error: errorSesion } = await comoUsuario.auth.getUser()
  if (errorSesion || !user) return json({ error: 'Sesión inválida' }, 401)

  let cuerpo: {
    fotos?: string[]
    categoria?: string
    metal?: string
    piedra?: string
    precio?: number
    talla_rango?: string
    notas?: string
    id?: string
  }
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo ilegible' }, 400) }

  /* Sólo fotos del catálogo. La comprobación es contra la URL del propio
     proyecto, no contra una lista: cualquier otra cosa es una imagen de fuera
     y el modelo la leería igual, pagando nosotros. */
  const raiz = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/product-images/`
  const fotos = (Array.isArray(cuerpo.fotos) ? cuerpo.fotos : [])
    .filter((u) => typeof u === 'string' && u.startsWith(raiz))
    .slice(0, MAX_FOTOS)

  const falta = queFaltaParaRedactar(cuerpo, fotos)
  if (falta) return json({ error: falta }, 400)

  /* Los nombres que ya están, para que no proponga uno que se confunda. Se
     leen con la sesión de quien pide: si no es del equipo, RLS no le da nada
     y el modelo redacta sin la lista, que es peor pero no filtra. */
  const { data: piezas } = await comoUsuario.from('products').select('id, name')
  const ocupados = (piezas ?? [])
    .filter((p) => p.id !== cuerpo.id)
    .map((p) => String(p.name || ''))
    .filter(Boolean)

  const clave = Deno.env.get('OPENROUTER_API_KEY')
  if (!clave) {
    console.error('Falta OPENROUTER_API_KEY')
    return json({ error: 'El redactor no está configurado' }, 500)
  }

  const t0 = Date.now()
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.auremgsjoyeria.com',
        'X-Title': 'Aurem Gs · redactar pieza',
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: instrucciones(cuerpo, ocupados) },
            ...fotos.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        }],
        /* Temperatura baja pero no cero: con cero, dos piezas parecidas salen
           con el mismo nombre, y dos nombres iguales dejan a Valentina sin
           poder mandar ninguna de las dos fotos. */
        temperature: 0.4,
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      console.error(`redactar-pieza ${res.status}:`, (await res.text()).slice(0, 300))
      return json({ error: 'El modelo no contestó. Intenta de nuevo.' }, 502)
    }

    const texto = String((await res.json())?.choices?.[0]?.message?.content || '')
    const leido = leerRespuesta(texto)
    if (!leido) {
      console.error('redactar-pieza: respuesta ilegible —', texto.slice(0, 200))
      return json({ error: 'El modelo contestó algo que no se pudo leer. Intenta de nuevo.' }, 502)
    }

    const { borrador, avisos } = revisarBorrador(leido, ocupados)
    console.log(`redactar-pieza · ${Date.now() - t0} ms · ${fotos.length} foto(s) · ${avisos.length} aviso(s)`)
    return json({ ...borrador, avisos })
  } catch (e) {
    console.error('redactar-pieza:', (e as Error).message)
    return json({ error: 'No se pudo redactar. Intenta de nuevo.' }, 502)
  }
})
