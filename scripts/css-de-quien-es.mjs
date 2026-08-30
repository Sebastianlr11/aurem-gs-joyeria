/**
 * De quién es cada regla de `src/index.css`.
 *
 * La hoja de la tienda son casi siete mil líneas y **bloquea el primer pintado
 * entera**, en todas las rutas. PageSpeed lo mide: 300 ms de bloqueo y 16 KiB
 * de CSS que la portada no usa. La ficha, el catálogo, la guía de tallas y las
 * legales tienen su propio CSS ahí dentro, y sus páginas ya van perezosas —
 * podrían traérselo ellas.
 *
 * El problema es saber qué es de quién sin adivinar. Los nombres de clase no
 * sirven de criterio: ya se intentó una vez con prefijos y `.joyero` —que es
 * la ficha de producto— acabó clasificada como panel y rompió la ficha.
 *
 * Así que no se adivina: se le pregunta al navegador. Este script abre cada
 * pantalla pública y, por cada bloque de la hoja, comprueba si alguno de sus
 * selectores encuentra algo. Un bloque que sólo aparece en la ficha es de la
 * ficha; uno que aparece en la portada se queda donde está.
 *
 *   node scripts/css-de-quien-es.mjs            # informe por consola
 *   node scripts/css-de-quien-es.mjs mapa.json  # y lo guarda
 *
 * Necesita `npm run build` y `npx vite preview` en :4173.
 *
 * **Esto no mueve nada.** Dice de quién es cada cosa; moverla es a mano, y
 * después se comprueba con `huella-estilos.mjs`, que es quien de verdad
 * responde si la página cambió.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.HUELLA_BASE || 'http://localhost:4173'
const ARCHIVO = 'src/index.css'

/* Las mismas pantallas que la huella, agrupadas por quién las carga. La ficha
   se resuelve sola desde el catálogo, igual que allá. */
const GRUPOS = {
  portada: ['/'],
  catalogo: ['/catalogo'],
  ficha: [],                       // se llena con la primera pieza del catálogo
  confirmacion: ['/confirmacion'],
  legales: ['/politica-de-privacidad', '/terminos-de-servicio', '/politica-de-devoluciones'],
  tallas: ['/guia-de-tallas'],
  'no-encontrado': ['/una-ruta-que-no-existe'],
}

const ANCHOS = [390, 1440]

// ─── Partir la hoja en trozos de primer nivel ───────────────────────────────

/**
 * Un trozo es una regla de primer nivel o una arroba entera (`@media`, …), con
 * el comentario que la precede pegado.
 *
 * Se parte por llaves contando profundidad, y no por líneas: en esta hoja hay
 * reglas de una sola línea dentro de medias, y un parser de líneas las cuenta
 * mal — es el mismo error que ya documenta `css-pisadas.mjs`.
 */
function trozos(texto) {
  const out = []
  let i = 0, profundidad = 0, inicio = 0
  const n = texto.length
  let dentroComentario = false

  while (i < n) {
    if (!dentroComentario && texto[i] === '/' && texto[i + 1] === '*') { dentroComentario = true; i += 2; continue }
    if (dentroComentario) { if (texto[i] === '*' && texto[i + 1] === '/') { dentroComentario = false; i += 2 } else i++; continue }

    if (texto[i] === '{') profundidad++
    else if (texto[i] === '}') {
      profundidad--
      if (profundidad === 0) {
        out.push({ inicio, fin: i + 1, texto: texto.slice(inicio, i + 1) })
        inicio = i + 1
      }
    }
    i++
  }
  if (inicio < n && texto.slice(inicio).trim()) out.push({ inicio, fin: n, texto: texto.slice(inicio), cola: true })
  return out
}

const linea = (texto, pos) => texto.slice(0, pos).split('\n').length

