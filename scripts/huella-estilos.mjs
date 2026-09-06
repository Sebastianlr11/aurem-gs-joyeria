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
 * Con `--estados` mide además las pantallas abiertas —el visor, el modal de
 * compra, el panel de filtros—, que no existen en el DOM hasta que alguien
 * hace clic y que de otro modo quedan sin vigilar. Las dos tomas tienen que
 * llevar la misma opción; si no, `comparar` se planta y lo dice.
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

/* Las pantallas públicas. La ruta inventada es la del 404, que también se
   pinta con el layout normal y ya se rompió una vez. */
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

/* ─── El panel, que hasta hoy no se medía ─────────────────────────────────
 *
 * Quedaba fuera por una razón que era buena y dejó de serlo: pide sesión. El
 * resultado es que `panel.css` —5.000 líneas más que `index.css`, y la
 * pantalla donde el joyero pasa el día— se tocaba a ciegas, que es justo lo
 * que esta herramienta existe para no hacer.
 *
 * Con `--panel` entra por el formulario de verdad, con las credenciales de
 * `HUELLA_ADMIN_EMAIL` y `HUELLA_ADMIN_CLAVE`. **Nunca en el archivo**: van en
 * el entorno de quien la corre, como el resto de los secretos del proyecto.
 *
 * Las siete secciones no son rutas: son `?tab=` sobre el mismo `Dashboard`, y
 * los identificadores están en inglés (ver CLAUDE.md §4). La entrada
 * (`/admin/login`) se queda fuera: se mide antes de que haya sesión, y medirla
 * en la misma corrida pediría un segundo perfil de Chrome por una pantalla que
 * no cambia. */
const PANEL = [
  ['panel-portada', '/admin?tab=dashboard'],
  ['panel-productos', '/admin?tab=products'],
  ['panel-pedidos', '/admin?tab=orders'],
  ['panel-clientes', '/admin?tab=customers'],
  ['panel-reportes', '/admin?tab=reports'],
  ['panel-anotaciones', '/admin?tab=notes'],
  ['panel-ajustes', '/admin?tab=settings'],
  ['panel-chat', '/admin/chat'],
]

/* ─── Los estados que no se ven al cargar ─────────────────────────────────
 *
 * Una parte grande del CSS de la tienda gobierna cosas que **no existen en el
 * DOM hasta que alguien hace clic**: el visor de fotos, el modal de compra, el
 * panel de filtros. Medir sólo la página recién cargada deja esas reglas sin
 * vigilar — y son justo las de la pantalla donde se paga.
 *
 * Con `--estados`, cada pantalla que tenga estados se mide también abierta.
 * Cuesta unas cuantas cargas más, así que no va por defecto: se pide cuando se
 * toca CSS que pueda afectarlos.
 *
 * `esperaA` no es decorado: si el estado no se abrió —cambió el botón, cambió
 * la clase—, medir daría la página cerrada y la comparación diría «no cambió
 * nada» con toda la confianza del mundo. Sin ese selector en pantalla, no se
 * mide y se avisa a gritos.
 *
 * El modal de compra se abre por la URL y no con un clic porque la ficha ya lo
 * hace así: `?buy=1` es el camino por el que vuelve quien iba a pagar. */
const ESTADOS = {
  ficha: [
    { nombre: 'visor', abrir: `document.querySelector('.pg-gallery-main')?.click()`, esperaA: '.pg-lightbox' },
    { nombre: 'compra', ruta: '?buy=1', esperaA: '.buy-modal-box' },
  ],
  catalogo: [
    { nombre: 'filtros', abrir: `document.querySelector('.catalogo-filtros-btn')?.click()`, esperaA: '.catalogo-panel' },
  ],
}

/* Los del panel van aparte y **no los gobierna `--estados`**: con la lista
   cerrada, `/admin/chat` es una columna de filas y un hueco. El interior del
   chat —la cabecera, el hilo, la ficha del contacto— es la pantalla, no un
   estado suyo, así que `--panel` lo mide siempre. */
