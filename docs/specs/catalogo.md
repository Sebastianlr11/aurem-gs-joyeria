# Catálogo

> **Estado:** en producción
> **Última revisión:** 2026-08-23
> **Ruta:** `/catalogo` · `src/pages/Catalog.jsx` (723 líneas)

## Qué resuelve

Ver todas las piezas publicadas y acotarlas por categoría, precio, material y búsqueda.
Con un catálogo pequeño (decenas de piezas, no miles), la prioridad no es la escala sino
que **nadie se quede mirando una pantalla vacía sin saber qué hacer**.

## Cómo funciona hoy

### Flujo

Una sola consulta trae **todo el catálogo** al montar. Filtrado, ordenación, búsqueda y
paginación ocurren **enteramente en el navegador**. No hay `.range()`, ni orden en
servidor, ni paginación por cursor.

```
Catalog monta
  └── products.select('*').order('created_at', desc)   ← una vez, todo
        └── useMemo: filtros + búsqueda + orden          ← en cliente
              └── "Ver más" incremental de 8 en 8
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/Catalog.jsx:68-71` | La consulta única |
| `src/pages/Catalog.jsx:105-123` | Filtrado, búsqueda y orden en `useMemo` |
| `src/pages/Catalog.jsx:8` | `CATEGORIAS` — lista fija |
| `src/pages/Catalog.jsx:10-15` | `RANGOS` de precio — hardcodeados |
| `src/pages/Catalog.jsx:88-95` | Materiales, **derivados de los datos** |
| `src/pages/Catalog.jsx:252-297` | Focus trap del panel de filtros, escrito a mano |
| `src/pages/Catalog.jsx:185-242` | Estados vacíos — cuatro variantes |
| `src/pages/Catalog.jsx:31` | `PER_PAGE = 8` |
| `src/pages/Catalog.jsx:57` | `ponerMeta` |
| `src/components/catalog/ProductCard.jsx` | La tarjeta de pieza |

### Tablas y columnas

`products` — `select('*')`, ordenado por `created_at` descendente.
Consume en JS: `id`, `name`, `description`, `price`, `category`, `metal`, `image_url`,
`stock`, `compare_price`, `is_new`.

### Variables de entorno

Ninguna propia (usa el cliente de `src/lib/supabase.js`).

## Decisiones tomadas y por qué

**Todo el filtrado en cliente.** Con este volumen, una consulta y `useMemo` es más rápido
que ir al servidor por cada cambio de filtro, y hace que combinar filtros sea instantáneo.
**Es una decisión con fecha de caducidad**: cuando el catálogo crezca a cientos de piezas
habrá que mover el filtrado al servidor.

**Las categorías son una lista fija** (`:8`) e incluyen Collares, Aretes y Pulseras que
hoy no tienen ni una pieza — **y siguen siendo clicables** a propósito (razón en `:363-374`).
Esconder una categoría vacía comunica "esto no lo hacemos"; dejarla clicable con un estado
vacío que ofrece escribir por WhatsApp comunica "esto lo hacemos a pedido". Para un taller
que fabrica a medida, la segunda lectura es la correcta.

**Los materiales sí se derivan de los datos** (`:88-95`, primera palabra de `p.metal`):
son un hecho del inventario, no una promesa comercial.

**Cuatro estados vacíos distintos** (`:185-242`), no uno genérico. Falló la red / el
término no existe / hay demasiados filtros / la categoría está vacía / el catálogo está
vacío. Cada uno cambia **qué botón es el primario**, y cuando hay búsqueda **el mensaje de
WhatsApp lleva el término escrito** (`:163-170`): quien buscó "argolla de matrimonio" y no
encontró nada llega al chat con esa frase ya puesta.

**Focus trap escrito a mano** (`:252-297`) en vez de una librería de diálogos: bloquea el
scroll del body, cicla Tab y Shift+Tab, Escape cierra y **devuelve el foco al botón que lo
abrió**. Es el código más cuidado del frontend público en accesibilidad.

**"Ver más" incremental**, no paginación numerada: en móvil el pulgar ya está abajo.

### El catálogo viene pintado desde el build (7 de septiembre de 2026)

PageSpeed móvil del 6 de septiembre: **93**, con LCP 2,8 s y Speed Index 4,2 s. El LCP es
la foto de la primera tarjeta, y el navegador no sabía que existía hasta desenredar
`app.html → index.js → consulta a Supabase (921 ms) → chunk del catálogo → <img>`. Es el
problema que ya tuvo la portada y se resuelve igual: `scripts/prerenderizar.mjs` pinta
`/catalogo` en Node y deja **`dist/catalogo.html`** con la rejilla dentro de `#root`, las dos
hojas (`index.css` y `Catalog.css`, en ese orden) en línea, `<link rel="preload">` de las dos
primeras fotos —la primera con `fetchpriority="high"`—, `modulepreload` del chunk, y el
título, la descripción y la canónica del catálogo en el `<head>`. `vercel.json` manda
`/catalogo` ahí con una reescritura explícita.

