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
    robots: contenido('meta[name="robots"]'),
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
export function ponerMeta({ titulo, descripcion, imagen, ruta, tipo = 'website', robots }) {
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
  /* index.html declara `index, follow` para todo el sitio, así que una
     pantalla que NO deba indexarse tiene que decirlo — y deshacerlo al salir,
     o dejaría el sitio entero en noindex. */
  if (robots) poner('meta[name="robots"]', robots);
  canonica(url);

  return () => {
    document.title = base.titulo;
    poner('meta[name="description"]', base.descripcion);
    poner('meta[property="og:title"]', base.ogTitulo);
    poner('meta[property="og:description"]', base.ogDescripcion);
    poner('meta[property="og:image"]', base.ogImagen);
    poner('meta[property="og:url"]', RAIZ);
    poner('meta[property="og:type"]', base.ogTipo);
    poner('meta[name="robots"]', base.robots);
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

  /* Todas las fotos, no sólo la primera: Google puede elegir cuál enseñar en
     el resultado, y con una sola no le damos opción. */
  /* Sin repetir: image_url suele ser la misma que images[0], y una lista con
     la misma foto dos veces es una señal de descuido para quien la lea. */
  const fotos = [...new Set([
    ...(Array.isArray(pieza.images) ? pieza.images : []),
    ...(pieza.image_url ? [pieza.image_url] : []),
  ].filter(Boolean))];
  const material = [pieza.metal, pieza.piedra].filter(Boolean).join(' · ');

  /* La misma referencia que se enseña en la ficha. Le da a Google un
     identificador estable de la pieza, distinto de la URL. */
  const sku = `AG-${String(pieza.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;

  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pieza.name,
    sku,
    ...(fotos.length ? { image: fotos } : {}),
    ...(pieza.description ? { description: pieza.description } : {}),
    ...(pieza.category ? { category: pieza.category } : {}),
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
      seller: { '@type': 'Organization', name: 'Aurem Gs Joyería' },
      /* Con www, igual que la canónica. El bloque que había en la ficha la
         ponía sin www y eso le decía a Google que era otra página. */
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

/**
 * Las migas de pan de una pieza, para el resultado de Google.
 *
 * No es adorno: **la URL de una ficha es un UUID**. En el resultado de
 * búsqueda, debajo del título, Google enseña o la dirección —
 * `auremgsjoyeria.com/catalogo/235cde01-0649-4b7a…`, que no dice nada y ocupa
 * dos líneas— o las migas, si se las damos. Con esto enseña
 * `auremgsjoyeria.com › Catálogo › Anillos`.
 *
 * Se corresponde con lo que la ficha sí tiene a la vista: el botón de volver
 * al catálogo y el antetítulo con la categoría. Marcar un camino que la
 * página no enseña es justo lo que Google penaliza.
 */
export function migasDePieza(pieza) {
  if (!pieza?.id) return null;

  const camino = [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Catálogo', ruta: '/catalogo' },
    pieza.category ? { nombre: pieza.category, ruta: `/catalogo?categoria=${encodeURIComponent(pieza.category)}` } : null,
    /* El último peldaño es la página donde ya estás. Va sin `item`: así lo
       pide el esquema, y sin eso Google lo cuenta como un enlace a sí misma. */
    { nombre: pieza.name || 'La pieza' },
  ].filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: camino.map((paso, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: paso.nombre,
      ...(paso.ruta ? { item: `${RAIZ}${paso.ruta}` } : {}),
    })),
  };
}

/** Las migas puestas en el `<head>`, con su limpieza, como el resto. */
export function ponerMigasJsonLd(pieza) {
  if (typeof document === 'undefined') return () => {};

  const id = 'jsonld-migas';
  document.getElementById(id)?.remove();

  const datos = migasDePieza(pieza);
  if (!datos) return () => {};

  const s = document.createElement('script');
  s.id = id;
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(datos);
  document.head.appendChild(s);

  return () => document.getElementById(id)?.remove();
}