const ESTADOS_PANEL = {
  'panel-chat': [
    { nombre: 'abierto', abrir: `esperarYPulsar('.chat-contact-item')`, esperaA: '.chat-conv-messages' },
    /* La ficha del contacto no nace abierta por debajo de 1.280, así que sin
       esto quedaba sin medir justo en los anchos donde se decidió que flotara.
       El botón vive en dos sitios según el ancho —en la barra en escritorio,
       dentro del menú de tres puntos en celular—, y por eso lo busca en los
       dos en vez de dar por hecho uno. */
    {
      nombre: 'ficha',
      abrir: `(async () => {
        const espera = (ms) => new Promise((r) => setTimeout(r, ms));
        const visible = (el) => el && el.offsetParent !== null;
        await esperarYPulsar('.chat-contact-item');
        for (let i = 0; i < 60; i++) {
          if (document.querySelector('.chat-info-panel')) return;
          const enBarra = [...document.querySelectorAll('.chat-conv-header-actions button')]
            .find((b) => /Info del contacto/i.test(b.getAttribute('title') || ''));
          if (visible(enBarra)) { enBarra.click(); await espera(120); continue; }
          const puntos = [...document.querySelectorAll('.chat-conv-header-actions button')]
            .find((b) => /Más opciones/i.test(b.getAttribute('aria-label') || ''));
          if (visible(puntos)) {
            puntos.click();
            await espera(120);
            const entrada = [...document.querySelectorAll('.chat-export-menu button')]
              .find((b) => /ficha/i.test(b.textContent));
            if (entrada) { entrada.click(); await espera(120); continue; }
          }
          await espera(120);
        }
      })()`,
      esperaA: '.chat-info-panel',
    },
  ],
  /* El modal de pieza son 400 líneas de CSS que sólo existen tras pulsar «Nueva
     pieza». Sin esto, tocarlas es exactamente el cambio a ciegas que esta
     herramienta vino a impedir.

     Sigue sin medirse el diálogo de despacho (`.envio-*`): pide un pedido en un
     estado concreto, y montarlo desde aquí sería atarse a los datos de la base.
     Queda anotado como el punto ciego que es. */
  'panel-productos': [
    { nombre: 'modal', abrir: `esperarYPulsar('.prod-btn-ink')`, esperaA: '.pm-caja' },
  ],
}

const CON_ESTADOS = process.argv.includes('--estados')
const CON_PANEL = process.argv.includes('--panel')
/* `--fotos <carpeta>` guarda además un PNG de cada pantalla medida. La huella
   dice si algo cambió; las fotos dicen si el cambio está bien, que es una
   pregunta que ninguna comparación de propiedades puede contestar. */
const FOTOS = (() => {
  const i = process.argv.indexOf('--fotos')
  return i >= 0 ? process.argv[i + 1] || 'fotos' : null
})()

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

/* Pulsar lo primero que aparezca con ese selector, esperándolo si hace falta.
 *
 * Los datos del panel vienen de Supabase, así que la lista de chats o la
 * rejilla de productos pueden no existir todavía cuando toca abrir el estado.
 * Pulsar a ciegas fallaba **en silencio**: no se abría nada, y el informe
 * decía «no se abrió» sin distinguir «cambió el botón» de «llegué temprano».
 * Le pasó a la ficha del contacto en 1024 y sólo en 1024, que es el peor tipo
 * de intermitencia. */
const AYUDANTES = `
  window.esperarYPulsar = async (sel) => {
    for (let i = 0; i < 60; i++) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return true; }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };
`

/* Espera a que el estado esté de verdad en pantalla. Diez segundos de tope y
   no dos: los estados del panel abren detrás de datos que vienen de Supabase,
   y con dos segundos el informe decía «no se abrió» cuando lo que pasaba era
   que la lista todavía no había llegado. Con las animaciones apagadas por
   CONGELAR, lo que no aparece en diez segundos es que de verdad no se abrió. */
