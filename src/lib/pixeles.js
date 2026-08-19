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

/* Carga los píxeles. Se llama una vez, al arrancar la app. */
export function iniciarPixeles() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;

  if (META_ID) cargarMeta();
  if (TIKTOK_ID) cargarTikTok();
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

const meta = (evento, datos, opciones) => {
  if (META_ID && window.fbq) window.fbq('track', evento, datos, opciones);
};
const tiktok = (evento, datos) => {
  if (TIKTOK_ID && window.ttq) window.ttq.track(evento, datos);
};

/** Alguien abrió una página. Se dispara en cada cambio de ruta. */
export function pixelPagina() {
  meta('PageView');
  if (TIKTOK_ID && window.ttq) window.ttq.page();
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
  meta('InitiateCheckout', datos);
  tiktok('InitiateCheckout', {
    contents: [{ content_id: String(id), content_name: nombre, content_type: 'product' }],
    value: Number(precio) || 0,
    currency: 'COP',
  });
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
  meta('Purchase', metaDatos, { eventID: String(pedidoId) });

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
  tiktok('Purchase', ttDatos);
}

/** Para el panel: saber si están puestos sin exponer los identificadores. */
export const pixelesActivos = { meta: !!META_ID, tiktok: !!TIKTOK_ID };
