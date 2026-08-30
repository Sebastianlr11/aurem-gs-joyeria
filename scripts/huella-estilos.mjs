/**
 * La huella de estilos: qué se ve, medido, antes y después de tocar el CSS.
 *
 * Existe por una razón concreta. En este proyecto el CSS son dos archivos de
 * catorce mil líneas escritas a mano, y **mover una regla de sitio cambia
 * quién gana la cascada**. Un fallo así no tumba el build ni sale en las
 * pruebas: sale a las tres semanas, cuando alguien abre la ficha en un celular
 * y ve una tipografía que no es. Es el mismo tipo de error que el de las
 * cuentas de plata — creíble, silencioso, y sólo visible si se compara.
 *
 * Lo que hace es abrir cada pantalla pública en Chrome sin cabeza, a cuatro
 * anchos, y anotar las propiedades calculadas de cada elemento. No opina: sólo
 * deja un archivo. Dos archivos se comparan y el que sobre dice exactamente
 * qué elemento, en qué pantalla, a qué ancho y qué propiedad cambió.
 *
 *   node scripts/huella-estilos.mjs tomar antes.json     # antes de tocar nada
 *   ...se cambia el CSS y se recompila...
 *   node scripts/huella-estilos.mjs tomar despues.json
 *   node scripts/huella-estilos.mjs comparar antes.json despues.json
 *
 * Necesita `npm run build` hecho y `npx vite preview` corriendo en :4173.
 *
 * Sin dependencias a propósito: habla con Chrome por su propio protocolo, que
 * Node 22+ permite con el WebSocket que ya trae. Añadir Puppeteer al proyecto
 * por un script que se corre tres veces al año no vale su superficie.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.HUELLA_BASE || 'http://localhost:4173'

/* Las pantallas públicas. El panel queda fuera porque vive en `panel.css` y
   además pide sesión; si algún día se toca aquél, se añaden aquí con un
   token. La ruta inventada es la del 404, que también se pinta con el layout
   normal y ya se rompió una vez. */
const PANTALLAS = [
  ['portada', '/'],
  ['catalogo', '/catalogo'],
  ['confirmacion', '/confirmacion'],
  ['privacidad', '/politica-de-privacidad'],
  ['terminos', '/terminos-de-servicio'],
  ['devoluciones', '/politica-de-devoluciones'],
  ['tallas', '/guia-de-tallas'],
  ['no-encontrado', '/una-ruta-que-no-existe'],
]

/* Cuatro anchos y no uno. 390 no basta —está escrito en CLAUDE.md y costó
   descubrirlo—: los saltos de este CSS están en 768 y en 968, así que un
   cambio puede verse perfecto en el móvil y partir la tablet. */
const ANCHOS = [390, 768, 1024, 1440]

/* Lo que se mira de cada elemento. Son las que deciden si algo se ve movido,
   de otro tamaño o de otro color; las que no cambian nada visible —cursor,
   user-select— se dejan fuera para que el informe no se llene de ruido. */
const PROPIEDADES = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear',
  'width', 'height', 'max-width', 'min-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'white-space',
  'color', 'background-color', 'background-image', 'opacity',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-color', 'border-radius', 'box-shadow',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'order',
  'grid-template-columns', 'grid-template-rows',
  'overflow-x', 'overflow-y', 'z-index', 'visibility', 'transform',
]

/* ─── El recolector, que corre dentro de la página ─────────────────────────
 *
 * Va como texto porque viaja por el protocolo y se evalúa allá. La clave de
 * cada elemento es su camino de índices desde <body> más la etiqueta: es
 * estable mientras el DOM no cambie, y aquí no cambia — sólo se mueve CSS de
 * archivo. Si algún día cambia el marcado, la comparación avisará de todo a
 * la vez, que es la señal correcta de que esta herramienta no aplica.
 */
const RECOLECTOR = (props) => `(() => {
  const PROPS = ${JSON.stringify(props)};
  const out = [];
  const anda = (el, camino) => {
    const cs = getComputedStyle(el);
    const clase = typeof el.className === 'string' ? el.className : '';
    out.push([
      camino + '|' + el.tagName + (clase ? '.' + clase.trim().split(/\\s+/).join('.') : ''),
      PROPS.map((p) => cs.getPropertyValue(p)),
    ]);
    for (let i = 0; i < el.children.length; i++) anda(el.children[i], camino + '/' + i);
  };
  anda(document.body, '');
  return JSON.stringify(out);
})()`

