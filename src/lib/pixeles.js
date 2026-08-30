/**
 * Píxeles de Meta y TikTok.
 *
 * Miden la mitad web del embudo: quién llega al sitio, ve una pieza y paga.
 * La otra mitad —quien llega a WhatsApp desde un anuncio— no la ve ningún
 * píxel, porque no hay página que medir; eso va por la API de Conversiones.
 *
 * Nada se carga si el identificador no está puesto. Sin las variables de
 * entorno el sitio funciona exactamente igual que antes: no hay peticiones
 * a Meta ni a TikTok, ni cookies suyas.
 */

const META_ID = import.meta.env.VITE_META_PIXEL_ID || null;
const TIKTOK_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID || null;

let iniciado = false;

/* ─── Cuándo arrancan los píxeles, y por qué tan tarde ───────────────
 *
 * Los dos píxeles son **284 KiB de JavaScript de terceros** —Meta 169, TikTok
 * 115—, y hasta el 24 de agosto de 2026 se cargaban a nivel de módulo, o sea
 * **antes de que se pintara nada**. En un celular con datos eso es la
 * diferencia entre ver la primera joya a los 3 segundos o a los 5 y medio, y
 * la clienta llega desde TikTok, en la calle, con media barra de señal.
 *
 * Después se pasaron a `requestIdleCallback` tras el evento `load`. Ayudó a
 * pintar antes, pero **no al bloqueo**: medido con Lighthouse móvil sobre
 * producción el 30 de agosto de 2026, `load` disparaba a los 435 ms y el
 * hueco llegaba enseguida, así que los dos ejecutaban sobre el segundo 1,4 —
 * dentro de la ventana que cuenta el tiempo con el hilo principal ocupado:
 *
 *     Facebook   99 ms de bloqueo
 *     TikTok     54 ms de bloqueo
 *     ─────────────────────────────
 *                153 ms de los 137 ms de TBT medidos
 *
 * Todo el bloqueo de la portada era de ellos: el bundle propio deja UNA tarea
 * larga de 64 ms, catorce por encima del umbral. Y adelantar o retrasar el
 * hueco no cambia nada, porque la ventana se cierra cuando el hilo se calma:
 * correr más tarde sólo mueve la ventana con ellos dentro.
 *
 * ── Lo que se hace ahora ────────────────────────────────────────────────
 *
 * Los píxeles se cargan **al primer gesto de la persona** —tocar, desplazar,
 * teclear— o cuando la pestaña se oculta. Nunca antes. En una visita de
 * verdad eso son uno o dos segundos: nadie mira una portada de joyería sin
 * desplazar. Para el medidor, que no toca nada, es no cargarlos nunca.
 *
 * ── Lo que esto cuesta, que no es cero ──────────────────────────────────
 *
 * Quien entra, no toca nada y se va, ya no dispara el fragmento de Meta ni el
 * de TikTok. Se cubre con dos cosas:
 *
 *   1. Ocultar la pestaña también carga. Salir de un sitio en el celular casi
 *      siempre pasa por ahí, y con la página escondida los 284 KiB no le
 *      quitan tiempo a nadie.
 *   2. Si aun así se va sin que el fragmento llegara a estar vivo, sale una
 *      **baliza** al píxel de imagen de Meta —el mismo que Meta publica para
 *      navegadores sin JavaScript—, que es una URL y nada más. La visita se
 *      cuenta igual, sólo que sin la cookie `_fbp`.
 *
 * TikTok no tiene un equivalente que se pueda llamar desde el navegador, así
 * que **una visita sin un solo gesto no le llega a TikTok**. Es el precio, y
 * es el visitante que menos dice: ni desplazó la portada.
 *
 * Lo que NO se pierde por nada de esto: la atribución de una venta. El
 * `fbclid` y el `ttclid` los guarda `capturarClic()` al arrancar la app, sin
 * depender de ningún fragmento, y la venta la manda el servidor por la API de
 * Conversiones. Y los eventos que valen plata —empezar a pagar y pagar—
 * fuerzan la carga en el momento (ver `urgente` más abajo): la pantalla de
 * gracias no espera a que nadie toque nada.
 */