/** Los selectores de un trozo: el suyo, o los de dentro si es una arroba. */
function selectoresDe(txt) {
  const limpio = txt.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const preludios = []
  let prof = 0, desde = 0
  for (let i = 0; i < limpio.length; i++) {
    if (limpio[i] === '{') {
      if (prof === 0 || (prof === 1 && limpio.slice(0, desde).match(/@(media|supports|layer)[^{]*$/))) {
        preludios.push({ prof, s: limpio.slice(desde, i).trim() })
      } else preludios.push({ prof, s: limpio.slice(desde, i).trim() })
      prof++; desde = i + 1
    } else if (limpio[i] === '}') { prof--; desde = i + 1 }
  }
  const sels = new Set()
  let global = false
  for (const { s } of preludios) {
    if (!s || s.startsWith('@')) continue
    for (const parte of s.split(',')) {
      /* `:root`, `html` y `body` aplican en TODAS las pantallas, y con ellos
         suelen viajar los tokens del sistema de diseño. Un trozo que los
         contenga no es de nadie: se queda donde está.

         Esto no estaba, y por eso el 30 de agosto de 2026 se coló un
         `@media (max-width: 768px) { :root { --navbar-espacio: … } }` dentro
         de la hoja del catálogo. No rompió nada porque hoy sólo el catálogo lee
         ese token, pero era un token global escondido en una ruta — la clase de
         cosa que falla meses después, en una página distinta y sólo en móvil. */
      if (/(^|\s):root\b|(^|\s)html\b|(^|\s)body\s*$/.test(parte)) { global = true; continue }

      /* Al resto se le quitan pseudo-clases y pseudo-elementos: `:hover` y
         `::after` no encuentran nada con querySelector aunque la regla sí
         aplique. Lo que queda es el elemento al que cuelgan. */
      const base = parte
        .replace(/::?[a-z-]+(\([^)]*\))?/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (base && !base.startsWith('@') && !/^\d/.test(base)) sels.add(base)
    }
  }
  /* El centinela no lo encuentra ningún grupo, así que el trozo sale
     «compartido» y nadie se lo lleva. */
  if (global) sels.add('__GLOBAL__')
  return [...sels]
}

// ─── Chrome, otra vez lo mínimo ─────────────────────────────────────────────

function abrirChrome(puerto) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'dequien-'))
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ['--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`,
      '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' })
  return { chrome, perfil }
}

async function esperarChrome(puerto) {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${puerto}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Chrome no abrió el puerto')
}

function conectar(url) {
  const ws = new WebSocket(url)
  let n = 0
  const pendientes = new Map(), oyentes = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pendientes.has(m.id)) {
      const { ok, mal } = pendientes.get(m.id); pendientes.delete(m.id)
      m.error ? mal(new Error(m.error.message)) : ok(m.result)
    } else if (m.method && oyentes.has(m.method)) { const f = oyentes.get(m.method); oyentes.delete(m.method); f(m.params) }
  })
  return {
    lista: new Promise((ok, mal) => { ws.addEventListener('open', ok); ws.addEventListener('error', () => mal(new Error('sin Chrome'))) }),
    enviar: (method, params = {}, sessionId) => new Promise((ok, mal) => { const id = ++n; pendientes.set(id, { ok, mal }); ws.send(JSON.stringify({ id, method, params, sessionId })) }),
    unaVez: (method) => new Promise((ok) => oyentes.set(method, ok)),
    cerrar: () => ws.close(),
  }
}

// ─── ─────────────────────────────────────────────────────────────────────────

const css = fs.readFileSync(ARCHIVO, 'utf8')
const piezas = trozos(css).map((t) => ({
  ...t,
  linea: linea(css, t.inicio),
  lineaFin: linea(css, t.fin),
  selectores: selectoresDe(t.texto),
}))

const todos = [...new Set(piezas.flatMap((p) => p.selectores))]
console.log(`${piezas.length} trozos, ${todos.length} selectores distintos\n`)