/* Congelar la página antes de mirarla.
 *
 * El hero y las secciones que aparecen al bajar tienen animaciones de entrada.
 * Medir a media animación da un número distinto en cada corrida y el informe
 * se llena de diferencias que no lo son. Se apagan las animaciones y las
 * transiciones —igual en las dos tomas, así que la comparación sigue siendo
 * honesta— y se espera a las fuentes: con Marcellus todavía sin cargar, cada
 * caja de texto mide otra cosa. */
const CONGELAR = `(async () => {
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  document.head.appendChild(s);
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return document.querySelectorAll('*').length;
})()`

// ─── Lo mínimo del protocolo de Chrome ──────────────────────────────────────

function abrirChrome(puerto) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'huella-'))
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${puerto}`,
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--disable-extensions',
    /* Sin esto, Chrome ralentiza el temporizador de las pestañas que cree que
       no se ven, y sin cabeza cree que no se ve ninguna. */
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    'about:blank',
  ], { stdio: 'ignore' })
  return { chrome, perfil }
}

async function esperarChrome(puerto) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/json/version`)
      if (r.ok) return (await r.json()).webSocketDebuggerUrl
    } catch { /* todavía no levanta */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Chrome no abrió el puerto de depuración')
}

/** Una conexión al protocolo, con `enviar(metodo, params)` y espera de eventos. */
function conectar(url) {
  const ws = new WebSocket(url)
  let n = 0
  const pendientes = new Map()
  const oyentes = new Map()

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pendientes.has(m.id)) {
      const { ok, mal } = pendientes.get(m.id)
      pendientes.delete(m.id)
      m.error ? mal(new Error(m.error.message)) : ok(m.result)
    } else if (m.method && oyentes.has(m.method)) {
      const f = oyentes.get(m.method)
      oyentes.delete(m.method)
      f(m.params)
    }
  })

  const lista = new Promise((ok, mal) => {
    ws.addEventListener('open', ok)
    ws.addEventListener('error', () => mal(new Error('no se pudo hablar con Chrome')))
  })

  return {
    lista,
    enviar: (method, params = {}, sessionId) =>
      new Promise((ok, mal) => {
        const id = ++n
        pendientes.set(id, { ok, mal })
        ws.send(JSON.stringify({ id, method, params, sessionId }))
      }),
    unaVez: (method) => new Promise((ok) => oyentes.set(method, ok)),
    cerrar: () => ws.close(),
  }
}

// ─── Tomar la huella ────────────────────────────────────────────────────────

