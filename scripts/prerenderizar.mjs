/**
 * Deja la portada ya pintada dentro del HTML.
 *
 * ── Qué problema resuelve ────────────────────────────────────────────────
 *
 * Medido con Lighthouse móvil sobre producción el 30 de agosto de 2026, con
 * el sitio ya optimizado —fuentes propias, foto del hero precargada, píxeles
 * diferidos, CSS partido en ocho hojas—:
 *
 *     Elemento LCP: la foto del hero
 *       TTFB          680 ms   11 %
 *       Load Delay      0 ms    0 %   ← el preload de index.html va perfecto
 *       Load Time     337 ms    6 %   ← la foto está entera a los ~1,0 s
 *       Render Delay 4936 ms   83 %   ← y ahí se queda, sin pintarse
 *
 * La foto llegaba en el primer segundo y se pintaba dos segundos después: no
 * esperaba a la red, esperaba a que React montara. `#root` estaba vacío, así
 * que hasta que no se bajaba, parseaba y ejecutaba el bundle **no había nada
 * que pintar**. `observedFirstPaint` y `observedLargestContentfulPaint` caían
 * en el mismo milisegundo: la portada aparecía entera, de golpe, tarde.
 *
 * Y no se arregla adelgazando el bundle. Atribuyendo los 275 KB por sourcemap:
 *
 *     176,4 KB  66,2 %  react-dom
 *      37,3 KB  14,0 %  react-router
 *       8,0 KB   3,0 %  react
 *       3,6 KB   1,4 %  scheduler
 *       ~40 KB    ~15 %  TODO el código de la portada
 *
 * El 83 % es el framework. La única salida es que la portada no lo necesite
 * para pintarse: se pinta acá, en el build, y el navegador la recibe hecha.
 *
 * ── Cómo ─────────────────────────────────────────────────────────────────
 *
 * 1. `dist/index.html` —el cascarón que dejó `vite build`— se copia tal cual
 *    a `dist/app.html`. Ése es el que sirve todas las rutas menos `/`.
 * 2. Se pinta `/` con `react-dom/server` y se mete dentro de `#root` en
 *    `dist/index.html`.
 *
 * Los dos archivos son idénticos salvo por eso, incluidas las etiquetas del
 * `<head>` y el adelanto de la pieza para `/catalogo/<uuid>`.
 *
 * ── Por qué DOS archivos y no uno ────────────────────────────────────────
 *
 * Porque `vercel.json` reescribe todas las rutas al mismo HTML. Con la
 * portada metida en `index.html`, quien abre el enlace que Valentina le mandó
 * por WhatsApp y cae en `/catalogo/<uuid>` **vería la portada pintada** antes
 * de que React lo corrigiera: un parpadeo de la pantalla equivocada, justo en
 * la visita que viene a comprar. Por eso la regla comodín apunta a
 * `/app.html`, que sigue viniendo vacío. Vercel mira el sistema de archivos
 * antes que las reescrituras, así que `/` se sirve solo desde `index.html`.
 *
 * ── El riesgo de esto, y cómo se vigila ──────────────────────────────────
 *
 * Que el HTML del build y el primer render del navegador no coincidan. React
 * lo llama desajuste de hidratación y su reacción es tirar lo que había y
 * construir el árbol entero de nuevo — o sea, deshacer exactamente lo que
 * este archivo viene a ganar, y sin que se note en pantalla. Lo que había que
 * arreglar para que coincidan está en `src/lib/whatsapp.js` (`useWaUrl`), en
 * `src/lib/aparecer.js` y en el año del `Footer`. **Cualquier cosa que se
 * pinte a partir de `navigator`, `localStorage`, la fecha o el azar tiene que
 * salir del primer render.**
 */
import { readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = resolve(import.meta.dirname, '..')
const CASCARON = resolve(raiz, 'dist/index.html')
const COMODIN = resolve(raiz, 'dist/app.html')
const CATALOGO = resolve(raiz, 'dist/catalogo.html')
const SERVIDOR = resolve(raiz, 'dist-servidor/entrada-servidor.js')

/* El div vacío que deja `index.html`. Si Vite o el HTML cambian y esto deja
   de aparecer, el script se planta en vez de escribir un archivo a medias. */
const HUECO = '<div id="root"></div>'

const html = await readFile(CASCARON, 'utf8')

if (!html.includes(HUECO)) {
  throw new Error(
    `No encontré ${HUECO} en dist/index.html. Si el contenedor de React cambió, ` +
    'hay que cambiarlo también acá — si no, la portada se despliega sin prerenderizar ' +
    'y nadie se entera.'
  )
}

/* ── El comodín, sin la foto de la portada ───────────────────────────────
 *
 * `app.html` sirve la ficha, el catálogo, la guía de tallas, las legales y el
 * panel. **Ninguna enseña la foto del hero**, y el `<head>` la precargaba en
 * todas con `fetchpriority="high"`: 20 KB a máxima prioridad compitiendo
 * justo con la foto que sí es el LCP de esa pantalla. Venía de cuando había
 * un solo HTML y no se podía distinguir; ahora sí.
 *
 * Se busca por el nombre del archivo y no por la etiqueta entera para que
 * sobreviva a un cambio de anchos o de `sizes`. Si algún día deja de estar,
 * el build se planta: es una precarga que se creía puesta.
 */
const PRECARGA_HERO = /\s*<link rel="preload" as="image"[^>]*pen-hero[^>]*>/

if (!PRECARGA_HERO.test(html)) {
  throw new Error(
    'No encontré la precarga de pen-hero en dist/index.html. O se quitó del <head> ' +
    '—y entonces la portada perdió su adelanto de LCP sin que nadie lo notara— o ' +
    'cambió de forma y esta regla hay que actualizarla.'
  )
}

await writeFile(COMODIN, html.replace(PRECARGA_HERO, ''))

/* ── Y al revés: `index.html` no necesita el adelanto de la pieza ─────────
 *
 * Ese `<script>` sólo hace algo en `/catalogo/<uuid>`; en la portada se sale
 * en la primera línea. Pero son ~1,2 KB comprimidos que la portada se baja
 * igual, dentro del HTML que bloquea su primer pintado, para no usarlos.
 *
 * Con esto cada archivo carga sólo lo suyo: `index.html` la foto del hero y
 * `app.html` el adelanto de la pieza.
 */
const ADELANTO_PIEZA = /\s*<!-- La pieza, preguntada desde aquí[\s\S]*?<\/script>/

if (!ADELANTO_PIEZA.test(html)) {
  throw new Error(
    'No encontré el bloque del adelanto de la pieza en dist/index.html. Si cambió de ' +
    'forma hay que actualizar esta regla; si se quitó, la ficha perdió su adelanto de ' +
    'LCP y eso no se ve en ninguna prueba.'
  )
}

const servidor = await import(pathToFileURL(SERVIDOR).href)
const { pintar } = servidor
const portada = pintar('/')

/* ── Las precargas de fuentes se QUITAN de los HTML prerenderizados ─────────
 *
 * Medido el 7 de septiembre de 2026, en producción y reproducido en local con
 * latencia artificial: con los dos `<link rel="preload" as="font">` en el
 * `<head>`, Chrome (152 en macOS, y el 151 de PageSpeed en Linux) RETIENE EL
 * PRIMER PINTADO de la página entera hasta ~2,4 s, con todo bajado a los
 * 650 ms —las fuentes incluidas, a los 400—. Sin ellas, pinta a los 330 ms.
 * No es `font-display` (con `optional` pasa igual) ni las @font-face (sin
 * ninguna pasa igual): es la precarga en sí. Chrome trata las fuentes
 * precargadas como bloqueantes del renderizado y aquí ese bloqueo no se
 * soltaba a tiempo. Y se llevaba por delante la nota entera: Lighthouse
 * atribuye a ese pintado tardío todo lo que bajó antes —el bundle, la
 * consulta, las fotos— y el FCP simulado salía en 1,5 s para una página que
 * ya venía pintada.
 *
 * En estos dos archivos la precarga no aporta nada que perder: la hoja va en
 * línea, así que las `@font-face` se ven al parsear el `<head>` y las fuentes
 * se piden en ese mismo instante. Lo que cambia es que el texto se pinta
 * primero con la fuente de respaldo y ~100 ms después con la propia (CLS
 * medido: 0). `app.html` las conserva: ahí la hoja cuelga de un `<link>` y sin
 * la precarga las fuentes esperarían a que baje.
 *
 * Se busca por `as="font"` y se exige que haya dos: si `index.html` cambia de
 * forma, esto se planta en vez de dejar el bloqueo puesto en silencio. */
const PRECARGA_FUENTES = /\s*<link rel="preload" as="font"[^>]*>/g
const precargasDeFuentes = (html.match(PRECARGA_FUENTES) || []).length
if (precargasDeFuentes !== 2) {
  throw new Error(
    `Esperaba 2 precargas de fuentes en dist/index.html y hay ${precargasDeFuentes}. Si cambiaron ` +
    'de forma, actualiza PRECARGA_FUENTES; si se quitaron del HTML, app.html se quedó sin ellas.'
  )
}

if (!portada.includes('hero-frame')) {
  throw new Error(
    'La portada se pintó sin el hero. Es el elemento LCP: sin él este paso no ' +
    'sirve para nada, así que mejor tumbar el build que desplegarlo en silencio.'
  )
}

let conPortada = html.replace(HUECO, `<div id="root">${portada}</div>`)

conPortada = conPortada.replace(ADELANTO_PIEZA, '').replace(PRECARGA_FUENTES, '')

/* ── Y la hoja de estilos, adentro ────────────────────────────────────────
 *
 * Sólo en `index.html`. `app.html` se queda con el `<link>`, porque en las
 * demás rutas el HTML no pinta nada por sí mismo y ahí la hoja sí conviene
 * cacheada aparte.
 *
 * Con la portada ya pintada, el CSS pasó a ser **lo único** que quedaba entre
 * el HTML y la primera joya: un viaje de red entero, en serie, que Lighthouse
 * marcó las dos veces —el 30 de agosto de 2026— como «solicitud de bloqueo de
 * renderización, ahorro estimado de 300 ms», etiquetado a la vez para FCP y
 * para LCP. Metida acá, `/` no depende de ninguna petición para pintarse
 * entera.
 *
 * Se mete **la hoja completa y en el sitio exacto donde estaba el `<link>`**,
 * no un "CSS crítico" recortado. Los mismos bytes en el mismo orden es lo
 * único que garantiza que la cascada no cambie — y en este proyecto una regla
 * que cambia de sitio cambia quién gana y no lo ve ninguna prueba. El precio
 * son unos 9 KB comprimidos que la portada ya no cachea entre visitas; el
 * viaje de red que se ahorra vale más.
 */
const enlaceHoja = conPortada.match(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/)

if (!enlaceHoja) {
  throw new Error(
    'No encontré el <link> de la hoja de estilos en dist/index.html. Si Vite cambió ' +
    'cómo la inyecta, hay que cambiarlo acá: sin esto la portada vuelve a esperar un ' +
    'viaje de red para pintarse, y eso no se ve.'
  )
}

const hoja = await readFile(join(resolve(raiz, 'dist'), enlaceHoja[1]), 'utf8')

/* Una `url()` relativa dentro de la hoja se resolvía contra `/assets/`, que es
   donde vivía el archivo; metida en línea se resuelve contra `/`, y apuntaría a
   otro sitio. Hoy las cuatro que hay son absolutas —las fuentes—, y esto se
   asegura de que siga siendo así: un 404 de una fuente no tumba nada, sólo
   cambia la letra de toda la portada. */
const relativas = (hoja.match(/url\(\s*(?!["']?(?:\/|data:|https?:|#))[^)]+\)/g) || [])

if (relativas.length) {
  throw new Error(
    `La hoja trae ${relativas.length} url() relativa(s) —${relativas.slice(0, 3).join(', ')}—. ` +
    'En línea se resuelven contra / y no contra /assets/. Hazlas absolutas antes de seguir.'
  )
}

if (/as="font"/.test(conPortada)) {
  throw new Error('index.html salió con la precarga de fuentes, que retiene el primer pintado')
}

await writeFile(CASCARON, conPortada.replace(enlaceHoja[0], `<style>${hoja}</style>`))

const kb = (t) => `${(Buffer.byteLength(t) / 1024).toFixed(1)} KB`
console.log(`Portada prerenderizada: ${kb(portada)} de HTML dentro de #root.`)
console.log(`Hoja de estilos en línea: ${kb(hoja)}, cero peticiones bloqueando el pintado.`)
console.log(`dist/app.html: el cascarón vacío para las demás rutas (${kb(html)}).`)

/* ══ El catálogo, también pintado ═════════════════════════════════════════
 *
 * Medido con PageSpeed móvil el 6 de septiembre de 2026 sobre `/catalogo`:
 * 93, con LCP 2,8 s y Speed Index 4,2 s. El LCP es la foto de la primera
 * tarjeta, y el navegador no sabía que existía hasta desenredar esto:
 *
 *     app.html 206 ms → index.js 317 ms → consulta a Supabase 921 ms
 *       → chunk del catálogo → React pinta el <img> → recién ahí baja la foto
 *
 * Es el mismo problema que tenía la portada, y se resuelve igual: la rejilla
 * viene pintada en el HTML, la hoja de estilos adentro, y la foto de la
 * primera tarjeta precargada desde el <head>. Con una diferencia que la
 * portada no tiene: el catálogo son DATOS, y cambian sin que haya build.
 *
 * Cómo se lleva eso:
 *   - La lista se trae acá, en el build, con la misma consulta que hace el
 *     navegador (`CONSULTA` de piezasPublicadas.js), y se siembra antes de
 *     pintar (`sembrar`).
 *   - La misma lista va dentro del HTML como `window.__catalogo`, para que el
 *     primer render del navegador sea IDÉNTICO al del build. Si no lo fuera,
 *     React tiraría la rejilla ya pintada y la construiría de nuevo.
 *   - Y en cuanto React monta, `useCatalogoPublico` vuelve a preguntar y
 *     reemplaza la lista por la viva. Lo que se pintó en el build es el primer
 *     frame, nunca la verdad.
 *   - Aparte, guardar una pieza en el panel dispara un build nuevo
 *     (`20260907_el_catalogo_se_vuelve_a_pintar_solo.sql`), para que ese
 *     primer frame también esté al día.
 *
 * Si la consulta falla —sin variables, sin red, Supabase caído— NO se tumba
 * el build: `catalogo.html` sale igual que `app.html` y el catálogo carga como
 * cargaba hasta hoy. Es la política del sitemap: mejor un catálogo lento que
 * ningún despliegue. Pero se dice a gritos en la consola, porque un catálogo
 * que vuelve a tardar 2,8 s no lo delata ninguna prueba.
 */
const cascaron = html.replace(PRECARGA_HERO, '').replace(ADELANTO_PIEZA, '').replace(PRECARGA_FUENTES, '')

async function pintarCatalogo() {
  const { url, clave } = servidor.SUPABASE
  if (!url || !clave || !url.startsWith('http')) {
    throw new Error('sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el build')
  }

  /* La llave en la URL y sin cabeceras, como en el navegador: es la misma
     lectura pública, y así la consulta es la MISMA cadena de bytes. */
  const res = await fetch(`${url}/rest/v1/products?${servidor.CONSULTA}&apikey=${clave}`)
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}`)
  const piezas = await res.json()
  if (!Array.isArray(piezas) || !piezas.length) {
    throw new Error('el catálogo vino vacío: un catálogo prerenderizado sin piezas es peor que ninguno')
  }

  servidor.sembrar(piezas)
  const rejilla = await servidor.pintarConDatos('/catalogo')

  if (!rejilla.includes('catalogo-grid') || !/class="pieza[\s"]/.test(rejilla)) {
    throw new Error('el catálogo se pintó sin la rejilla o sin tarjetas')
  }

  /* Ver `pintarConDatos` en `src/entrada-servidor.jsx`: si React dejó la
     rejilla como contenido tardío, el HTML trae un `<template>`, un
     `<div hidden id="S:…">` y un `$RC(`. Eso no se despliega. */
  if (/\$RC\(|<template|hidden id="S:/.test(rejilla)) {
    throw new Error('el catálogo salió como contenido tardío (con $RC/<template>): la página no quedó en línea')
  }

  /* ── Las precargas: la foto de las dos primeras tarjetas ───────────────
     Son la fila de arriba en el celular; la primera es el LCP y va con
     prioridad alta, la segunda sin ella —dársela a las dos es no dársela a
     ninguna—. `imagesrcset` e `imagesizes` tienen que ser EXACTAMENTE los del
     <img> de ProductCard, o el navegador precarga un archivo y pinta otro:
     por eso salen de `fotoProducto()` y `TAMANOS_TARJETA`, las mismas
     funciones y no una copia. Sin `href`, por lo mismo que en index.html: un
     navegador que no entienda `imagesrcset` se bajaría uno que el <img> no
     va a usar. */
  const precargas = piezas
    .filter((p) => p.image_url)
    .slice(0, 2)
    .map((p, i) => {
      const foto = servidor.fotoProducto(p.image_url)
      const prioridad = i === 0 ? ' fetchpriority="high"' : ''
      return foto.srcSet
        ? `<link rel="preload" as="image" imagesrcset="${foto.srcSet}" imagesizes="${servidor.TAMANOS_TARJETA}"${prioridad} />`
        : `<link rel="preload" as="image" href="${foto.src}"${prioridad} />`
    })

  /* El chunk del catálogo, avisado desde el HTML. Hoy el navegador no sabe
     que existe hasta ejecutar index.js; así baja en paralelo y la rejilla se
     vuelve interactiva antes. `crossorigin` porque así los pide Vite. */
  const archivos = await readdir(resolve(raiz, 'dist/assets'))
  const chunk = archivos.find((a) => /^Catalog-[\w-]+\.js$/.test(a))
  const hojaDeRuta = archivos.find((a) => /^Catalog-[\w-]+\.css$/.test(a))
  if (!chunk || !hojaDeRuta) throw new Error('no encontré Catalog-*.js o Catalog-*.css en dist/assets')
  const modulo = `<link rel="modulepreload" crossorigin href="/assets/${chunk}" />`

  /* ── Las DOS hojas adentro, en este orden ─────────────────────────────
     `index.css` donde estaba el <link>, y `Catalog.css` justo después. En el
     navegador la hoja de ruta se carga con el chunk, DESPUÉS de index.css, y
     a igual especificidad gana la última: si acá fueran al revés cambiaría
     quién gana y no lo vería ninguna prueba (CLAUDE.md §11). */
  const hojaCatalogo = await readFile(resolve(raiz, 'dist/assets', hojaDeRuta), 'utf8')
  const relativasDeRuta = (hojaCatalogo.match(/url\(\s*(?!["']?(?:\/|data:|https?:|#))[^)]+\)/g) || [])
  if (relativasDeRuta.length) {
    throw new Error(`Catalog.css trae ${relativasDeRuta.length} url() relativa(s): en línea se resuelven contra /.`)
  }

  /* La semilla, ANTES del bundle: los <script type="module"> se difieren y
     este no, así que `window.__catalogo` existe cuando el bundle se evalúa.
     `<` escapado para que ningún nombre de pieza pueda cerrar el <script>. */
  const semilla = `<script>window.__catalogo=${JSON.stringify(piezas).replace(/</g, '\\u003c')}</script>`

  const meta = servidor.META_CATALOGO
  const canonica = `https://www.auremgsjoyeria.com${meta.ruta}`

  let salida = cascaron
    .replace(HUECO, `<div id="root">${rejilla}</div>`)
    .replace(enlaceHoja[0], `${precargas.join('\n    ')}\n    ${modulo}\n    <style>${hoja}</style><style>${hojaCatalogo}</style>`)
    .replace('<script type="module"', `${semilla}\n    <script type="module"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${meta.titulo}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${meta.descripcion}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonica}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonica}" />`)

  for (const [nombre, marca] of [['la rejilla', 'catalogo-grid'], ['la semilla', 'window.__catalogo='], ['el modulepreload', 'modulepreload'], ['el título', meta.titulo]]) {
    if (!salida.includes(marca)) throw new Error(`catalogo.html salió sin ${nombre}`)
  }
  if (/as="font"/.test(salida)) throw new Error('catalogo.html salió con la precarga de fuentes, que retiene el primer pintado')

  await writeFile(CATALOGO, salida)
  console.log(
    `dist/catalogo.html: ${piezas.length} piezas sembradas, ${kb(rejilla)} de rejilla, ` +
    `${precargas.length} foto(s) precargada(s), hojas en línea ${kb(hoja)} + ${kb(hojaCatalogo)}.`
  )
}

try {
  await pintarCatalogo()
} catch (e) {
  await writeFile(CATALOGO, cascaron)
  console.warn(
    `\n⚠️  EL CATÁLOGO NO SE PUDO PRERENDERIZAR: ${e instanceof Error ? e.message : e}\n` +
    '   dist/catalogo.html sale como el cascarón vacío. El sitio funciona, pero /catalogo ' +
    'vuelve a tardar lo que tardaba antes del 7 de septiembre de 2026 (LCP ~2,8 s).\n'
  )
}

/* La compilación de servidor no se despliega: es un intermedio del build y en
   `dist/` sólo debe quedar lo que se sirve. */
await rm(resolve(raiz, 'dist-servidor'), { recursive: true, force: true })
