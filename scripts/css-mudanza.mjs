/**
 * Mueve a su hoja las reglas de `src/index.css` que son de una sola pantalla.
 *
 * El 30 de agosto de 2026 se partió el CSS en hojas de ruta y el bloqueante
 * bajó de 19,3 a 12,9 KiB comprimidos. Quedó a medias: `css-de-quien-es.mjs`
 * abre cada pantalla y pregunta qué selectores encuentran algo, y **las reglas
 * de los estados no las ve** — el visor de fotos, el modal de compra, el panel
 * de ciudad y la cuenta del abono no existen en el DOM hasta que alguien hace
 * clic. Son 1.582 líneas, el 37% del archivo, que hoy bajan en todas las rutas
 * para no usarse en casi ninguna.
 *
 * ── Cómo decide de quién es una regla ────────────────────────────────────
 *
 * No por el nombre de la clase. Ya se intentó con prefijos y `.joyero` —que es
 * la ficha— acabó clasificada como panel y rompió la ficha.
 *
 * Se decide por **quién nombra la clase en el código**, y qué pantalla carga a
 * ese archivo. Lo segundo se resuelve siguiendo las importaciones desde cada
 * página, no adivinando por la ruta del archivo: `src/components/Foto.jsx` lo
 * usan la ficha y el catálogo, y eso sólo lo sabe el grafo.
 *
 * Un bloque se mueve **sólo si todas sus clases las nombra código de una única
 * pantalla**. Basta que una la comparta con el panel, con la portada o con
 * otra ruta para que se quede donde está.
 *
 * ── Por qué no vale cortar y pegar líneas ────────────────────────────────
 *
 * Porque 129 de esos bloques viven dentro de un `@media`. Sacar sus renglones
 * deja las llaves descuadradas y postcss tumba el build — probado el 30 de
 * agosto de 2026, así fue como se descubrió. Por eso esto parsea de verdad:
 * si de un `@media` se va la mitad, en el destino se escribe un `@media` nuevo
 * con esa mitad y el original se queda con el resto.
 *
 * Los comentarios viajan con su regla. En este proyecto casi cada bloque lleva
 * escrito el incidente que lo motivó; dejarlos huérfanos en `index.css` sería
 * perder justo lo que hace mantenible el archivo.
 *
 * ── Lo que NO comprueba, y hay que comprobar aparte ──────────────────────
 *
 * Que la página siga viéndose igual. Las hojas de ruta se cargan DESPUÉS de
 * `index.css`, así que una regla movida gana a igual especificidad lo que
 * antes perdía. Este script rechaza el caso evidente —un selector que ya
 * existe en el destino— pero el juez es `huella-estilos.mjs`, y para estas
 * reglas hay que correrlo **con estados** (`--estados`), que es lo único que
 * abre el visor y el modal antes de medir.
 *
 *   node scripts/css-mudanza.mjs                 # informe: qué se movería
 *   node scripts/css-mudanza.mjs --de-verdad     # y lo mueve
 *
 * Sin `--de-verdad` no escribe nada.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ORIGEN = 'src/index.css'

/* Cada pantalla, su componente de página y la hoja que ya carga. Si algún día
   una ruta nueva trae su propia hoja, se añade acá y el resto sale solo. */
const PANTALLAS = {
  ficha: { pagina: 'src/pages/ProductPage.jsx', hoja: 'src/pages/ProductPage.css' },
  catalogo: { pagina: 'src/pages/Catalog.jsx', hoja: 'src/pages/Catalog.css' },
  confirmacion: { pagina: 'src/pages/Confirmacion.jsx', hoja: 'src/pages/Confirmacion.css' },
  tallas: { pagina: 'src/pages/RingSizeGuide.jsx', hoja: 'src/pages/RingSizeGuide.css' },
  'no-encontrado': { pagina: 'src/pages/NoEncontrado.jsx', hoja: 'src/pages/NoEncontrado.css' },
}

/* Las que NO tienen hoja propia y por tanto nunca son destino: lo que sea
   suyo se queda en index.css. La portada va aquí porque es la que index.css
   sirve, y el panel porque su hoja es otra historia (panel.css) y sus reglas
   no pueden salir de una hoja que la tienda pública también carga. */
