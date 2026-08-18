/**
 * Notas de voz. Los clientes mandan audios constantemente, y hasta ahora
 * el bot los guardaba como "[audio]" y se callaba.
 *
 * El recorrido: Meta guarda el archivo y sólo da un id → se pide la URL
 * firmada → se descarga con el token → se manda a Voxtral, que sí oye.
 */
import { GRAFO } from './wa.ts'

const MODELO_AUDIO = Deno.env.get('OPENROUTER_AUDIO_MODEL') || 'mistralai/voxtral-small-24b-2507'
const MAX_BYTES = 8 * 1024 * 1024

/** El tipo que declara WhatsApp, en el nombre corto que espera el modelo. */
const formatoDe = (mime: string): string => {
  const limpio = (mime || '').split(';')[0].trim()
  return ({
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/amr': 'amr',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
  } as Record<string, string>)[limpio] ?? 'ogg'
}

/** Base64 por trozos: de una sola vez, un audio largo revienta la pila. */
const aBase64 = (datos: Uint8Array): string => {
  let binario = ''
  const trozo = 0x8000
  for (let i = 0; i < datos.length; i += trozo) {
    binario += String.fromCharCode(...datos.subarray(i, i + trozo))
  }
  return btoa(binario)
}

/** Devuelve lo que dice la nota de voz, o null si no se pudo. */
export async function transcribir(mediaId: string): Promise<string | null> {
  const token = Deno.env.get('WA_TOKEN')
  const clave = Deno.env.get('OPENROUTER_API_KEY')
  if (!token || !clave) {
    console.error('Sin WA_TOKEN u OPENROUTER_API_KEY no se puede transcribir')
    return null
  }

  // 1. Meta sólo entrega un id; la URL hay que pedirla y caduca en minutos.
  const ficha = await fetch(`${GRAFO}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!ficha.ok) {
    console.error('No se pudo pedir la URL del audio:', await ficha.text().then(t => t.slice(0, 200)))
    return null
  }
  const { url, mime_type, file_size } = await ficha.json()
  if (!url) return null

  if (file_size && Number(file_size) > MAX_BYTES) {
    console.error(`Audio de ${file_size} bytes: pasa del tope de ${MAX_BYTES}`)
    return null
  }

  // 2. La descarga también va firmada con el token.
  const archivo = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!archivo.ok) {
    console.error('No se pudo descargar el audio:', archivo.status)
    return null
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  if (bytes.length > MAX_BYTES) {
    console.error(`Audio de ${bytes.length} bytes: pasa del tope`)
    return null
  }

  // 3. A Voxtral, que es el que oye.
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://www.auremgsjoyeria.com',
      'X-Title': 'Aurem Gs · Valentina (audio)',
    },
    body: JSON.stringify({
      model: MODELO_AUDIO,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe esta nota de voz en español de Colombia. Devuelve sólo lo que dice, sin comentarios ni comillas.' },
          { type: 'input_audio', input_audio: { data: aBase64(bytes), format: formatoDe(mime_type) } },
        ],
      }],
      // Mistral exige top_p:1 cuando la temperatura es 0 (muestreo voraz).
      temperature: 0,
      top_p: 1,
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    console.error(`Voxtral ${res.status}:`, (await res.text()).slice(0, 300))
    return null
  }

  const texto = String((await res.json())?.choices?.[0]?.message?.content || '').trim()
  return texto || null
}
