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
import { resolve } from 'node:path'
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

await writeFile(CASCARON, html.replace(HUECO, `<div id="root">${portada}</div>`))

/* La compilación de servidor no se despliega: es un intermedio del build y en
   `dist/` sólo debe quedar lo que se sirve. */
await rm(resolve(raiz, 'dist-servidor'), { recursive: true, force: true })

const kb = (t) => `${(Buffer.byteLength(t) / 1024).toFixed(1)} KB`
console.log(`Portada prerenderizada: ${kb(portada)} de HTML dentro de #root.`)
console.log(`dist/app.html: el cascarón vacío para las demás rutas (${kb(html)}).`)
