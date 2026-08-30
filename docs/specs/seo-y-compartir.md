# SEO y compartir

> **Estado:** en producción
> **Última revisión:** 2026-08-23

## Qué resuelve

Dos problemas distintos que se suelen confundir:

1. **Que Google indexe** una SPA que no trae contenido en el HTML inicial.
2. **Que al pegar el enlace de una pieza en WhatsApp salga la foto y el nombre**, y no un
   rectángulo gris. Esto importa más que lo primero: aquí la gente comparte piezas por
   WhatsApp constantemente, y una previsualización vacía mata la conversación.

## Cómo funciona hoy

### Dos mecanismos, uno por problema

```
Visitante en la portada   →  index.html, con la portada YA pintada dentro
Visitante en otra ruta    →  app.html (el mismo head, #root vacío) + React
                             →  ponerMeta() actualiza el head
Crawler social            →  vercel.json detecta el user-agent
  (WhatsApp, Facebook,       →  /api/ficha?id=:id  →  HTML con OG tags ya puestos
   Instagram, TikTok…)
Googlebot                 →  NO se desvía (a propósito)
```

**Los dos HTML salen del mismo `<head>`**, el de `index.html` en la raíz del repo: cambiar
una etiqueta ahí las cambia en los dos. Lo que el prerenderizador recorta después es sólo
lo que cada uno no usa —`index.html` se queda sin el adelanto de la pieza y `app.html` sin
la precarga de la foto del hero— y a los dos les mete la hoja de estilos adentro. **Las
etiquetas de SEO y de compartir son idénticas en ambos.** Por qué son dos, en
[`diseno-y-frontend.md`](diseno-y-frontend.md#la-portada-se-pinta-en-el-build-no-en-el-celular).

### Archivos clave

| Ruta | Qué |
|---|---|
| `index.html:14-15` | Precarga de las dos woff2 propias |
| `index.html:38-59` | Title, description, canonical, OG y Twitter |
| `src/lib/tituloPieza.js` | El `<title>` de una pieza: por debajo de 60, sin precio |
| `src/lib/meta.js:19-32` | Guarda los valores originales una sola vez |
| `src/lib/meta.js:57-84` | `ponerMeta()` — **devuelve la función de limpieza** |
| `src/lib/meta.js:91-144` | `ponerProductoJsonLd()` — `schema.org/Product` |
| `src/lib/meta.js` | `migasDePieza()` / `ponerMigasJsonLd()` — `BreadcrumbList` |
| `src/lib/preguntas.js` | Las 6 preguntas y su `FAQPage`, que publica `Faq.jsx` |
| `src/lib/meta.js:101-104` | Deduplica imágenes con un `Set` |
| `src/lib/meta.js:125-128` | `stock === null` cuenta como `InStock` |
| `src/lib/meta.js:132-133` | `offers.url` con `www`, para coincidir con la canónica |
| `vercel.json:3-15` | El rewrite por user-agent |
| `api/ficha.js:10-14` | **Googlebot excluido a propósito** |
| `api/ficha.js:76` | Caché de borde 30 min + SWR 24 h |
| `api/ficha.js:83-84` | Valida que el id sea UUID |
| `api/ficha.js:85, 96, 109` | **Nunca devuelve error**: cae al head genérico |
| `scripts/sitemap.mjs` | 6 rutas fijas + una por pieza |
| `scripts/og/tarjeta.html` | Fuente de la imagen OG 1200×630 |

**Quién llama a `ponerMeta`:** sólo `Catalog.jsx:57` y `ProductPage.jsx:925, 933`.

### Variables de entorno

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`api/ficha.js` y `scripts/sitemap.mjs` los
leen por `process.env`).

## Decisiones tomadas y por qué

**Googlebot NO se desvía a `/api/ficha`** (`api/ficha.js:10-14`). Servirle a Google un HTML
distinto del que ve el usuario es **cloaking**, y se penaliza. Google ejecuta JavaScript;
los crawlers sociales no. Por eso el desvío es sólo para quienes lo necesitan de verdad.

**`api/ficha.js` nunca devuelve un error** (`:85, 96, 109`). Si la pieza no existe, si
Supabase falla, si el id es raro: devuelve el head genérico del sitio. **Un 500 en un
crawler social significa que el enlace se comparte sin previsualización** — que es
exactamente lo que se quería evitar.

**Se valida que el id sea UUID** (`:84`) antes de meterlo en el título: sin eso, cualquiera
podía inyectar texto arbitrario en la previsualización de un enlace del dominio.

**`ponerMeta` devuelve su función de limpieza** (`meta.js:57-84`) y guarda los valores
originales **una sola vez al arrancar** (`:19-32`). Sin esto, navegar de una pieza a la
portada dejaba el título de la pieza puesto.

**`stock === null` se trata como `InStock`** (`:125-128`): en este catálogo, `null`
significa "no llevo control de stock de esta pieza", no "agotada". Declararla agotada la
sacaría de Google Shopping sin motivo.