const puerto = 9700 + Math.floor(Math.random() * 200)
const { chrome, perfil } = abrirChrome(puerto)
const cx = conectar(await esperarChrome(puerto))
await cx.lista
const { targetId } = await cx.enviar('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await cx.enviar('Target.attachToTarget', { targetId, flatten: true })
const ses = (m, p) => cx.enviar(m, p, sessionId)
await ses('Page.enable'); await ses('Runtime.enable')

async function ir(ruta, ancho) {
  await ses('Emulation.setDeviceMetricsOverride', { width: ancho, height: 2400, deviceScaleFactor: 1, mobile: ancho < 768 })
  const cargada = cx.unaVez('Page.loadEventFired')
  await ses('Page.navigate', { url: BASE + ruta })
  await cargada
  await new Promise((r) => setTimeout(r, 1500))
}

// La ficha, preguntándole al catálogo
await ir('/catalogo', 1440)
const rf = await ses('Runtime.evaluate', { expression: `(document.querySelector('a[href^="/catalogo/"]')||{}).getAttribute?.('href')||''`, returnByValue: true })
if (rf.result.value) GRUPOS.ficha = [rf.result.value]
else console.log('⚠ sin piezas en el catálogo: la ficha no se puede clasificar\n')

const dondeAparece = new Map(todos.map((s) => [s, new Set()]))

for (const [grupo, rutas] of Object.entries(GRUPOS)) {
  for (const ruta of rutas) {
    for (const ancho of ANCHOS) {
      await ir(ruta, ancho)
      const r = await ses('Runtime.evaluate', {
        expression: `(() => {
          const sels = ${JSON.stringify(todos)};
          const hay = [];
          for (const s of sels) { try { if (document.querySelector(s)) hay.push(s) } catch { hay.push(s) } }
          return JSON.stringify(hay);
        })()`,
        returnByValue: true,
      })
      for (const s of JSON.parse(r.result.value)) dondeAparece.get(s).add(grupo)
    }
  }
  process.stdout.write(`  visto: ${grupo}\n`)
}

cx.cerrar(); chrome.kill()
await new Promise((r) => chrome.once('exit', r))
try { fs.rmSync(perfil, { recursive: true, force: true }) } catch { /* lo barre /tmp */ }

/* Un trozo pertenece a un grupo si TODOS sus selectores que aparecen en algún
   sitio aparecen sólo ahí. El que no aparece en ninguna parte —el modal de
   pago, por ejemplo, que sólo existe con el diálogo abierto— se queda donde
   está: es más barato pagar sus bytes que romperlo sin enterarse. */
const mapa = piezas.map((p) => {
  const grupos = new Set()
  let vistos = 0
  for (const s of p.selectores) {
    const d = dondeAparece.get(s)
    if (d && d.size) { vistos++; for (const g of d) grupos.add(g) }
  }
  /* El centinela manda sobre todo lo demás: un trozo que toca `:root`, `html`
     o `body` es de todos aunque sus otros selectores sólo salgan en una
     pantalla. Se comprueba aquí y no preguntándole al navegador porque la
     respuesta ya se sabe. */
  const esGlobal = p.selectores.includes('__GLOBAL__')
  const soloDe = !esGlobal && vistos > 0 && grupos.size === 1 ? [...grupos][0] : null
  return { linea: p.linea, lineaFin: p.lineaFin, selectores: p.selectores.length, vistos, grupos: [...grupos], global: esGlobal, soloDe }
})

const porGrupo = new Map()
for (const m of mapa) {
  const clave = m.soloDe || (m.vistos === 0 ? '(no aparece)' : 'compartido')
  if (!porGrupo.has(clave)) porGrupo.set(clave, { trozos: 0, lineas: 0 })
  const e = porGrupo.get(clave)
  e.trozos++; e.lineas += m.lineaFin - m.linea + 1
}

console.log('\n' + '─'.repeat(52))
console.log('grupo             trozos    líneas')
for (const [g, e] of [...porGrupo].sort((a, b) => b[1].lineas - a[1].lineas)) {
  console.log(`${g.padEnd(18)}${String(e.trozos).padStart(5)}${String(e.lineas).padStart(10)}`)
}
console.log('─'.repeat(52))
console.log(`total${String(piezas.length).padStart(18)}${String(css.split('\n').length).padStart(10)}`)

const salida = process.argv[2]
if (salida) { fs.writeFileSync(salida, JSON.stringify(mapa, null, 1)); console.log(`\n→ ${salida}`) }
