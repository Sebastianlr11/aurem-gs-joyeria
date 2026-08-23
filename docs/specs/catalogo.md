# Catálogo

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/catalogo` · `src/pages/Catalog.jsx` (658 líneas)

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

## Límites conocidos y pendientes

- **No escala.** Una consulta que trae el catálogo entero deja de funcionar a partir de
  unos cientos de piezas.
- **Las tarjetas ya optimizan imagen** desde el 23 de agosto: `srcset`, `sizes`,
  `width`/`height` y `decoding="async"` vía `src/lib/fotoProducto.js`. Con la salvedad de
  que una foto sólo entra en el juego de tamaños si se subió con el tratamiento nuevo; las
  anteriores se sirven enteras hasta que se resuban.
- Los rangos de precio están hardcodeados y no se ajustan al catálogo real.
- `CATEGORIAS` incluye `Dijes`, y el `CHECK` real de la base **sí lo contempla** (ver
  `20260228_esquema_base.sql`); era el `supabase-schema.sql` viejo el que no — el
  esquema de la raíz está obsoleto, no la lista.
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