async function tomar(destino) {
  const puerto = 9333 + Math.floor(Math.random() * 300)
  const { chrome, perfil } = abrirChrome(puerto)
  const wsUrl = await esperarChrome(puerto)
  const cx = conectar(wsUrl)
  await cx.lista

  const { targetId } = await cx.enviar('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cx.enviar('Target.attachToTarget', { targetId, flatten: true })
  const ses = (m, p) => cx.enviar(m, p, sessionId)
  await ses('Page.enable')
  await ses('Runtime.enable')

  const huella = { base: BASE, tomada: new Date().toISOString(), propiedades: PROPIEDADES, pantallas: {} }

  /* La ficha de pieza no se puede escribir a mano: su ruta lleva el uuid de un
     producto, y el que hoy es el primero mañana puede no estar. Se le pregunta
     al catálogo, que es de donde sale el enlace de verdad. Es además la
     pantalla con más CSS propio del sitio, así que quedarse sin ella dejaría
     ciega la comparación justo donde más falta hace. */
  const pantallas = [...PANTALLAS]
  {
    await ses('Emulation.setDeviceMetricsOverride', { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false })
    const cargada = cx.unaVez('Page.loadEventFired')
    await ses('Page.navigate', { url: BASE + '/catalogo' })
    await cargada
    await new Promise((r) => setTimeout(r, 2000))
    const r = await ses('Runtime.evaluate', {
      expression: `(document.querySelector('a[href^="/catalogo/"]') || {}).getAttribute?.('href') || ''`,
      returnByValue: true,
    })
    const ruta = r.result.value
    if (ruta) { pantallas.push(['ficha', ruta]); console.log(`  (ficha encontrada: ${ruta})`) }
    else console.log('  ⚠ el catálogo no dio ninguna pieza: la ficha queda sin medir')
  }

  for (const [nombre, ruta] of pantallas) {
    for (const ancho of ANCHOS) {
      /* El alto va generoso a propósito: con una ventana corta, las secciones
         que aparecen al entrar en pantalla no llegan a aparecer nunca y la
         mitad de la página se mide en su estado de reposo. */
      await ses('Emulation.setDeviceMetricsOverride', {
        width: ancho, height: 2400, deviceScaleFactor: 1, mobile: ancho < 768,
      })

      const cargada = cx.unaVez('Page.loadEventFired')
      await ses('Page.navigate', { url: BASE + ruta })
      await cargada
      /* La portada y el catálogo esperan al catálogo de Supabase; sin esta
         pausa se miden con las rejillas vacías, que es otra página. */
      await new Promise((r) => setTimeout(r, 1500))
      await ses('Runtime.evaluate', { expression: CONGELAR, awaitPromise: true })

      const r = await ses('Runtime.evaluate', { expression: RECOLECTOR(PROPIEDADES), returnByValue: true })
      const datos = JSON.parse(r.result.value)
      huella.pantallas[`${nombre}@${ancho}`] = datos
      process.stdout.write(`  ${nombre} @${ancho}: ${datos.length} elementos\n`)
    }
  }

  fs.writeFileSync(destino, JSON.stringify(huella))
  const total = Object.values(huella.pantallas).reduce((a, p) => a + p.length, 0)
  console.log(`\n${total} elementos en ${Object.keys(huella.pantallas).length} pantallas → ${destino}`)

  cx.cerrar()
  chrome.kill()
  /* Chrome sigue escribiendo su perfil un momento después de recibir la señal,
     así que borrarlo de inmediato falla con ENOTEMPTY — y tumbaba el script
     DESPUÉS de haber guardado la huella, que es la peor forma de fallar: el
     trabajo estaba hecho y parecía que no. Se espera a que muera y, si aun así
     se resiste, se deja el directorio temporal: lo barre el sistema. */
  await new Promise((r) => chrome.once('exit', r))
  try { fs.rmSync(perfil, { recursive: true, force: true }) } catch { /* ya lo barrerá /tmp */ }
}

// ─── Comparar dos huellas ───────────────────────────────────────────────────

function comparar(rutaA, rutaB) {
  const A = JSON.parse(fs.readFileSync(rutaA, 'utf8'))
  const B = JSON.parse(fs.readFileSync(rutaB, 'utf8'))

  if (A.propiedades.join() !== B.propiedades.join()) {
    console.error('Las dos huellas miran propiedades distintas: no son comparables.')
    process.exit(1)
  }

  let cambios = 0
  let elementos = 0
  const porPropiedad = new Map()

  for (const pantalla of Object.keys(A.pantallas)) {
    const a = A.pantallas[pantalla]
    const b = B.pantallas[pantalla]
    if (!b) { console.log(`⚠ ${pantalla}: no está en la segunda huella`); continue }
    if (a.length !== b.length) {
      console.log(`⚠ ${pantalla}: ${a.length} elementos antes y ${b.length} después — el marcado cambió, esta comparación no aplica`)
      continue
    }

    const mapaB = new Map(b)
    for (const [clave, valoresA] of a) {
      const valoresB = mapaB.get(clave)
      if (!valoresB) { console.log(`⚠ ${pantalla}: desapareció ${clave}`); continue }
      const distintas = []
      for (let i = 0; i < valoresA.length; i++) {
        if (valoresA[i] !== valoresB[i]) distintas.push([A.propiedades[i], valoresA[i], valoresB[i]])
      }
      if (!distintas.length) continue
      elementos++
      cambios += distintas.length
      for (const [p] of distintas) porPropiedad.set(p, (porPropiedad.get(p) || 0) + 1)
      if (elementos <= 40) {
        console.log(`\n${pantalla}  ${clave.split('|')[1]}`)
        console.log(`  ${clave.split('|')[0] || '(body)'}`)
        for (const [p, va, vb] of distintas) console.log(`    ${p}: ${va}  →  ${vb}`)
      }
    }
  }

  console.log('\n' + '─'.repeat(60))
  if (!cambios) {
    console.log('Ni una diferencia. El CSS se movió sin cambiar lo que se ve.')
  } else {
    console.log(`${cambios} propiedades cambiadas en ${elementos} elementos.`)
    if (elementos > 40) console.log(`(sólo se imprimieron los primeros 40)`)
    console.log('\nPor propiedad:')
    for (const [p, n] of [...porPropiedad].sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)}  ${p}`)
    process.exitCode = 1
  }
}

// ─── ─────────────────────────────────────────────────────────────────────────

const [orden, ...args] = process.argv.slice(2)
if (orden === 'tomar' && args[0]) await tomar(args[0])
else if (orden === 'comparar' && args[1]) comparar(args[0], args[1])
else {
  console.error('uso:\n  node scripts/huella-estilos.mjs tomar <archivo.json>\n  node scripts/huella-estilos.mjs comparar <antes.json> <despues.json>')
  process.exit(1)
}
