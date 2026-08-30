/**
 * Vuelve a subir las fotos del catálogo para que caduquen en un año.
 *
 * Supabase Storage guarda el `Cache-Control` en los metadatos de cada
 * archivo, en el momento de subirlo, y por defecto pone una hora. Nadie se lo
 * cambió nunca, así que los 344 archivos del bucket dicen `max-age=3600`:
 * quien abre la portada hoy y vuelve mañana se baja las mismas fotos otra
 * vez. Son 110 KiB en la portada, y en la ficha bastante más.
 *
 * Desde el 30 de agosto de 2026, `ProductModal.jsx` sube con un año. Esto es
 * para las que ya estaban.
 *
 * ── Por qué hay que volver a subirlas ────────────────────────────────────
 *
 * Porque no hay forma de cambiar sólo el metadato: la API de Storage no
 * tiene un «actualizar cabeceras», sólo un PUT con el archivo entero. Así
 * que esto se baja cada foto y la vuelve a poner **en la misma ruta**.
 *
 * La ruta es lo único que no se puede tocar. El nombre de una foto de
 * producto es información, no decoración: la marca `-<ancho>x<alto>.webp` es
 * lo que le dice al sitio que existen las copias del `srcset`, y la gemela
 * `.jpeg` de WhatsApp se deriva cambiándole la extensión. Este script nunca
 * renombra ni mueve: mismo nombre, mismos bytes, otra cabecera.
 *
 * ── Cómo se corre ────────────────────────────────────────────────────────
 *
 *   SUPABASE_SERVICE_ROLE_KEY=… node --env-file=.env.local \
 *     scripts/refrescar-cache-fotos.mjs              # sólo mira y cuenta
 *
 *   …misma línea… scripts/refrescar-cache-fotos.mjs --de-verdad   # y escribe
 *
 * Sin `--de-verdad` no escribe nada: dice qué haría. Se corre a mano, una
 * vez; no va en el build, porque baja y vuelve a subir 21 MB y no hay ninguna
 * razón para hacer eso en cada despliegue.
 *
 * Pide la llave de servicio porque subir al bucket exige ser del equipo
 * (`20260823_storage_tambien_pide_ser_del_equipo.sql`) y un script no tiene
 * sesión. La llave no se guarda en ningún archivo: se pasa en la línea y se
 * queda en esa terminal.
 */

const BUCKET = 'product-images'
const UN_ANO = 'max-age=31536000'
const ESCRIBIR = process.argv.includes('--de-verdad')

const URL_BASE = process.env.VITE_SUPABASE_URL
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !LLAVE) {
  console.error(
    'Faltan variables. Hacen falta VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.\n' +
      'La de servicio está en el panel de Supabase → Project Settings → API.'
  )
  process.exit(1)
}

const cabeceras = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}` }

/** Todo lo que hay en el bucket, de cien en cien. */
async function inventario() {
  const todo = []
  for (let desde = 0; ; desde += 100) {
    const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 100, offset: desde }),
    })
    if (!res.ok) throw new Error(`No se pudo listar el bucket: ${res.status}`)
    const pagina = await res.json()
    todo.push(...pagina)
    if (pagina.length < 100) return todo
  }
}

/** Se la baja y la vuelve a poner donde estaba, con la cabecera nueva. */
async function refrescar(objeto) {
  /* Segmento a segmento: el bucket es plano hoy, pero si algún día se
     guardan en carpetas, encodear el nombre entero convertiría la barra en
     %2F y pediría un archivo que no existe. */
  const nombre = objeto.name.split('/').map(encodeURIComponent).join('/')
  const ruta = `${URL_BASE}/storage/v1/object/${BUCKET}/${nombre}`

  const bajada = await fetch(ruta, { headers: cabeceras })
  if (!bajada.ok) throw new Error(`no se pudo bajar (${bajada.status})`)
  const bytes = await bajada.arrayBuffer()

  /* Si lo que baja no pesa lo que decía el inventario, algo se cortó por el
     camino. Antes de sobrescribir el original, mejor parar: una foto a medias
     subida en su misma ruta no se recupera. */
  const esperado = objeto.metadata?.size
  if (esperado && bytes.byteLength !== esperado) {
    throw new Error(`bajó a medias: ${bytes.byteLength} de ${esperado} bytes`)
  }

  /* PUT y no POST: POST es «crear» y falla si ya existe; PUT reemplaza el
     archivo que está en esa ruta, que es exactamente lo que queremos. */
  const subida = await fetch(ruta, {
    method: 'PUT',
    headers: {
      ...cabeceras,
      'Content-Type': objeto.metadata?.mimetype || 'application/octet-stream',
      'Cache-Control': UN_ANO,
    },
    body: bytes,
  })
  if (!subida.ok) throw new Error(`no se pudo subir (${subida.status})`)
}

const objetos = await inventario()
/* `metadata` sólo lo traen los archivos: una carpeta viene con `id: null` y
   sin nada más, y no hay nada que refrescarle. */
const pendientes = objetos.filter((o) => o.metadata && o.metadata.cacheControl !== UN_ANO)
const megas = pendientes.reduce((s, o) => s + (o.metadata?.size || 0), 0) / 1048576

console.log(
  `${objetos.length} archivos en ${BUCKET}; ` +
    `${pendientes.length} con caché corta (${megas.toFixed(1)} MB).`
)

if (!pendientes.length) process.exit(0)

if (!ESCRIBIR) {
  console.log('Ensayo: no se tocó nada. Con --de-verdad se vuelven a subir.')
  process.exit(0)
}

let hechas = 0
const fallaron = []

/* De a cuatro. En serie son 344 viajes de ida y vuelta, y de golpe es pedirle
   a Storage 21 MB a la vez. */
const cola = [...pendientes]
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let siguiente = cola.pop(); siguiente; siguiente = cola.pop()) {
      try {
        await refrescar(siguiente)
        hechas++
        if (hechas % 25 === 0) console.log(`  …${hechas} de ${pendientes.length}`)
      } catch (e) {
        fallaron.push(`${siguiente.name}: ${e.message}`)
      }
    }
  })
)

console.log(`Listas ${hechas} de ${pendientes.length}.`)
if (fallaron.length) {
  console.error(`Se quedaron ${fallaron.length}:`)
  for (const f of fallaron) console.error(`  ${f}`)
  /* Sale con error para que se note: volver a correrlo sólo toca las que
     faltan, porque el inventario ya las distingue por su cabecera. */
  process.exit(1)
}