const ESPERAR = (sel) => `(async () => {
  for (let i = 0; i < 200; i++) {
    if (document.querySelector(${JSON.stringify(sel)})) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
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

/* ─── Entrar al panel ─────────────────────────────────────────────────────
 *
 * Por el formulario y no metiendo la sesión a mano en `localStorage`: si
 * algún día el candado cambia, esto tiene que fallar aquí y no medir siete
 * pantallas de redirección creyendo que midió el panel.
 *
 * El valor se pone con el `setter` nativo del prototipo y no con `el.value`
 * porque los campos son controlados por React: asignarle el valor al nodo deja
 * el estado del componente vacío y el formulario se envía en blanco, sin decir
 * nada. Es la misma trampa de siempre, con `input` burbujeando detrás. */
const ENTRAR = (correo, clave) => `(async () => {
  const poner = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  for (let i = 0; i < 60 && !document.querySelector('#admin-correo'); i++)
    await new Promise((r) => setTimeout(r, 100));
  const correo = document.querySelector('#admin-correo');
  const clave = document.querySelector('#admin-clave');
  if (!correo || !clave) return 'no apareció el formulario de entrada';
  poner(correo, ${JSON.stringify(correo)});
  poner(clave, ${JSON.stringify(clave)});
  await new Promise((r) => setTimeout(r, 50));
  correo.form.requestSubmit();
  for (let i = 0; i < 150; i++) {
    if (document.querySelector('.admin-sidebar')) return '';
    await new Promise((r) => setTimeout(r, 100));
  }
  const err = document.querySelector('.admin-login-error');
  return err ? ('el panel rechazó las credenciales: ' + err.textContent.trim()) : 'no se llegó al panel';
})()`

async function entrarAlPanel(ses, cx) {
  const correo = process.env.HUELLA_ADMIN_EMAIL
  const clave = process.env.HUELLA_ADMIN_CLAVE
  if (!correo || !clave) {
    console.error('Para medir el panel hacen falta HUELLA_ADMIN_EMAIL y HUELLA_ADMIN_CLAVE en el entorno.')
    process.exit(1)
  }

  await ses('Emulation.setDeviceMetricsOverride', { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false })
  const cargada = cx.unaVez('Page.loadEventFired')
  await ses('Page.navigate', { url: BASE + '/admin/login' })
  await cargada

  const r = await ses('Runtime.evaluate', { expression: ENTRAR(correo, clave), awaitPromise: true, returnByValue: true })
  /* Un fallo aquí tumba la corrida a propósito. Seguir mediría ocho veces la
     pantalla de entrada y el informe diría, con toda la confianza del mundo,
     que el panel no cambió nada. */
  if (r.result.value) throw new Error(`No se pudo entrar al panel: ${r.result.value}`)
  console.log('  (sesión abierta en el panel)')
}

// ─── Tomar la huella ────────────────────────────────────────────────────────

/** Un PNG de lo que hay en pantalla, si se pidió `--fotos`. */
async function retratar(ses, nombre) {
  if (!FOTOS) return
  fs.mkdirSync(FOTOS, { recursive: true })
  const { data } = await ses('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(FOTOS, `${nombre.replace(/[^\w@.-]/g, '_')}.png`), Buffer.from(data, 'base64'))
}

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

  const huella = { base: BASE, tomada: new Date().toISOString(), propiedades: PROPIEDADES, estados: CON_ESTADOS, panel: CON_PANEL, pantallas: {} }

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

  /* La sesión se abre una vez y vive en `localStorage`, que sobrevive a los
     cambios de ancho y a las navegaciones: no hay que volver a entrar en cada
     pantalla. */
  if (CON_PANEL) {
    await entrarAlPanel(ses, cx)
    pantallas.push(...PANEL)
  }

  /* Los del panel van siempre que se pida `--panel`; los de la tienda, sólo
     con `--estados`. Ver ESTADOS_PANEL. */
  const estadosDe = (nombre) =>
    (nombre.startsWith('panel-') ? ESTADOS_PANEL[nombre] : CON_ESTADOS ? ESTADOS[nombre] : null) || []

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
      await retratar(ses, `${nombre}@${ancho}`)

      /* Cada estado se mide desde una carga limpia y no encadenando clics
         sobre la anterior: abrir el visor y después los filtros dejaría el
         visor abierto debajo, y lo medido no sería ninguno de los dos. */
      for (const est of estadosDe(nombre)) {
        const cargadaEst = cx.unaVez('Page.loadEventFired')
        await ses('Page.navigate', { url: BASE + ruta + (est.ruta || '') })
        await cargadaEst
        await new Promise((r) => setTimeout(r, 1500))
        await ses('Runtime.evaluate', { expression: CONGELAR, awaitPromise: true })
        await ses('Runtime.evaluate', { expression: AYUDANTES })
        if (est.abrir) await ses('Runtime.evaluate', { expression: est.abrir })

        const abierto = await ses('Runtime.evaluate', {
          expression: ESPERAR(est.esperaA), awaitPromise: true, returnByValue: true,
        })
        if (!abierto.result.value) {
          console.log(`  ⚠ ${nombre}:${est.nombre} @${ancho}: no se abrió (falta ${est.esperaA}) — SIN MEDIR`)
          continue
        }

        const re = await ses('Runtime.evaluate', { expression: RECOLECTOR(PROPIEDADES), returnByValue: true })
        const datosEst = JSON.parse(re.result.value)
        huella.pantallas[`${nombre}:${est.nombre}@${ancho}`] = datosEst
        process.stdout.write(`  ${nombre}:${est.nombre} @${ancho}: ${datosEst.length} elementos\n`)
        await retratar(ses, `${nombre}-${est.nombre}@${ancho}`)
      }
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

  /* Una huella con estados y otra sin ellos no son comparables de verdad: la
     mitad de las pantallas no tendría con qué compararse, y el informe diría
     «sin cambios» de lo que ni siquiera miró. */
  const soloEnA = Object.keys(A.pantallas).filter((k) => !B.pantallas[k])
  const soloEnB = Object.keys(B.pantallas).filter((k) => !A.pantallas[k])
  if (soloEnA.length || soloEnB.length) {
    console.error('Las dos huellas no cubren las mismas pantallas.')
    if (soloEnA.length) console.error(`  sólo en ${rutaA}: ${soloEnA.join(', ')}`)
    if (soloEnB.length) console.error(`  sólo en ${rutaB}: ${soloEnB.join(', ')}`)
    console.error('Vuelve a tomarlas con las mismas opciones (¿faltó --estados o --panel en una?).')
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

/* Las opciones se apartan antes de leer los archivos: `tomar --estados h.json`
   y `tomar h.json --estados` tienen que hacer lo mismo, y sobre todo ninguna
   de las dos puede acabar escribiendo un archivo llamado «--estados». */
const crudos = process.argv.slice(2)
const iFotos = crudos.indexOf('--fotos')
/* `--fotos` se lleva su valor por delante: sin esto, `tomar h.json --fotos f/`
   dejaría «f/» como segundo argumento y `comparar` lo tomaría por una huella. */
const [orden, ...args] = crudos
  .filter((a, i) => i !== iFotos + 1 || iFotos < 0)
  .filter((a) => !a.startsWith('--'))
if (orden === 'tomar' && args[0]) await tomar(args[0])
else if (orden === 'comparar' && args[1]) comparar(args[0], args[1])
else {
  console.error(
    'uso:\n' +
    '  node scripts/huella-estilos.mjs tomar <archivo.json> [--estados]\n' +
    '  node scripts/huella-estilos.mjs comparar <antes.json> <despues.json>\n\n' +
    '  --estados  mide además el visor, el modal de compra y el panel de filtros,\n' +
    '             que no existen hasta que alguien hace clic. Las dos tomas tienen\n' +
    '             que llevarlo, o comparar se planta.\n' +
    '  --panel    entra a /admin y mide sus ocho pantallas, con el chat abierto.\n' +
    '             Pide HUELLA_ADMIN_EMAIL y HUELLA_ADMIN_CLAVE en el entorno.\n' +
    '  --fotos <carpeta>  guarda además un PNG de cada pantalla medida.'
  )
  process.exit(1)
}