const SIN_HOJA = ['portada', 'panel', 'legales', 'compartido']

/* ─── Un parseador de CSS, sin dependencias ───────────────────────────────
 *
 * No hay ninguna en el proyecto y meter postcss por un script que se corre
 * tres veces al año no vale su superficie. Sólo hace falta la estructura:
 * dónde empieza y acaba cada regla, cuál es su cabecera y qué hay dentro de
 * un @media. No se reescribe el CSS: se guardan los cortes y se emiten
 * rebanadas del original, así que el formato y los comentarios salen intactos.
 */
function parsear(css, desde = 0, hasta = css.length) {
  const nodos = []
  let i = desde
  let inicioTexto = i

  const saltar = () => {
    /* Comentarios y cadenas, que pueden llevar llaves dentro y descuadrarlo
       todo si se cuentan a lo bruto. */
    if (css[i] === '/' && css[i + 1] === '*') {
      const fin = css.indexOf('*/', i + 2)
      i = fin === -1 ? hasta : fin + 2
      return true
    }
    if (css[i] === '"' || css[i] === "'") {
      const comilla = css[i++]
      while (i < hasta && css[i] !== comilla) i += css[i] === '\\' ? 2 : 1
      i++
      return true
    }
    return false
  }

  while (i < hasta) {
    if (saltar()) continue

    if (css[i] === '{') {
      const cabeza = css.slice(inicioTexto, i)
      const abre = i
      let nivel = 1
      i++
      while (i < hasta && nivel > 0) {
        if (saltar()) continue
        if (css[i] === '{') nivel++
        else if (css[i] === '}') nivel--
        i++
      }
      const esAt = cabeza.trimStart().startsWith('@') || /}\s*@|\*\/\s*@/.test(cabeza)
      nodos.push({
        tipo: esAt ? 'at' : 'regla',
        inicio: inicioTexto,
        fin: i,
        cabeza,
        cuerpoDesde: abre + 1,
        cuerpoHasta: i - 1,
      })
      inicioTexto = i
      continue
    }

    if (css[i] === ';' && css.slice(inicioTexto, i).trimStart().startsWith('@')) {
      /* @import, @charset: una sentencia sin bloque. Nunca se mueven. */
      nodos.push({ tipo: 'sentencia', inicio: inicioTexto, fin: i + 1 })
      inicioTexto = i + 1
    }
    i++
  }
  if (inicioTexto < hasta) nodos.push({ tipo: 'cola', inicio: inicioTexto, fin: hasta })
  return nodos
}

/* La cabecera de un nodo arrastra lo que había antes: el `}` de la regla
   anterior y los comentarios que preceden a ésta. Se parte en dos —lo que
   sobra por delante y el selector de verdad— para poder mover el comentario
   con su regla y dejar el `}` donde estaba. */
function partirCabeza(cabeza) {
  /* El último `}` que no esté dentro de un comentario cierra lo anterior. */
  let corte = 0
  for (let j = 0; j < cabeza.length; j++) {
    if (cabeza[j] === '/' && cabeza[j + 1] === '*') {
      const fin = cabeza.indexOf('*/', j + 2)
      j = fin === -1 ? cabeza.length : fin + 1
      continue
    }
    if (cabeza[j] === '}') corte = j + 1
  }
  return { antes: cabeza.slice(0, corte), propio: cabeza.slice(corte) }
}

const clasesDe = (sel) => [...new Set([...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))]

const selectoresDe = (sel) =>
  sel
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

/* ─── Qué archivo pertenece a qué pantalla ────────────────────────────────
 *
 * Siguiendo las importaciones desde cada página. Un archivo al que llegan dos
 * pantallas es compartido y sus reglas no se mueven.
 */