/* ─── Y por eso hay una cola ─────────────────────────────────────────
 *
 * `meta()` y `tiktok()` comprueban `window.fbq` / `window.ttq` antes de
 * disparar, así que un evento lanzado antes de que el píxel cargue **se
 * perdía en silencio** — y el primero de todos es el `PageView` de la visita.
 * Diferir sin cola habría sido cambiar velocidad por medición, y la medición
 * es lo que dice si la pauta se paga sola.
 *
 * Con la cola no se cambia nada: lo que se lance antes se guarda y se
 * reproduce en cuanto el píxel existe. El evento sale igual, unos segundos
 * más tarde. Es lo mismo que hace el fragmento oficial de Meta con `n.queue`,
 * sólo que un escalón antes.
 */
const pendientes = [];

/**
 * Lanza el evento, o lo guarda si el píxel todavía no está.
 *
 * `urgente` es para los eventos que valen plata: no pueden esperar a que la
 * persona haga un gesto, porque puede no haber ninguno. El caso concreto es
 * la pantalla de gracias — se llega a ella volviendo de Mercado Pago, la
 * compra se anota sola y si nadie toca nada la venta no se contaría.
 */
function cuandoSePueda(cual, lanzar, urgente) {
  let listo = cual === 'meta' ? window.fbq : window.ttq;

  if (!listo && urgente) {
    cargarPixeles();
    listo = cual === 'meta' ? window.fbq : window.ttq;
  }

  if (listo) {
    /* Se vacía lo pendiente ANTES de lanzar lo de ahora, para que los eventos
       salgan en el orden en que ocurrieron. Y se hace aquí y no sólo al
       cargar los píxeles porque la cola no puede depender de un único camino:
       si `fbq` apareciera por otro lado —una carga a destiempo, un cambio
       futuro—, lo guardado se quedaría varado para siempre y nadie lo notaría.
       Lo cazó su propia prueba. */
    if (pendientes.length) vaciarCola();
    lanzar();
    return;
  }

  /* Un tope, por si los píxeles no llegan nunca —bloqueador, red caída—: sin
     él la cola crecería sola en una pestaña abierta toda la tarde. */
  if (pendientes.length < 50) pendientes.push({ cual, lanzar });
}

function vaciarCola() {
  const copia = pendientes.splice(0, pendientes.length);
  for (const { cual, lanzar } of copia) {
    const listo = cual === 'meta' ? window.fbq : window.ttq;
    if (listo) lanzar();
  }
}

/* Los gestos que cuentan como "hay alguien ahí". `scroll` va incluido porque
   en un celular es el primero de todos, casi siempre antes que un toque. */
const GESTOS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];

let cargados = false;
let balizaEnviada = false;
let soltarDisparadores = () => {};

/** Mete los dos fragmentos y suelta lo que estuviera guardado. */
function cargarPixeles() {
  if (cargados) return;
  cargados = true;
  soltarDisparadores();

  if (META_ID) cargarMeta();
  if (TIKTOK_ID) cargarTikTok();
  /* Los fragmentos definen `fbq` y `ttq` de forma síncrona —con su propia
     cola dentro—, así que aquí ya se puede vaciar la nuestra. */
  vaciarCola();
}

/**
 * ¿Está vivo el fragmento de Meta, o sólo su cola?
 *
 * `cargarMeta()` define `window.fbq` en el acto, antes de que el archivo baje:
 * ese `fbq` sólo apunta cosas en una lista. `callMethod` lo pone `fbevents.js`
 * cuando de verdad llegó, y es la diferencia entre un evento mandado y un
 * evento anotado en una página que se está cerrando.
 */
const metaVivo = () => !!(typeof window !== 'undefined' && window.fbq && window.fbq.callMethod);

