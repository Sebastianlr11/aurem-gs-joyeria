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
import { readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = resolve(import.meta.dirname, '..')
const CASCARON = resolve(raiz, 'dist/index.html')
const COMODIN = resolve(raiz, 'dist/app.html')
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

/* El comodín primero: es una copia literal del cascarón, antes de tocarlo. */
await writeFile(COMODIN, html)

const { pintar } = await import(pathToFileURL(SERVIDOR).href)
const portada = pintar('/')

if (!portada.includes('hero-frame')) {
  throw new Error(
    'La portada se pintó sin el hero. Es el elemento LCP: sin él este paso no ' +
    'sirve para nada, así que mejor tumbar el build que desplegarlo en silencio.'
  )
}

const conPortada = html.replace(HUECO, `<div id="root">${portada}</div>`)

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

await writeFile(CASCARON, conPortada.replace(enlaceHoja[0], `<style>${hoja}</style>`))

/* La compilación de servidor no se despliega: es un intermedio del build y en
   `dist/` sólo debe quedar lo que se sirve. */
await rm(resolve(raiz, 'dist-servidor'), { recursive: true, force: true })

const kb = (t) => `${(Buffer.byteLength(t) / 1024).toFixed(1)} KB`
console.log(`Portada prerenderizada: ${kb(portada)} de HTML dentro de #root.`)
console.log(`Hoja de estilos en línea: ${kb(hoja)}, cero peticiones bloqueando el pintado.`)
console.log(`dist/app.html: el cascarón vacío para las demás rutas (${kb(html)}).`)
