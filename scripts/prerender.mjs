/**
 * Escribe un HTML por pieza, con su propio título, su foto y su precio.
 *
 * Por qué hace falta: esto es una aplicación de una sola página, así que las
 * etiquetas del <head> se ponen con JavaScript después de cargar. Google lo
 * tolera —ejecuta JS antes de indexar—, pero **los rastreadores de WhatsApp,
 * Facebook, Instagram y TikTok no ejecutan JavaScript**. Leen el HTML crudo
 * y se van.
 *
 * Resultado hasta ahora: compartir por WhatsApp el enlace de un anillo de
 * cuatro millones y medio mostraba el título de la home y una foto genérica.
 * Nunca la pieza, nunca el precio. Y compartir por WhatsApp es el canal por
 * el que vende esta joyería.
 *
 * Se prerenderiza en vez de resolverlo con una función en el servidor porque
 * así no hay nada que pueda fallar en caliente: son archivos estáticos, sin
 * coste por visita y sin depender de que la base responda cuando alguien
 * abre el enlace. El precio es que una pieza nueva entra en el siguiente
 * despliegue, no al instante — con el ritmo al que el taller carga piezas,
 * es un cambio que sale a cuenta.
 *
 * Corre después de `vite build`, sobre el dist ya compilado, porque necesita
 * el index.html con los nombres de archivo ya resueltos.
 *
 * Nunca tumba la compilación: si la base no responde, el sitio queda como
 * estaba —una sola página con el head genérico— y se avisa en el log.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = 'https://www.auremgsjoyeria.com'
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const plantilla = resolve(dist, 'index.html')

/** Para que un nombre con comillas o & no rompa el atributo. */
const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

