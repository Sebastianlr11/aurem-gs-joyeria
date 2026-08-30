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
Visitante normal          →  index.html + React  →  ponerMeta() actualiza el head
Crawler social            →  vercel.json detecta el user-agent
  (WhatsApp, Facebook,       →  /api/ficha?id=:id  →  HTML con OG tags ya puestos
   Instagram, TikTok…)
Googlebot                 →  NO se desvía (a propósito)
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `index.html:14-15` | Precarga de las dos woff2 propias |
| `index.html:38-59` | Title, description, canonical, OG y Twitter |
| `src/lib/tituloPieza.js` | El `<title>` de una pieza: por debajo de 60, sin precio |
| `src/lib/meta.js:19-32` | Guarda los valores originales una sola vez |
| `src/lib/meta.js:57-84` | `ponerMeta()` — **devuelve la función de limpieza** |
| `src/lib/meta.js:91-144` | `ponerProductoJsonLd()` — `schema.org/Product` |
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
# debe traer el index.html normal, NO la ficha pre-renderizada
```

1. **Robustez:** pide `/api/ficha?id=no-es-un-uuid` y `?id=<uuid inexistente>`. Ambos deben
   devolver **200** con el head genérico, nunca un error.
2. **Limpieza de meta:** navega de una pieza a la portada y mira el `<title>`. Debe volver
   al de la portada.
3. **JSON-LD:** pasa la ficha por el validador de resultados enriquecidos de Google.
4. **Sitemap:** `npm run sitemap` y comprueba que aparecen las piezas publicadas.
5. **Compartir de verdad:** pega el enlace de una pieza en un chat de WhatsApp. Debe salir
   foto, nombre y descripción.