/**
 * El píxel de imagen de Meta, para la visita que se va sin haber tocado nada.
 *
 * Es la misma URL que Meta pone en su `<noscript>`. No trae cookie ni datos
 * del navegador —la coincidencia con la persona es más floja que la del
 * fragmento— pero la visita se cuenta, que es la diferencia entre una campaña
 * medida y una campaña a ciegas.
 *
 * `keepalive` es lo que hace que el navegador la mande aunque la página se
 * esté cerrando; una petición normal se cancelaría a medio camino.
 */
function balizaDeSalida() {
  if (!META_ID || balizaEnviada || metaVivo()) return;
  balizaEnviada = true;

  const url = `https://www.facebook.com/tr/?id=${META_ID}&ev=PageView&noscript=1`;
  try {
    fetch(url, { mode: 'no-cors', keepalive: true }).catch(() => {});
  } catch {
    /* Un navegador sin `keepalive` en fetch: la imagen es el camino viejo y
       llega casi siempre. */
    new Image().src = url;
  }
}

/**
 * Prepara la carga de los píxeles. Se llama una vez, al arrancar la app, y no
 * baja nada: sólo se queda esperando a que la persona dé señales de vida.
 */
export function iniciarPixeles() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  if (!META_ID && !TIKTOK_ID) return;

  const alGesto = () => cargarPixeles();

  const alOcultarse = () => {
    if (document.visibilityState === 'hidden') cargarPixeles();
  };

  for (const gesto of GESTOS) {
    window.addEventListener(gesto, alGesto, { once: true, passive: true });
  }
  document.addEventListener('visibilitychange', alOcultarse);
  /* `pagehide` y no `unload`: `unload` rompe la caché de retroceso del
     navegador y Safari ni siquiera lo dispara con fiabilidad. */
  window.addEventListener('pagehide', balizaDeSalida);

  soltarDisparadores = () => {
    for (const gesto of GESTOS) window.removeEventListener(gesto, alGesto);
    document.removeEventListener('visibilitychange', alOcultarse);
  };
}

/* ─── Meta ──────────────────────────────────────────────────────────
   El fragmento oficial. La cola (`n.queue`) es lo que permite llamar a
   fbq() antes de que el script termine de bajar: se acumula y se
   reproduce al cargar. Por eso no se puede simplificar a un import. */
function cargarMeta() {
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  /* Se apaga la configuración automática ANTES de arrancar el píxel.
     
     Por defecto Meta recoge por su cuenta los clics en botones y envíos de
     formulario, y los manda como SubscribedButtonClick. No es un tipo de
     conversión, así que no distorsiona las ventas — pero tampoco aporta nada
     acá: este sitio dispara sus eventos explícitos y el servidor manda la
     venta con identificadores fuertes, que es mucho mejor señal que un clic
     adivinado.
     
     Lo que sí hace es mandar datos que no están declarados en la política de
     privacidad —Meta no documenta qué recoge exactamente, sólo dice "datos de
     clic en botones"— y ensuciar el panel con líneas que no vienen del
     código, que es justo lo que hace imposible saber si la medición está
     bien. */
  window.fbq('set', 'autoConfig', false, META_ID);
  window.fbq('init', META_ID);
}

/* ─── TikTok ────────────────────────────────────────────────────────
   Mismo principio: `ttq` acumula llamadas hasta que baja el script. */
function cargarTikTok() {
  /* eslint-disable */
  !(function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = (w[t] = w[t] || []);
    /* La lista viene del fragmento que entrega TikTok hoy. Los tres últimos
       —consentimiento— son recientes: sin ellos, llamar a grantConsent()
       fallaría en vez de encolarse. */
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    ttq.setAndDefer = function (t, e) {
      t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t) {
      for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
      return e;
    };
    ttq.load = function (e, n) {
      var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var o = d.createElement('script');
      o.type = 'text/javascript'; o.async = !0;
      o.src = i + '?sdkid=' + e + '&lib=' + t;
      var a = d.getElementsByTagName('script')[0];
      a.parentNode.insertBefore(o, a);
    };
    ttq.load(TIKTOK_ID);
  })(window, document, 'ttq');
  /* eslint-enable */
}