**`offers.url` fuerza `www`** (`:132-133`) para coincidir con la canónica. Dos formas de la
misma URL diluyen la señal.

**Caché de borde de 30 minutos con SWR de 24 h** (`:76`): las previsualizaciones se piden en
ráfagas cuando alguien comparte un enlace en un grupo.

**El sitemap se genera en el build** y **nunca lo tumba**: sin variables de entorno emite
sólo las rutas fijas.

**Las fuentes se precargan y se autoalojan** (`index.html:14-15`). Ver
[diseno-y-frontend.md](diseno-y-frontend.md): el elemento LCP es el logo del navbar, que es
texto en Marcellus.

### Tres datos estructurados, y por qué esos tres

Desde el 30 de agosto de 2026 el sitio publica tres bloques de schema.org, y cada uno
responde a una pregunta distinta:

| Bloque | Dónde | Para qué |
|---|---|---|
| `JewelryStore` | portada (`Home.jsx`) | Quién es la tienda: dónde está, a qué país vende y por qué número se le escribe |
| `FAQPage` | portada (`Faq.jsx` ← `src/lib/preguntas.js`) | Las seis respuestas, para que quien pregunte «¿cuánto tarda un anillo a medida?» reciba la de la casa y no la de un foro |
| `Product` + `BreadcrumbList` | ficha (`meta.js`) | La pieza y su sitio en el catálogo |

**Las migas no son adorno: la URL de una ficha es un UUID.** Debajo del título, en el
resultado de Google, va o `auremgsjoyeria.com/catalogo/235cde01-0649-4b7a…` —que no dice
nada y ocupa dos líneas— o `auremgsjoyeria.com › Catálogo › Anillos`, si se le dan las
migas. El último peldaño va sin `item` a propósito: es la página donde ya estás.

**El `FAQPage` se arma de la misma lista que pinta el acordeón**, no de un texto aparte, y
hay una prueba que lo comprueba. Publicar una respuesta que la página no enseña —o
enseñarla recortada— es contenido oculto para Google, y cuesta la ficha enriquecida entera.

**Lo que deliberadamente NO se publica:**

- **`aggregateRating`.** Las reseñas de la portada son inventadas y así está decidido. Una
  estrella en el resultado de Google que no venga de una reseña real es una violación de
  sus políticas, además de una mentira que sí se ve.
- **`hasMerchantReturnPolicy` y `shippingDetails`.** El retracto es de **5 días hábiles** y
  el esquema sólo admite un número de días corridos: no hay forma de decirlo sin
  redondear el derecho de la clienta, ni hacia arriba ni hacia abajo. Y el envío depende de
  la ciudad y de si paga en línea o con abono. Se quedan fuera hasta que se puedan decir
  exactos.

## Límites conocidos y pendientes

- ~~**El JSON-LD de la portada contradice al sitio**~~ — corregido el 23 de agosto de 2026:
  fuera platino, collares, pulseras y aretes, y las URLs con `www` como la canónica. El
  comentario de `Home.jsx` deja escrito qué decía — [pendientes #9](../pendientes.md).
- ~~**Las 4 páginas legales no ponen meta**~~ — las cuatro montan `<Meta>`, con su título,
  su descripción y su canónica — [pendientes #14](../pendientes.md).
- ~~**No hay ruta 404**~~ — `App.jsx` tiene `path="*"` con `NoEncontrado` dentro del layout
  normal — [pendientes #13](../pendientes.md).
- ~~**`scripts/prerender.mjs` está huérfano**~~ — borrado. Su función la asumió
  `api/ficha.js`, que resuelve lo mismo en caliente — [pendientes #22](../pendientes.md).
- `/confirmacion` no pone meta, pero está en `robots.txt` como `Disallow`, así que es
  aceptable.

## Cómo probarlo

**Lo más importante — simular un crawler social:**

```bash
curl -A "WhatsApp/2.23" https://www.auremgsjoyeria.com/catalogo/<uuid> | grep 'og:'
# debe traer og:title y og:image de LA PIEZA

curl -A "Googlebot/2.1" https://www.auremgsjoyeria.com/catalogo/<uuid> | head -20
# debe traer app.html —el cascarón de React—, NO la ficha pre-renderizada de /api/ficha

curl -s https://www.auremgsjoyeria.com/ | grep -c hero-frame
# la portada llega pintada: debe dar 1, no 0
```

1. **Robustez:** pide `/api/ficha?id=no-es-un-uuid` y `?id=<uuid inexistente>`. Ambos deben
   devolver **200** con el head genérico, nunca un error.
2. **Limpieza de meta:** navega de una pieza a la portada y mira el `<title>`. Debe volver
   al de la portada.
3. **JSON-LD:** pasa la ficha por el validador de resultados enriquecidos de Google.
4. **Sitemap:** `npm run sitemap` y comprueba que aparecen las piezas publicadas.
5. **Compartir de verdad:** pega el enlace de una pieza en un chat de WhatsApp. Debe salir
   foto, nombre y descripción.