Lo que lo diferencia de la portada es que **el catálogo son datos**:

- El build trae la lista con la misma `CONSULTA` de `piezasPublicadas.js`, la siembra con
  `sembrar()` antes de pintar y la escribe en el HTML como `window.__catalogo`, antes del
  bundle. `useCatalogoPublico` arranca de esa semilla, así el primer render del navegador es
  idéntico al HTML y React hidrata en vez de reconstruir.
- En cuanto monta, el gancho vuelve a preguntar y reemplaza la lista por la viva. **La
  semilla es el primer frame, no la verdad.**
- Y guardar una pieza en el panel dispara un build nuevo por el Deploy Hook de Vercel
  (`20260907_el_catalogo_se_vuelve_a_pintar_solo.sql`), para que ese primer frame también
  esté al día. Necesita la clave `ajustes_internos.vercel_deploy_hook`; sin ella el
  disparador no hace nada y el primer frame se actualiza en cada despliegue.

Tres cosas que se cambiaron en la pantalla para que el primer render sea el mismo en Node y
en el celular, y que no hay que deshacer: `categoria` arranca siempre en «Todos» y el
`?categoria=` de la URL se aplica en un efecto después de montar (un frame de rejilla
completa para quien llega desde una colección de la portada); los enlaces de WhatsApp usan
`useWaUrl` y no `waUrl`; y el `sizes` de la tarjeta vive en `TAMANOS_TARJETA`
(`fotoProducto.js`) porque el build lo repite en la precarga.

Si la consulta falla en el build, `catalogo.html` sale como el cascarón vacío y la consola lo
grita; el build no se tumba. Pintado en Node, el catálogo enseña 8 tarjetas (`columnas = 1`
hasta que el navegador mide la rejilla), que es lo mismo que pinta el primer render del
navegador.

## Límites conocidos y pendientes

- **La primera tarjeta ya no lleva `decoding="async"`** (desde el 6 de septiembre de 2026):
  es el LCP de esta pantalla. Las demás sí.

- **No escala.** Una consulta que trae el catálogo entero deja de funcionar a partir de
  unos cientos de piezas.
- **Las tarjetas ya optimizan imagen** desde el 23 de agosto: `srcset`, `sizes` y
  `width`/`height` salen de `src/lib/fotoProducto.js`, y el `decoding="async"` lo pone
  `ProductCard.jsx` — ahí sí conviene, porque ninguna tarjeta es el LCP de nada (en la
  ficha y en la portada se quitó, ver la trampa de `CLAUDE.md`). Con la salvedad de que una
  foto sólo entra en el juego de tamaños si se subió con el tratamiento nuevo; las
  anteriores se sirven enteras hasta que se resuban.
- Los rangos de precio están hardcodeados y no se ajustan al catálogo real.
- **`CATEGORIAS` y el `CHECK` de la base tienen que decir lo mismo.** Son ocho chips
  —`Todos`, `Anillos`, `Collares`, `Aretes`, `Topos`, `Pulseras`, `Dijes`, `Juegos`— y el
  riel ya scrollea en horizontal, así que caben; lo que no cabe es añadir uno aquí y
  olvidar la migración: el panel dejaría escoger la categoría y la base rechazaría el
  guardado (ver `20260830_topos_y_juegos.sql`).
- **`Topos` va aparte de `Aretes`** aunque un topo sea un arete, y **`Juegos`** son los
  combos de dije con topos o aretes. Antes de existir, los juegos entraban donde cupieran:
  había tres archivados en `Anillos`.
- El botón flotante de WhatsApp se oculta en esta ruta a propósito.

## Cómo probarlo

```bash
npm run dev   # http://localhost:5173/catalogo
```

1. **Los cuatro estados vacíos.** Buscar un término imposible ("xyz"); combinar filtros
   que no dejen nada; entrar a una categoría sin piezas (Aretes). Cada uno debe dar un
   mensaje distinto y un botón primario coherente.
2. **Focus trap:** abrir filtros, recorrer con Tab hasta el final — el foco debe volver al
   principio, no salirse al fondo. Escape cierra y el foco vuelve al botón "Filtros".
3. Con la red cortada, el estado vacío debe ser el de fallo, no el de "sin resultados".
4. Buscar algo inexistente y pulsar el CTA de WhatsApp: el mensaje debe traer el término.