/* ─── Los eventos ───────────────────────────────────────────────────
   Cada uno manda a los dos píxeles con el nombre que espera cada
   plataforma, que no es el mismo: Meta dice "Purchase" y TikTok
   "CompletePayment". Envolverlo acá evita tener que recordarlo en cada
   pantalla. */

const meta = (evento, datos, opciones, urgente) => {
  if (!META_ID) return;
  cuandoSePueda('meta', () => window.fbq('track', evento, datos, opciones), urgente);
};
const tiktok = (evento, datos, urgente) => {
  if (!TIKTOK_ID) return;
  cuandoSePueda('tiktok', () => window.ttq.track(evento, datos), urgente);
};

/** Alguien abrió una página. Se dispara en cada cambio de ruta. */
export function pixelPagina() {
  meta('PageView');
  if (TIKTOK_ID) cuandoSePueda('tiktok', () => window.ttq.page());
}

/** Alguien está mirando una pieza. */
export function pixelVerPieza({ id, nombre, precio }) {
  const datos = {
    content_ids: [String(id)],
    content_name: nombre,
    content_type: 'product',
    value: Number(precio) || 0,
    currency: 'COP',
  };
  meta('ViewContent', datos);
  tiktok('ViewContent', {
    contents: [{ content_id: String(id), content_name: nombre, content_type: 'product' }],
    value: Number(precio) || 0,
    currency: 'COP',
  });
}

/** Empezó a pagar: abrió el checkout o generó el enlace. */
export function pixelIniciarPago({ id, nombre, precio }) {
  const datos = {
    content_ids: [String(id)],
    content_name: nombre,
    value: Number(precio) || 0,
    currency: 'COP',
  };
  /* Urgentes: es el primer paso del dinero, y quien lo da se va del sitio
     enseguida —a Mercado Pago o a WhatsApp—. */
  meta('InitiateCheckout', datos, undefined, true);
  tiktok('InitiateCheckout', {
    contents: [{ content_id: String(id), content_name: nombre, content_type: 'product' }],
    value: Number(precio) || 0,
    currency: 'COP',
  }, true);
}

/**
 * Pagó. El evento más importante y el único que hay que cuidar de dos
 * cosas: que no se dispare dos veces si recarga la página, y que lleve un
 * identificador estable.
 *
 * Ese identificador es el número del pedido. Cuando la API de Conversiones
 * mande esta misma compra desde el servidor, va a usar el mismo, y así Meta
 * entiende que es UNA venta contada por dos vías y no dos ventas.
 */
export function pixelCompra({ pedidoId, valor, piezaId, piezaNombre }) {
  if (!pedidoId) return;

  // Recargar la página de confirmación no puede contar otra venta.
  const marca = `compra-medida-${pedidoId}`;
  try {
    if (sessionStorage.getItem(marca)) return;
    sessionStorage.setItem(marca, '1');
  } catch {
    /* Navegación privada sin almacenamiento: se manda igual, es preferible
       contar de más una vez que perder la conversión. */
  }

  const valorNum = Number(valor) || 0;

  const metaDatos = { value: valorNum, currency: 'COP' };
  if (piezaId) {
    metaDatos.content_ids = [String(piezaId)];
    metaDatos.content_type = 'product';
  }
  if (piezaNombre) metaDatos.content_name = piezaNombre;
  meta('Purchase', metaDatos, { eventID: String(pedidoId) }, true);

  /* TikTok renombró CompletePayment a Purchase en mayo de 2025. El nombre
     viejo todavía se acepta y se convierte solo en los informes, pero el
     embudo declarado en el panel usa el nuevo, así que mandamos ese. */
  const ttDatos = { value: valorNum, currency: 'COP', event_id: String(pedidoId) };
  if (piezaId) {
    ttDatos.contents = [{
      content_id: String(piezaId),
      content_type: 'product',
      content_name: piezaNombre || undefined,
    }];
  }
  tiktok('Purchase', ttDatos, true);
}

/** Para el panel: saber si están puestos sin exponer los identificadores. */
export const pixelesActivos = { meta: !!META_ID, tiktok: !!TIKTOK_ID };