async function piezas() {
  const url = process.env.VITE_SUPABASE_URL
  const clave = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !clave) {
    console.warn('prerender: sin variables de Supabase, no se generan fichas')
    return []
  }
  const res = await fetch(
    `${url}/rest/v1/products?select=id,name,description,price,image_url,images,metal,piedra,category,stock`,
    { headers: { apikey: clave, Authorization: `Bearer ${clave}` } },
  )
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}`)
  return res.json()
}

/**
 * Cambia lo que ya viene en el index.html en vez de añadir etiquetas nuevas:
 * dos og:title en el mismo head y el rastreador se queda con cualquiera de
 * los dos.
 */
function reemplazar(html, cambios) {
  let salida = html
  for (const [patron, nuevo] of cambios) {
    salida = salida.replace(patron, nuevo)
  }
  return salida
}

function fichaHtml(base, p) {
  const foto = (Array.isArray(p.images) && p.images[0]) || p.image_url || `${RAIZ}/assets/pen-hero.jpg`
  const url = `${RAIZ}/catalogo/${p.id}`

  /* El titular de un resultado de búsqueda y el de una tarjeta de WhatsApp.
     El nombre primero porque es lo que se reconoce; la marca al final. */
  const titulo = `${p.name} — ${pesos(p.price)} | Aurem Gs Joyería`

  /* La descripción sale de la ficha real, no de una frase de catálogo. Si el
     joyero no escribió ninguna, se arma con lo que sí se sabe de la pieza. */
  const ficha = [p.metal, p.piedra].filter(Boolean).join(' · ')
  const desc = (p.description || '').trim().replace(/\s+/g, ' ').slice(0, 155)
    || `${p.name} en ${ficha || 'plata 925'}. Estuche incluido y garantía de por vida en el metal. Envío 24 a 48 h en Bogotá.`

  /* Datos estructurados de producto. Es lo que lee Google para mostrar el
     precio en los resultados, y lo que leen los catálogos de Meta y de TikTok
     cuando se conecta la tienda. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: foto,
    description: desc,
    ...(ficha ? { material: ficha } : {}),
    brand: { '@type': 'Brand', name: 'Aurem Gs Joyería' },
    offers: {
      '@type': 'Offer',
      price: String(Math.round(Number(p.price) || 0)),
      priceCurrency: 'COP',
      /* stock null se trata como disponible: el taller trabaja por encargo y
         "agotado" sólo aplica a lo que se marcó como tal. */
      availability: p.stock === 0
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url,
    },
  }

  return reemplazar(base, [
    [/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`],
    [/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(desc)}"`],
    [/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${url}"`],
    [/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(p.name)} — ${esc(pesos(p.price))}"`],
    [/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${esc(desc)}"`],
    [/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${esc(foto)}"`],
    [/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`],
    [/<meta property="og:type" content="[^"]*"/, `<meta property="og:type" content="product"`],
    [/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${esc(p.name)} — ${esc(pesos(p.price))}"`],
    [/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${esc(desc)}"`],
    [/<meta name="twitter:image" content="[^"]*"/, `<meta name="twitter:image" content="${esc(foto)}"`],
    [/<\/head>/, `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`],
  ])
}

/* El catálogo y las páginas fijas: sólo título, descripción y canónica. No
   llevan datos estructurados porque no son un producto ni un artículo. */
const PAGINAS = [
  {
    ruta: '/catalogo',
    titulo: 'Catálogo de joyas con esmeralda colombiana | Aurem Gs',
    desc: 'Anillos y dijes en plata 925 y oro 18k con esmeralda colombiana natural. Cada pieza se fotografía como llega a tus manos. Estuche incluido.',
  },
  {
    ruta: '/guia-de-tallas',
    titulo: 'Cómo medir tu talla de anillo | Aurem Gs Joyería',
    desc: 'Mide tu talla de anillo en casa, con un hilo y una regla. También ajustamos la pieza sin costo si no queda a la primera.',
  },
  {
    ruta: '/politica-de-devoluciones',
    titulo: 'Cambios y devoluciones | Aurem Gs Joyería',
    desc: 'Cómo pedir un cambio o una devolución, en cuánto tiempo y qué cubre la garantía de por vida en el metal.',
  },
]

function paginaHtml(base, p) {
  const url = `${RAIZ}${p.ruta}`
  return reemplazar(base, [
    [/<title>[^<]*<\/title>/, `<title>${esc(p.titulo)}</title>`],
    [/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(p.desc)}"`],
    [/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${url}"`],
    [/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(p.titulo)}"`],
    [/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${esc(p.desc)}"`],
    [/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`],
  ])
}

/* La marca, una sola vez, en la home. Es lo que junta el sitio con las redes
   y con el número de WhatsApp a ojos de Google. */
const organizacion = {
  '@context': 'https://schema.org',
  '@type': 'JewelryStore',
  name: 'Aurem Gs Joyería',
  url: RAIZ,
  image: `${RAIZ}/assets/pen-hero.jpg`,
  description: 'Joyería colombiana en plata 925 y oro 18k con esmeralda natural. Piezas por encargo, estuche incluido y garantía de por vida en el metal.',
  areaServed: { '@type': 'Country', name: 'Colombia' },
  address: { '@type': 'PostalAddress', addressLocality: 'Bogotá', addressCountry: 'CO' },
}

// ── ejecución ────────────────────────────────────────────────────────
if (!existsSync(plantilla)) {
  console.warn('prerender: no hay dist/index.html; ¿se compiló antes?')
  process.exit(0)
}

const base = readFileSync(plantilla, 'utf8')

// La home recibe los datos estructurados del negocio.
writeFileSync(plantilla, base.replace(
  /<\/head>/,
  `  <script type="application/ld+json">${JSON.stringify(organizacion)}</script>\n  </head>`,
))

for (const p of PAGINAS) {
  const destino = resolve(dist, `.${p.ruta}.html`)
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, paginaHtml(base, p))
}
console.log(`prerender: ${PAGINAS.length} páginas fijas`)

try {
  const lista = await piezas()
  for (const p of lista) {
    const destino = resolve(dist, `catalogo/${p.id}.html`)
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, fichaHtml(base, p))
  }
  console.log(`prerender: ${lista.length} fichas de producto`)
} catch (e) {
  console.warn('prerender: no se pudieron leer las piezas —', e.message)
}
