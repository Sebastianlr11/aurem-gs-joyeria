/**
 * El <head> de una pieza, servido ya hecho a los rastreadores sociales.
 *
 * WhatsApp, Facebook, Instagram y Telegram no ejecutan JavaScript: piden la
 * URL, leen el HTML crudo y se van. En una aplicación de una sola página eso
 * significa que compartir el enlace de un anillo de $4.500.000 mostraba el
 * título de la home y una foto genérica. Nunca la pieza, nunca el precio —
 * y compartir por WhatsApp es el canal por el que vende esta joyería.
 *
 * Sólo llegan aquí los rastreadores: el desvío en vercel.json filtra por
 * user-agent y deja fuera a Googlebot a propósito. Google sí ejecuta
 * JavaScript, así que le sirve el head que pone la propia ficha (ver
 * src/lib/meta.js), y así no hay dos versiones de la misma página
 * conviviendo, que es lo que Google llama encubrimiento.
 *
 * Nunca devuelve un error: si la pieza no existe o Supabase no contesta,
 * entrega el head genérico del sitio. Una tarjeta de WhatsApp sosa es un mal
 * menor; un enlace roto en un chat es una venta perdida.
 */

const RAIZ = 'https://www.auremgsjoyeria.com'
/* Horizontal 1200x630, que es lo que esperan WhatsApp, Facebook e Instagram.
   La de antes era vertical y la recortaban por el centro: cada vez que
   alguien compartía el sitio salía una tira de una foto, sin marca ni
   contexto. Se compone desde scripts/og/tarjeta.html. */
const FOTO_POR_DEFECTO = `${RAIZ}/assets/og-compartir.jpg`

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

function pagina({ titulo, descripcion, imagen, url, tipo }) {
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="UTF-8" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:title" content="${esc(titulo)}" />
<meta property="og:description" content="${esc(descripcion)}" />
<meta property="og:image" content="${esc(imagen)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:type" content="${esc(tipo)}" />
<meta property="og:site_name" content="Aurem Gs Joyería" />
<meta property="og:locale" content="es_CO" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(titulo)}" />
<meta name="twitter:description" content="${esc(descripcion)}" />
<meta name="twitter:image" content="${esc(imagen)}" />
</head>
<body>
<h1>${esc(titulo)}</h1>
<p>${esc(descripcion)}</p>
<a href="${esc(url)}">Ver la pieza en Aurem Gs Joyería</a>
</body>
</html>`
}

const GENERICA = {
  titulo: 'Anillos y joyas con esmeralda colombiana | Aurem Gs',
  descripcion: 'Piezas en plata 925 y oro 18k con esmeralda colombiana natural. Estuche y garantía en el metal. Envío 24 a 48 h en Bogotá y 2 a 3 días al resto del país.',
  imagen: FOTO_POR_DEFECTO,
  url: RAIZ,
  tipo: 'website',
}

export default async function handler(req, res) {
  /* Media hora en la caché del borde, y hasta un día sirviendo la copia vieja
     mientras se refresca por detrás. Un precio con media hora de retraso en
     una tarjeta de WhatsApp no le hace daño a nadie; que la tarjeta tarde en
     aparecer, sí. */
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400')

  const id = String(req.query?.id ?? '')
  const url = process.env.VITE_SUPABASE_URL
  const clave = process.env.VITE_SUPABASE_ANON_KEY

  /* Sólo un uuid. Sin esto, cualquiera podría meter texto en la URL y verlo
     reflejado en el título de la tarjeta que se comparte. */
  if (!/^[0-9a-f-]{36}$/i.test(id) || !url || !clave) {
    return res.status(200).send(pagina(GENERICA))
  }

  try {
    const r = await fetch(
      `${url}/rest/v1/products?id=eq.${id}&select=id,name,description,price,image_url,images,metal,piedra&limit=1`,
      { headers: { apikey: clave, Authorization: `Bearer ${clave}` } },
    )
    if (!r.ok) throw new Error(`Supabase ${r.status}`)

    const [p] = await r.json()
    if (!p) return res.status(200).send(pagina(GENERICA))

    const ficha = [p.metal, p.piedra].filter(Boolean).join(' · ')
    return res.status(200).send(pagina({
      titulo: `${p.name} — ${pesos(p.price)} | Aurem Gs Joyería`,
      descripcion: (p.description || '').trim().replace(/\s+/g, ' ').slice(0, 155)
        || `${p.name} en ${ficha || 'plata 925'}. Estuche incluido y garantía de por vida en el metal. Envío 24 a 48 h en Bogotá.`,
      imagen: (Array.isArray(p.images) && p.images[0]) || p.image_url || FOTO_POR_DEFECTO,
      url: `${RAIZ}/catalogo/${p.id}`,
      tipo: 'product',
    }))
  } catch (e) {
    console.error('ficha: no se pudo leer la pieza —', e.message)
    return res.status(200).send(pagina(GENERICA))
  }
}