function mapaDeArchivos() {
  const leer = (f) => { try { return fs.readFileSync(f, 'utf8') } catch { return null } }

  const resolver = (desde, spec) => {
    if (!spec.startsWith('.')) return null
    const base = path.join(path.dirname(desde), spec)
    for (const cand of [base, base + '.jsx', base + '.js', base + '.tsx',
                        path.join(base, 'index.jsx'), path.join(base, 'index.js')]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
    }
    return null
  }

  const dueños = new Map()   // archivo -> Set(pantalla)
  const marcar = (archivo, pantalla, visto = new Set()) => {
    if (!archivo || visto.has(archivo)) return
    visto.add(archivo)
    if (!dueños.has(archivo)) dueños.set(archivo, new Set())
    dueños.get(archivo).add(pantalla)
    const src = leer(archivo)
    if (!src) return
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      marcar(resolver(archivo, m[1] || m[2]), pantalla, visto)
    }
  }

  for (const [nombre, { pagina }] of Object.entries(PANTALLAS)) marcar(pagina, nombre)
  marcar('src/pages/Home.jsx', 'portada')
  for (const p of ['PrivacyPolicy', 'TermsOfService', 'ReturnsPolicy']) marcar(`src/pages/${p}.jsx`, 'legales')
  /* El panel entero, que comparte clases con la tienda más de lo que parece. */
  for (const f of execSync('find src/pages/admin src/components -type f \\( -name "*.jsx" -o -name "*.js" \\) 2>/dev/null || true')
    .toString().trim().split('\n').filter(Boolean)) {
    if (f.startsWith('src/pages/admin/')) marcar(f, 'panel')
  }
  /* Lo que no alcanzó ninguna página —el armazón, los ganchos sueltos— cuenta
     como compartido: es lo prudente, porque significa que no sabemos. */
  for (const f of execSync('find src -type f \\( -name "*.jsx" -o -name "*.js" -o -name "*.tsx" \\) | grep -v "\\.test\\."')
    .toString().trim().split('\n').filter(Boolean)) {
    if (!dueños.has(f)) dueños.set(f, new Set(['compartido']))
  }
  return dueños
}

/* ─── El reparto, en dos tiempos ──────────────────────────────────────────
 *
 * Primero se anota qué **querría** moverse, después se vetan los selectores
 * que no pueden, y sólo al final se emite. En la primera versión se emitía a
 * la primera y el veto llegaba tarde: `.catalogo-panel` se fue a Catalog.css
 * y aterrizó DESPUÉS del `@media` que ya lo ajustaba allí, así que la regla
 * base pasó a ganarle al ajuste de escritorio y el panel de filtros se
 * ensanchó de 510 a 1.326 px. Lo cazó `huella-estilos --estados`, que es la
 * única forma de verlo: el panel no existe hasta que alguien hace clic.
 */

const css = fs.readFileSync(ORIGEN, 'utf8')
const dueños = mapaDeArchivos()
const fuentes = [...dueños.keys()].map((f) => [f, fs.readFileSync(f, 'utf8')])

const cache = new Map()
function pantallasDeClase(clase) {
  if (cache.has(clase)) return cache.get(clase)
  const set = new Set()
  /* La clase se busca como palabra: `.abono` no debe casar con `abono-total`,
     que es otra clase y quizá de otra pantalla. */
  const re = new RegExp(`(^|[^\\w-])${clase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`)
  for (const [f, t] of fuentes) if (re.test(t)) for (const p of dueños.get(f)) set.add(p)
  cache.set(clase, set)
  return set
}

/** A qué hoja se iría este selector, o `null` si se queda. */
function destinoDe(selector) {
  const clases = clasesDe(selector)
  if (!clases.length) return null            // selectores de etiqueta: se quedan
  const p = new Set()
  for (const c of clases) for (const x of pantallasDeClase(c)) p.add(x)
  if (p.size !== 1) return null
  const única = [...p][0]
  if (SIN_HOJA.includes(única) || !PANTALLAS[única]) return null
  return única
}

/** Todos los selectores de una hoja, **incluidos los de dentro de un @media**.
 *  Olvidarse de estos últimos fue el fallo del primer intento. */
function selectoresDeHoja(ruta) {
  const texto = fs.readFileSync(ruta, 'utf8')
  const set = new Set()
  const recorrer = (desde, hasta) => {
    for (const n of parsear(texto, desde, hasta)) {
      if (n.tipo === 'regla') for (const s of selectoresDe(partirCabeza(n.cabeza).propio)) set.add(s)
      else if (n.tipo === 'at') recorrer(n.cuerpoDesde, n.cuerpoHasta)
    }
  }
  recorrer(0, texto.length)
  return set
}

