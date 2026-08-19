/**
 * De qué anuncio vino esta persona.
 *
 * El problema que resuelve: alguien toca un anuncio de TikTok el martes,
 * mira el catálogo, se va, y compra el jueves. El píxel del navegador ve la
 * compra pero el servidor —que es quien la confirma cuando Mercado Pago
 * avisa— no tiene forma de saber que empezó en un anuncio.
 *
 * La pista viaja en cuatro identificadores:
 *
 *   ttclid  — TikTok lo pega en la URL cuando alguien toca el anuncio
 *   _ttp    — cookie que pone el píxel de TikTok en el navegador
 *   fbclid  — lo mismo de Meta, en la URL
 *   _fbp    — cookie que pone el píxel de Meta
 *
 * Los de la URL sólo aparecen en la primera visita, así que se guardan; las
 * cookies se leen en el momento de comprar. Todo esto se manda con el pedido
 * y viaja después al servidor, que es el único que sabe con certeza si el
 * pago se completó.
 *
 * Nada de esto identifica a una persona por nombre: son códigos que sólo
 * TikTok y Meta pueden cruzar con sus propios usuarios.
 */

const GUARDADO = 'aurem-atribucion';

/* Los identificadores de clic caducan. Meta usa siete días para fbc; TikTok
   no publica un número, así que se usa el mismo criterio. Pasado eso el clic
   ya no explica la compra y arrastrarlo sólo ensucia la medición. */
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

const leer = () => {
  try {
    const crudo = localStorage.getItem(GUARDADO);
    if (!crudo) return null;
    const dato = JSON.parse(crudo);
    if (!dato?.momento || Date.now() - dato.momento > VIGENCIA_MS) {
      localStorage.removeItem(GUARDADO);
      return null;
    }
    return dato;
  } catch {
    return null;
  }
};

/**
 * Se llama al arrancar la app. Si la URL trae un identificador de clic, lo
 * guarda; si no, deja en paz lo que ya había — la visita de hoy no borra el
 * anuncio de anteayer.
 */
export function capturarClic() {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const ttclid = params.get('ttclid');
    const fbclid = params.get('fbclid');
    if (!ttclid && !fbclid) return;

    const previo = leer() || {};
    localStorage.setItem(GUARDADO, JSON.stringify({
      ttclid: ttclid || previo.ttclid || null,
      fbclid: fbclid || previo.fbclid || null,
      momento: Date.now(),
    }));
  } catch {
    /* Sin localStorage —navegación privada, permisos— se pierde la
       atribución diferida, no la compra. */
  }
}

/** Lee una cookie por nombre. Devuelve null si no está. */
const cookie = (nombre) => {
  if (typeof document === 'undefined') return null;
  const partes = document.cookie.split('; ');
  for (const parte of partes) {
    const corte = parte.indexOf('=');
    if (corte > 0 && parte.slice(0, corte) === nombre) {
      return decodeURIComponent(parte.slice(corte + 1));
    }
  }
  return null;
};

/**
 * Lo que hay que mandar con el pedido.
 *
 * `fbc` no es el fbclid a secas: Meta espera el formato
 * `fb.1.<momento>.<fbclid>`. Si el píxel de Meta ya lo armó y lo dejó en la
 * cookie `_fbc`, se usa esa —es la fuente correcta—; si no, se arma acá con
 * el momento en que se vio el clic.
 */
export function datosDeAtribucion() {
  const guardado = leer();

  let fbc = cookie('_fbc');
  if (!fbc && guardado?.fbclid) {
    fbc = `fb.1.${guardado.momento}.${guardado.fbclid}`;
  }

  const datos = {
    ttclid: guardado?.ttclid || null,
    ttp: cookie('_ttp'),
    fbc: fbc || null,
    fbp: cookie('_fbp'),
    /* Meta descarta los eventos de servidor con action_source 'website' que
       llegan sin el user agent del navegador del comprador. El servidor no
       lo tiene —cuando Mercado Pago confirma el pago, quien llama es Mercado
       Pago— así que hay que capturarlo acá y llevarlo con el pedido. */
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };

  // Sólo lo que existe: mandar nulos no le sirve a nadie.
  return Object.fromEntries(Object.entries(datos).filter(([, v]) => v));
}
