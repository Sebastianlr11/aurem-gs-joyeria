# Panel — catálogo de piezas

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/admin?tab=products`

## Qué resuelve

Publicar, editar y retirar piezas. Y, sobre todo, **subir fotos que sirvan en los dos
sitios donde se usan**: la web y WhatsApp — que no aceptan el mismo formato.

## Cómo funciona hoy

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/admin/Dashboard.jsx:1034` | `ProductsSection` — listado, filtros, paginación (12) |
| `src/pages/admin/Dashboard.jsx:1070-1087` | Exportar el catálogo a CSV |
| `src/pages/admin/ProductModal.jsx` | Alta y edición (605 líneas, 6 secciones con riel) |
| `src/pages/admin/ProductModal.jsx:33-44` | Corrección del `numeric` "550000.00" |
| `src/pages/admin/ProductModal.jsx:172-185` | Subida optimizada en el navegador |
| `src/pages/admin/EliminarPieza.jsx` | Borrado con fricción (183 líneas) |
| `src/lib/optimizarFoto.js` | `versionesDeFoto()` — WebP + gemela JPEG |

### Tablas y Storage

- **`products`** — `name`, `description`, `price`, `compare_price`, `category`, `metal`,
  `piedra`, `engaste`, `talla_rango`, `images[]`, `image_url`, `stock`, `costo`,
  `costo_provisional`, `is_new`, `is_featured`.
- **Storage `product-images`** — bucket **público**.

### Variables de entorno

Ninguna propia.

## Decisiones tomadas y por qué

**Cada foto se guarda dos veces** (`src/lib/optimizarFoto.js:34-42`, incidente del 21 de
agosto de 2026):

| Versión | Para qué |
|---|---|
| `.webp` | La web — pesa menos |
| `.jpeg` (gemela) | **WhatsApp, que no acepta WebP** |

WhatsApp falla con un **200 engañoso**: la API responde correctamente y el mensaje
simplemente nunca llega. Fue caro de diagnosticar precisamente por eso.

> ⚠️ **Borrar las `.jpeg` deja a Valentina sin poder mandar fotos.** No son duplicados que
> limpiar: son la única versión que WhatsApp acepta.

**La optimización ocurre en el navegador, antes de subir** (`optimizarFoto.js`):
`createImageBitmap` + canvas, lado máximo 1600 px, calidad 0,82. Detalles que costaron:

- `imageOrientation: 'from-image'` (`:59-62`) — sin esto, las fotos de celular salían
  rotadas.
- Los GIF se saltan (`:53`).
- **Si la WebP no pesa menos que el original, se devuelve el original** (`:89`). Convertir
  por convertir a veces engorda el archivo.

**Borrar una pieza pide escribir su referencia `AG-####`** (`EliminarPieza.jsx:25, 42`). No
es ceremonia: un catálogo pequeño con nombres parecidos ("Anillo solitario", "Anillo
solitario clásico") hace fácil borrar el que no era. Además **cuenta los pedidos vivos que
contienen esa pieza, excluyendo `es_prueba`** (`:50-62`), y avisa antes.

**El precio se limpia al cargar** (`ProductModal.jsx:33-44`): Postgres devuelve `numeric`
como `"550000.00"` y el campo mostraba los decimales.

**El modal tiene 6 secciones con riel de navegación**, no un formulario largo: incluye
previsualización de precio y punzón, elección de portada y **tarjeta de margen** — el
joyero decide el precio viendo el margen, no después.

**`costo_provisional`** existe para poder publicar sin saber el costo exacto todavía; el
panel de pauta avisa de las piezas que lo tienen para no calcular retornos sobre supuestos.

## Límites conocidos y pendientes

- **Las fotos no se sirven optimizadas al visitante.** `ProductCard.jsx:51` y la galería de
  la ficha usan `<img>` crudo, sin `srcset` ni `width`/`height`. Se optimizan **al subir**,
  no **al entregar** — [pendientes #20](../pendientes.md).
- No hay reordenación por arrastre de las imágenes de una pieza.
- El borrado de una pieza **no borra sus archivos del Storage**: quedan huérfanos.
- `supabase-schema.sql` de la raíz no refleja las columnas reales de `products`
  ([pendientes #7](../pendientes.md)).

## Cómo probarlo

1. **Las gemelas:** sube una foto y comprueba en el bucket `product-images` que existen
   **`.webp` y `.jpeg`**. Después pídele a Valentina que mande esa pieza por WhatsApp:
   debe llegar la imagen.
2. **Orientación:** sube una foto tomada con el celular en vertical. No debe rotarse.
3. **Archivo que no mejora:** sube un JPG ya muy comprimido. Debe conservarse el original,
   no una WebP más pesada.
4. **Fricción de borrado:** intenta borrar escribiendo mal la referencia — no debe dejar.
   Con la referencia correcta y un pedido vivo asociado, debe avisar antes.
5. **Precio:** edita una pieza y comprueba que el campo dice `550000`, no `550000.00`.
6. **CSV:** exporta el catálogo y ábrelo — las tildes deben verse bien.
