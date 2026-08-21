/**
 * Lo que llega que no es texto: notas de voz y fotos.
 *
 * En las conversaciones reales la foto es el idioma principal — la gente
 * manda una imagen y escribe "así en plata cuánto". Sin mirarla no hay
 * conversación posible, y hasta ahora se guardaba como "[image]" y el bot
 * se quedaba callado.
 *
 * El recorrido es el mismo para audio y para imagen: Meta guarda el archivo
 * y sólo da un id → se pide la URL firmada → se descarga con el token → se
 * manda al modelo que corresponda.
 */
import { admin, GRAFO } from './wa.ts'

const MODELO_AUDIO = Deno.env.get('OPENROUTER_AUDIO_MODEL') || 'mistralai/voxtral-small-24b-2507'
const MODELO_VISION = Deno.env.get('OPENROUTER_VISION_MODEL') || Deno.env.get('OPENROUTER_MODEL') || 'openai/gpt-5.6-luna-pro'
const MAX_BYTES = 8 * 1024 * 1024

/** El tipo que declara WhatsApp, en el nombre corto que espera el modelo. */
const formatoDeAudio = (mime: string): string => {
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

/** Base64 por trozos: de una sola vez, un archivo largo revienta la pila. */
const aBase64 = (datos: Uint8Array): string => {
  let binario = ''
  const trozo = 0x8000
  for (let i = 0; i < datos.length; i += trozo) {
    binario += String.fromCharCode(...datos.subarray(i, i + trozo))
  }
  return btoa(binario)
}

/** Pide la URL firmada, descarga, y devuelve los bytes con su tipo. */
async function descargarDeMeta(
  mediaId: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const token = Deno.env.get('WA_TOKEN')
  if (!token) {
    console.error('Sin WA_TOKEN no se puede descargar nada de Meta')
    return null
  }

  // Meta sólo entrega un id; la URL hay que pedirla y caduca en minutos.
  const ficha = await fetch(`${GRAFO}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!ficha.ok) {
    console.error('No se pudo pedir la URL del archivo:', (await ficha.text()).slice(0, 200))
    return null
  }

  const { url, mime_type, file_size } = await ficha.json()
  if (!url) return null

  if (file_size && Number(file_size) > MAX_BYTES) {
    console.error(`Archivo de ${file_size} bytes: pasa del tope de ${MAX_BYTES}`)
    return null
  }

  // La descarga también va firmada con el token.
  const archivo = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!archivo.ok) {
    console.error('No se pudo descargar el archivo:', archivo.status)
    return null
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer())
  if (bytes.length > MAX_BYTES) {
    console.error(`Archivo de ${bytes.length} bytes: pasa del tope`)
    return null
  }

  return { bytes, mime: String(mime_type || '') }
}

/** Llama a OpenRouter y devuelve el texto, o null si algo falló. */
async function pedirAlModelo(modelo: string, contenido: unknown, etiqueta: string): Promise<string | null> {
  const clave = Deno.env.get('OPENROUTER_API_KEY')
  if (!clave) {
    console.error('Falta OPENROUTER_API_KEY')
    return null
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://www.auremgsjoyeria.com',
      'X-Title': `Aurem Gs · Valentina (${etiqueta})`,
    },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: 'user', content: contenido }],
      // Mistral exige top_p:1 cuando la temperatura es 0 (muestreo voraz).
      temperature: 0,
      top_p: 1,
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    console.error(`${etiqueta} ${res.status}:`, (await res.text()).slice(0, 300))
    return null
  }

  const texto = String((await res.json())?.choices?.[0]?.message?.content || '').trim()
  return texto || null
}

/** Devuelve lo que dice la nota de voz, o null si no se pudo. */
export async function transcribir(mediaId: string): Promise<string | null> {
  const t0 = Date.now()
  const archivo = await descargarDeMeta(mediaId)
  if (!archivo) return null

  const dicho = await pedirAlModelo(MODELO_AUDIO, [
    { type: 'text', text: 'Transcribe esta nota de voz en español de Colombia. Devuelve sólo lo que dice, sin comentarios ni comillas.' },
    {
      type: 'input_audio',
      input_audio: { data: aBase64(archivo.bytes), format: formatoDeAudio(archivo.mime) },
    },
  ], 'audio')

  console.log(`transcripción · ${Date.now() - t0} ms · ${dicho ? 'ok' : 'falló'}`)
  return dicho
}

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

/**
 * Guarda la foto del cliente y la describe, descargándola UNA sola vez.
 *
 * Las dos cosas juntas porque el archivo vive en Meta detrás de una URL
 * firmada que caduca en minutos: pedirlo dos veces es pagar dos descargas y
 * arriesgarse a que la segunda llegue tarde.
 *
 * Guardarla importa tanto como describirla. El joyero cotiza mirando la
 * pieza, y hasta ahora en el panel sólo aparecía el párrafo que escribió el
 * modelo — que sirve para que Valentina siga la conversación, pero no para
 * decidir cuánto vale replicar un anillo.
 *
 * Devuelve la ruta dentro del bucket, no una URL: el bucket es privado y
 * quien la pinta la firma en ese momento.
 */
export async function verYGuardarImagen(
  mediaId: string,
  telefono: string,
): Promise<{ descripcion: string | null; ruta: string | null }> {
  const t0 = Date.now()
  const archivo = await descargarDeMeta(mediaId)
  if (!archivo) return { descripcion: null, ruta: null }

  const mime = archivo.mime.split(';')[0].trim() || 'image/jpeg'

  /* La subida y la descripción, en paralelo. Son independientes y la
     descripción se lleva varios segundos; encadenarlas sólo sumaría espera
     al cliente, que está mirando el "escribiendo…". */
  const ruta = `${telefono}/${mediaId}.${EXTENSIONES[mime] ?? 'jpg'}`

  const [subida, descripcion] = await Promise.all([
    admin().storage.from('chat-media').upload(ruta, archivo.bytes, {
      contentType: mime,
      upsert: true,
    }),
    describir(archivo.bytes, mime),
  ])

  if (subida.error) {
    // Sin foto guardada la conversación sigue igual: no se tumba por esto.
    console.error('No se pudo guardar la foto del chat:', subida.error.message)
  }

  console.log(`imagen · ${Date.now() - t0} ms · descrita ${descripcion ? 'ok' : 'no'} · guardada ${subida.error ? 'no' : 'ok'}`)
  return { descripcion, ruta: subida.error ? null : ruta }
}

/**
 * Describe la foto, en términos que le sirvan a Valentina para seguir la
 * conversación.
 *
 * Deliberadamente NO opina sobre quilates, peso ni calidad: eso lo dice el
 * taller con la piedra en la mano, y afirmarlo desde una foto es la forma
 * más rápida de prometer algo que después no se cumple.
 */
async function describir(bytes: Uint8Array, mime: string): Promise<string | null> {
  const visto = await pedirAlModelo(MODELO_VISION, [
    {
      type: 'text',
      text: `Eres los ojos de una asesora de joyería. Describe esta foto en dos o tres frases,
para que ella pueda seguir la conversación sin verla.

Di qué tipo de pieza es (anillo, cadena, dije, aretes), de qué metal parece,
si tiene piedras y de qué color y forma, y cualquier texto, marca o grabado visible.
Si no es una joya —una captura de pantalla, una foto de un dedo, un comprobante
de pago, una medida— dilo claramente y describe qué es.

NO afirmes quilates, peso, ley ni calidad de las piedras: eso no se sabe por una
foto. Si el cliente marcó o señaló algo sobre la imagen, menciónalo, porque
seguramente es de lo que quiere hablar.

Responde en español, sin preámbulos.`,
    },
    {
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${aBase64(bytes)}` },
    },
  ], 'visión')

  return visto
}