/* Primer tiempo: el censo. Cada regla, con su destino deseado y sus
   selectores. `dentro` dice si vive en un @media, sólo para el informe. */
const censo = []
const nodos = parsear(css)
for (const nodo of nodos) {
  if (nodo.tipo === 'regla') {
    const propio = partirCabeza(nodo.cabeza).propio
    censo.push({ inicio: nodo.inicio, destino: destinoDe(propio), sels: selectoresDe(propio), dentro: false })
  } else if (nodo.tipo === 'at') {
    for (const h of parsear(css, nodo.cuerpoDesde, nodo.cuerpoHasta)) {
      if (h.tipo !== 'regla') continue
      const propio = partirCabeza(h.cabeza).propio
      censo.push({ inicio: h.inicio, destino: destinoDe(propio), sels: selectoresDe(propio), dentro: true })
    }
  }
}

/* Segundo tiempo: el veto.
 *
 * Un selector no se mueve si el mismo selector se queda en index.css —al
 * moverse uno de los dos, el orden entre ellos cambia— o si ya existe en la
 * hoja de destino, donde aterrizaría al final y ganaría lo que antes perdía.
 *
 * Se repite hasta que no cambie nada: vetar un selector devuelve su regla al
 * archivo, y eso puede crear un conflicto nuevo con otra que sí se iba. */
const selsDeHoja = new Map()
for (const p of Object.keys(PANTALLAS)) {
  try { selsDeHoja.set(p, selectoresDeHoja(PANTALLAS[p].hoja)) } catch { selsDeHoja.set(p, new Set()) }
}

const vetados = new Map()   // selector -> por qué
const seMueve = (c) => c.destino && !c.sels.some((s) => vetados.has(s))

for (let vuelta = 0; vuelta < 10; vuelta++) {
  const quedan = new Set()
  const van = new Map()
  for (const c of censo) {
    if (seMueve(c)) for (const s of c.sels) van.set(s, c.destino)
    else for (const s of c.sels) quedan.add(s)
  }
  let nuevos = 0
  for (const [s, destino] of van) {
    if (vetados.has(s)) continue
    if (quedan.has(s)) { vetados.set(s, 'el mismo selector se queda en index.css'); nuevos++ }
    else if (selsDeHoja.get(destino).has(s)) { vetados.set(s, `ya existe en ${PANTALLAS[destino].hoja}`); nuevos++ }
  }
  if (!nuevos) break
}

/* Tercer tiempo: emitir. Se recorre otra vez y se corta por donde dijo el
   censo. Las rebanadas salen del original, así que el formato y los
   comentarios viajan intactos. */
const mudanzas = {}
const seQuedan = []
const decision = new Map(censo.map((c) => [c.inicio, c]))
let movidas = 0

for (const nodo of nodos) {
  if (nodo.tipo !== 'regla' && nodo.tipo !== 'at') { seQuedan.push(css.slice(nodo.inicio, nodo.fin)); continue }
  const { antes, propio } = partirCabeza(nodo.cabeza)

  if (nodo.tipo === 'regla') {
    const c = decision.get(nodo.inicio)
    if (!c || !seMueve(c)) { seQuedan.push(css.slice(nodo.inicio, nodo.fin)); continue }
    seQuedan.push(antes)
    ;(mudanzas[c.destino] ??= []).push(propio.trim() + css.slice(nodo.cuerpoDesde - 1, nodo.fin))
    movidas++
    continue
  }

  /* Un @media. Se mira hijo por hijo: puede irse entero, quedarse entero, o
     partirse — y entonces el destino recibe un @media nuevo con su prelude. */
  const hijos = parsear(css, nodo.cuerpoDesde, nodo.cuerpoHasta)
  const porDestino = {}
  const quedan = []
  let sobrevivioAlguno = false
  for (const h of hijos) {
    const c = h.tipo === 'regla' ? decision.get(h.inicio) : null
    if (!c || !seMueve(c)) {
      quedan.push(css.slice(h.inicio, h.fin))
      if (h.tipo === 'regla') sobrevivioAlguno = true
      continue
    }
    quedan.push(partirCabeza(h.cabeza).antes)
    const propioH = partirCabeza(h.cabeza).propio
    ;(porDestino[c.destino] ??= []).push('  ' + propioH.trim() + css.slice(h.cuerpoDesde - 1, h.fin))
    movidas++
  }
  if (!Object.keys(porDestino).length) { seQuedan.push(css.slice(nodo.inicio, nodo.fin)); continue }

  const prelude = propio.trim()
  for (const [destino, trozos] of Object.entries(porDestino)) {
    ;(mudanzas[destino] ??= []).push(`${prelude} {\n${trozos.join('\n')}\n}`)
  }
  /* Si no sobrevivió ninguna regla, el @media se va entero y no se deja el
     cascarón: dejarlo escribiría `@media (...) { } }` y descuadraría todo. */
  seQuedan.push(sobrevivioAlguno ? `${antes}${propio}{\n${quedan.join('')}\n}` : antes)
}

