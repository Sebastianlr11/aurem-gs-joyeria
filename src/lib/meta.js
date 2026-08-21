/**
 * El <head> de cada pantalla, puesto desde el navegador.
 *
 * Esto es una aplicación de una sola página: el index.html que sirve Vercel
 * es el mismo para todas las rutas. Sin esto, la ficha del Anillo Esencia
 * Imperial se titula igual que la home, y Google —que sí ejecuta JavaScript
 * antes de indexar— acaba con cinco páginas idénticas a sus ojos.
 *
 * Lo que esto NO arregla: los rastreadores de WhatsApp, Facebook e Instagram
 * no ejecutan JavaScript, así que para ellos sigue haciendo falta que el
 * servidor entregue el head ya hecho. Eso vive en api/ficha.js.
 */

const RAIZ = 'https://www.auremgsjoyeria.com';

/* Los valores de index.html, para poder devolver la pantalla al estado
   original cuando se sale de una ficha. Se leen una vez al arrancar: si se
   leyeran al salir, se estaría copiando lo que dejó la pantalla anterior. */
let original = null;

function leerOriginal() {
  if (original || typeof document === 'undefined') return original;
  original = {
    titulo: document.title,
    descripcion: contenido('meta[name="description"]'),
    ogTitulo: contenido('meta[property="og:title"]'),
    ogDescripcion: contenido('meta[property="og:description"]'),
    ogImagen: contenido('meta[property="og:image"]'),
    ogTipo: contenido('meta[property="og:type"]'),
  };
  return original;
}

const contenido = (sel) => document.querySelector(sel)?.getAttribute('content') ?? '';

function poner(sel, valor) {
  if (!valor) return;
  const el = document.querySelector(sel);
  if (el) el.setAttribute('content', valor);
}

function canonica(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * Pone título, descripción, canónica y Open Graph. Devuelve la función que
 * lo deshace, para usarla como limpieza de un efecto: sin ella, salir de una
 * ficha hacia el catálogo dejaría el título del anillo puesto.
 */
export function ponerMeta({ titulo, descripcion, imagen, ruta, tipo = 'website' }) {
  if (typeof document === 'undefined') return () => {};
  const base = leerOriginal();
  const url = ruta ? `${RAIZ}${ruta}` : RAIZ;

  if (titulo) document.title = titulo;
  poner('meta[name="description"]', descripcion);
  poner('meta[property="og:title"]', titulo);
  poner('meta[property="og:description"]', descripcion);
  poner('meta[property="og:image"]', imagen);
  poner('meta[property="og:url"]', url);
  poner('meta[property="og:type"]', tipo);
  poner('meta[name="twitter:title"]', titulo);
  poner('meta[name="twitter:description"]', descripcion);
  poner('meta[name="twitter:image"]', imagen);
  canonica(url);

  return () => {
    document.title = base.titulo;
    poner('meta[name="description"]', base.descripcion);
    poner('meta[property="og:title"]', base.ogTitulo);
    poner('meta[property="og:description"]', base.ogDescripcion);
    poner('meta[property="og:image"]', base.ogImagen);
    poner('meta[property="og:url"]', RAIZ);
    poner('meta[property="og:type"]', base.ogTipo);
    canonica(RAIZ + '/');
  };
}

/**
 * Datos estructurados de la pieza. Es lo que lee Google para enseñar el
 * precio en los resultados, y lo que leen los catálogos de Meta y de TikTok
 * cuando se conecta la tienda.
 */
export function ponerProductoJsonLd(pieza) {
  if (typeof document === 'undefined' || !pieza) return () => {};

  const id = 'jsonld-producto';
  document.getElementById(id)?.remove();

  const foto = (Array.isArray(pieza.images) && pieza.images[0]) || pieza.image_url || '';
  const material = [pieza.metal, pieza.piedra].filter(Boolean).join(' · ');

  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pieza.name,
    ...(foto ? { image: foto } : {}),
    ...(pieza.description ? { description: pieza.description } : {}),
    ...(material ? { material } : {}),
    brand: { '@type': 'Brand', name: 'Aurem Gs Joyería' },
    offers: {
      '@type': 'Offer',
      price: String(Math.round(Number(pieza.price) || 0)),
      priceCurrency: 'COP',
      /* stock nulo se cuenta como disponible: el taller trabaja por encargo y
         "agotado" sólo aplica a lo que se marcó como tal. */
      availability: pieza.stock === 0
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: `${RAIZ}/catalogo/${pieza.id}`,
    },
  };

  const s = document.createElement('script');
  s.id = id;
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(datos);
  document.head.appendChild(s);

  return () => document.getElementById(id)?.remove();
}
