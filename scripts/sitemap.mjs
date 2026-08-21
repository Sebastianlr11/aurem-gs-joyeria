/**
 * Escribe public/sitemap.xml antes de compilar.
 *
 * Las fichas de producto son las páginas que de verdad importan para
 * buscarse, y sus URLs no están en el código: viven en la base. Un sitemap
 * escrito a mano se quedaría con las cinco rutas fijas y dejaría fuera el
 * catálogo entero, que es justo lo que hay que indexar.
 *
 * Nunca tumba la compilación. Si la base no responde —o si faltan las
 * variables de entorno, que es lo normal al compilar en local— escribe sólo
 * las rutas fijas y sigue. Un sitemap corto es un problema de SEO; un
 * despliegue caído porque Supabase tardó en contestar es un problema de
 * verdad.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = 'https://www.auremgsjoyeria.com'
const salida = resolve(dirname(fileURLToPath(import.meta.url)), '../public/sitemap.xml')

/* Sin /admin ni /confirmacion: uno es privado y el otro lleva el número de
   pedido en la URL. Los dos están también en robots.txt. */
const FIJAS = [
  { ruta: '/', cambio: 'weekly', prioridad: '1.0' },
  { ruta: '/catalogo', cambio: 'daily', prioridad: '0.9' },
  { ruta: '/guia-de-tallas', cambio: 'yearly', prioridad: '0.5' },
  { ruta: '/politica-de-devoluciones', cambio: 'yearly', prioridad: '0.3' },
  { ruta: '/politica-de-privacidad', cambio: 'yearly', prioridad: '0.2' },
  { ruta: '/terminos-de-servicio', cambio: 'yearly', prioridad: '0.2' },
]

const hoy = new Date().toISOString().slice(0, 10)

async function piezas() {
  const url = process.env.VITE_SUPABASE_URL
  const clave = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !clave) {
    console.warn('sitemap: sin variables de Supabase, sólo van las rutas fijas')
    return []
  }

  const res = await fetch(
    `${url}/rest/v1/products?select=id,created_at&order=created_at.desc`,
    { headers: { apikey: clave, Authorization: `Bearer ${clave}` } },
  )
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}`)

  const filas = await res.json()
  return filas.map((p) => ({
    ruta: `/catalogo/${p.id}`,
    cambio: 'weekly',
    prioridad: '0.8',
    fecha: (p.created_at || '').slice(0, 10) || hoy,
  }))
}

const entrada = (u) => `  <url>
    <loc>${RAIZ}${u.ruta}</loc>
    <lastmod>${u.fecha || hoy}</lastmod>
    <changefreq>${u.cambio}</changefreq>
    <priority>${u.prioridad}</priority>
  </url>`

let urls = FIJAS
try {
  const p = await piezas()
  urls = [...FIJAS, ...p]
  console.log(`sitemap: ${FIJAS.length} rutas fijas + ${p.length} piezas`)
} catch (e) {
  console.warn('sitemap: no se pudieron leer las piezas —', e.message)
}

mkdirSync(dirname(salida), { recursive: true })
writeFileSync(
  salida,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(entrada).join('\n')}
</urlset>
`,
)