/* ─── Los frenos que quedan ───────────────────────────────────────────── */

const problemas = []
const balance = (s) => {
  const sinComentarios = s.replace(/\/\*[\s\S]*?\*\//g, '')
  return (sinComentarios.match(/{/g) || []).length === (sinComentarios.match(/}/g) || []).length
}

const nuevoIndex = seQuedan.join('')
if (!balance(nuevoIndex)) problemas.push('el index.css resultante no cuadra de llaves')
for (const [p, trozos] of Object.entries(mudanzas)) {
  if (!balance(trozos.join('\n\n'))) problemas.push(`lo que se va a ${p} no cuadra de llaves`)
}

/* ─── El informe ──────────────────────────────────────────────────────── */

const líneas = (s) => s.split('\n').length
console.log(`${ORIGEN}: ${líneas(css)} líneas`)
console.log(`  se mudan ${movidas} bloques:`)
for (const [p, trozos] of Object.entries(mudanzas)) {
  console.log(`    ${p.padEnd(14)} → ${PANTALLAS[p].hoja.padEnd(32)} ${String(trozos.reduce((a, t) => a + líneas(t), 0)).padStart(5)} líneas`)
}
console.log(`  se queda  ${líneas(nuevoIndex)} líneas`)
if (vetados.size) {
  console.log(`\n  ${vetados.size} selectores se quedan por precaución:`)
  for (const [s, porqué] of vetados) console.log(`    ${s.padEnd(46)} ${porqué}`)
}

if (problemas.length) {
  console.error('\nNo se mueve nada. Hay que mirar esto primero:')
  for (const p of problemas) console.error(`  ✗ ${p}`)
  process.exit(1)
}

if (!process.argv.includes('--de-verdad')) {
  console.log('\nEnsayo: no se escribió nada. Con --de-verdad se mueve.')
  console.log('Después, obligatorio: huella-estilos.mjs con --estados antes y después.')
  process.exit(0)
}

/* Con el árbol sucio no: si algo sale mal, `git checkout` de estas hojas tiene
   que ser una salida limpia, y no lo es si llevaban cambios de alguien más. */
let sucias = ''
try {
  sucias = execSync('git status --porcelain -- src/index.css src/pages/*.css 2>/dev/null').toString().trim()
} catch {
  /* Fuera de un repositorio —una copia suelta para probar— no hay nada que
     comprobar. Se avisa y se sigue: el freno protege del árbol sucio, no de
     que falte git. */
  console.warn('  (aviso: no es un repositorio git, no se comprueba el árbol)')
}
if (sucias) {
  console.error('\nHay hojas con cambios sin commitear. Commitea o guarda antes de mudar:')
  console.error(sucias)
  process.exit(1)
}

fs.writeFileSync(ORIGEN, nuevoIndex)
for (const [p, trozos] of Object.entries(mudanzas)) {
  const hoja = PANTALLAS[p].hoja
  fs.appendFileSync(
    hoja,
    `\n\n/* ─── Traído de index.css ──────────────────────────────────────────\n` +
      `   Reglas que sólo usa esta pantalla y que bloqueaban el primer pintado\n` +
      `   de todas las demás. Movidas por scripts/css-mudanza.mjs. */\n\n` +
      trozos.join('\n\n') + '\n'
  )
  console.log(`  escrito ${hoja}`)
}
console.log('\nMudado. Ahora la huella con estados, y css:pisadas.')
