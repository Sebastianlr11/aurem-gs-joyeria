# Ficha de producto

> **Estado:** en producción
> **Última revisión:** 2026-08-30
> **Ruta:** `/catalogo/:id` · `src/pages/ProductPage.jsx` (1.543 líneas)

## Qué resuelve

Es **la pantalla donde se decide la compra**. Todo lo demás del sitio existe para traer
gente aquí. El trabajo de esta pantalla es contestar tres preguntas en orden: ¿es real
esta joya?, ¿es mi talla?, ¿cómo pago?

## Cómo funciona hoy

### Flujo

```
/catalogo/:id
  ├── products.select('*').eq('id', id).single()
  ├── pixelVerPieza(pieza)          ← con los datos ya cargados
  ├── ponerMeta + ponerProductoJsonLd
  ├── relacionadas: misma categoría, distinta pieza, limit 3
  └── "Lo quiero" → <BuyModal>      → ver checkout-y-pagos.md
```

Va **sin Navbar** (decidido en `src/App.jsx:98-101`): la píldora de navegación le quitaba
sitio a la pieza sin ofrecer nada necesario. La vuelta es el botón sobre la foto.

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/ProductPage.jsx:883-887` | Carga de la pieza |
| `src/pages/ProductPage.jsx:901-906` | Piezas relacionadas |
| `src/pages/ProductPage.jsx:921-935` | Meta + JSON-LD, con limpieza en el `return` |
| `src/pages/ProductPage.jsx:686-863` | `Gallery` — fade, swipe, lightbox, miniaturas |
| `src/pages/ProductPage.jsx:22-57` | `useCountdown` — la cuenta atrás de oferta |
| `src/pages/ProductPage.jsx:951-967` | Barra fija de compra con `IntersectionObserver` |
| `src/pages/ProductPage.jsx:1005-1009` | Selector de talla (sólo Anillos) |
| `src/pages/ProductPage.jsx:1012` | Referencia `AG-####` |
| `src/pages/ProductPage.jsx:1019-1020` | Punzón de ley por regex sobre `metal` |
| `src/pages/ProductPage.jsx:142-662` | `BuyModal` → [checkout-y-pagos.md](checkout-y-pagos.md) |

### Tablas y columnas

| Tabla | Uso |
|---|---|
| `products` | `select('*').eq('id')` — consume `images[]`, `piedra`, `talla_rango`, `compare_price`, `is_featured`, `stock` |
| `products` | Relacionadas: `.eq('category').neq('id').limit(3)` |
| `envio_publico` (vista) | `abono_envio`, `tope_contraentrega` — para el checkout |

### Variables de entorno

`VITE_MP_PUBLIC_KEY` — `initMercadoPago` se ejecuta **al importar esta página**
(`:13`), no en `App`.

### La foto es el LCP, y se pide antes de que exista el `<img>`

Medido con PageSpeed el 30 de agosto de 2026: **LCP 2,9 s**, con el aviso «la solicitud no
se puede descubrir en el documento inicial». El adelanto del `<head>` ya traía los **datos**
de la pieza a los 225 ms, pero el navegador no sabía que había una foto hasta bajar el
bundle, bajar el trozo de la ficha, ejecutarlo y pintar el `<img>` — sobre el segundo 1,5.
Ahí recién empezaba a bajar los 57,8 KB de la foto, y terminaba a los 2,9 s. La cuenta
cuadraba con lo que se veía: FCP 1,6 s, LCP 2,9 s.

Ahora ese mismo `<script>` inyecta un `<link rel="preload" as="image">` en cuanto llega el
JSON. Medido en el navegador con 4× de CPU: la foto pasa de pedirse a los **1.861 ms** a
pedirse a los **835**, y el LCP deja de ir 1,3 s detrás del FCP para ir 16 ms detrás.

**Es una tercera copia de la misma regla** —`fotoProducto()`, el `sizes` del `<img>` y el
HTML— y ahí está el peligro: si dejan de coincidir, el navegador precarga un archivo y
pinta otro, o sea que **la foto se baja dos veces sin que nada falle**.
`src/lib/fotoProducto.test.js` saca la función del HTML y la corre contra la de verdad; el
`sizes` vive una sola vez, en `TAMANOS_FICHA`.

La precarga va **sin `href`**: con `imagesrcset` el navegador que lo entiende elige de ahí,
y el que no —Safari viejo— usaría el `href` y se bajaría un archivo que el `<img>` no va a
pintar. Sin `href`, ése simplemente ignora la precarga.

### La foto NO está sobredimensionada, aunque Lighthouse lo diga

«Mejora la entrega de imágenes — ahorro estimado de 36 KiB»: el archivo (717×800) sería más
grande de lo necesario para sus dimensiones de visualización (461×461). **Es un falso
positivo**, y la trampa está en las unidades: 717 y 800 son 412 y 461 multiplicados por el
1,75 de densidad del Moto G que Lighthouse emula. Compara píxeles de pantalla contra
píxeles CSS, así que con cualquier densidad mayor que 1 el archivo siempre parece grande.

Medido con la caja real en cuatro aparatos, contando el recorte de `object-fit: cover` —que
en una foto cuadrada hace mandar el lado **mayor** de la caja, no el ancho—:

| Aparato | Caja CSS · densidad | Necesita | Baja | |
|---|---|---|---|---|
| Moto G Power (Lighthouse) | 412×461 · 1,75 | 807 px | 800 (56,4 KB) | falta 1 % |
| iPhone 14/15 | 390×470 · 3 | 1.410 px | 1.254 (106,8 KB) | falta 11 % |
| Galaxy A típico | 412×470 · 2,625 | 1.234 px | 1.254 | sobra 2 % |
| Escritorio 1440 | 720×900 · 2 | 1.800 px | 1.254 | falta 30 % |

La escalera `[400, 800]` más el original está bien calibrada; si algo le pasa es que **se
queda corta arriba**. Un peldaño de 600 no lo pediría ningún aparato —el Moto G necesita
807 y seguiría eligiendo el de 800— y resubir las fotos por este aviso sería trabajo para
nada.

Dos apuntes para quien vuelva a medirlo: `img.naturalWidth` **no sirve**, porque con
descriptores `w` el navegador le aplica la corrección de densidad y devuelve el tamaño a
1×; el tamaño real está en el nombre del archivo. Y hay que emular la densidad de verdad
(`Emulation.setDeviceMetricsOverride` con `deviceScaleFactor`), no sólo el ancho.

### El botón de volver estaba mudo en celular

`.pg-volver` lleva el texto «Volver al catálogo», pero en el celular
`.ficha-hero .pg-volver-txt` lo apaga con `display: none` y el enlace se queda siendo un
círculo con una flecha. Para un lector de pantalla y para un agente eso es «enlace, sin
nombre»: era el único fallo de accesibilidad de la pantalla (96/100) y también el de
«Navegación con agentes» (1/2). Se arregla con `aria-label`, que sobrevive a que el CSS
esconda el texto.

### Dónde quedó

**De 95 a 96–97 en PageSpeed móvil**, el 30 de agosto de 2026, y **accesibilidad de 96 a
100** con «Navegación con agentes» de 1/2 a 2/2 — esas dos las subió el mismo `aria-label`.

Lo que valió cada cosa, para no repetir el intento equivocado:

| | |
|---|---|
| Precargar la foto desde el `<head>` | La foto pasa de pedirse a los 1.861 ms a pedirse a los 730, y el LCP deja de ir medio segundo detrás del FCP |
| Quitar de `app.html` la precarga del hero | 20 KB a máxima prioridad que competían con la foto que sí era el LCP, en todas las rutas que no son la portada |
| `aria-label` en el botón de volver | Accesibilidad y agentes, de un tirón |
| ~~Meter la hoja de estilos en el HTML~~ | **Se revirtió**: bajó a 93. Ver «Lo que NO funcionó» en [`diseno-y-frontend.md`](diseno-y-frontend.md) |

**Y por qué esta pantalla no llega al 100 como la portada:** la portada se prerenderiza y no
depende de nada para pintarse. La ficha no puede —su contenido es distinto por pieza—, así
que su HTML es la raíz de una cadena: HTML → JSON de la pieza → foto → pintado. El adelanto
del `<head>` acorta esa cadena todo lo que se puede sin cambiar cómo se sirve la página, y
lo que queda es el tiempo de bajar y ejecutar React.

Lo que **no** hay que seguir intentando, con su porqué escrito arriba: resubir las fotos por
el aviso de «entrega de imágenes» (falso positivo de unidades) y meter el CSS en el HTML
(empuja la ficha fuera de un solo viaje de red). Si algún día se vuelve a atacar el LCP de
aquí, lo que queda en pie es servir la ficha ya pintada desde una función de Vercel — y eso
mete una función en el camino de cada visita a una pieza, cuando hoy ese HTML sale del CDN
en 65 ms.

## Decisiones tomadas y por qué

**Mercado Pago se inicializa aquí y no en `App`** (razón en `:7-12`): cargarlo en la
portada costaba **1.740 ms** a gente que la mayoría de las veces no iba a comprar. Sólo se
paga ese coste al abrir una ficha.

**El punzón no se inventa.** `:1019-1020` saca 925 / 750 / 18k / PT950 con una regex sobre
`product.metal`. **Si la pieza no tiene metal, no se muestra punzón** — antes que
adornar la ficha con una ley que nadie verificó, se deja el hueco.

**La talla no viaja al checkout** (documentado en `:1002-1004`). Se elige en la ficha, se
usa para el mensaje de WhatsApp, y ahí muere. En el flujo de Mercado Pago no hay dónde
ponerla sin ensuciarlo. Los pedidos multi-pieza sí llevan talla por pieza, pero esos entran
por `create-preference` con `items[]`, no por este selector. Las tallas 5–12 son un array
fijo, no vienen de `talla_rango`.

**La barra fija de compra sólo aparece cuando el botón real sale de pantalla**
(`:951-967`, `IntersectionObserver` con `rootMargin: '0px 0px -88px 0px'`), y **cae a
visible si el navegador no tiene la API**: mejor una barra de más que una ficha sin forma
de comprar.

**La galería detecta dominancia horizontal antes de tratar un gesto como swipe**
(`:706-723`, umbral de 45 px). Sin eso, un scroll vertical con el dedo ligeramente inclinado
cambiaba de foto.

**El enlace de pago es un `<a href>` sin `target="_blank"`** (`:618`, razón en `:612-617`),
no el widget `Wallet` del SDK.

**`?buy=1` abre el checkout automáticamente** (`:937-941`): así un enlace mandado por
WhatsApp lleva directo a pagar.

**`pixelIniciarPago` se dispara antes de llamar al servidor** (`:224-225`), a propósito:
la intención ya ocurrió aunque la creación de la preferencia falle.

## Límites conocidos y pendientes

- **La cuenta atrás se reinicia sola.** `useCountdown` (`:35-38`) guarda el final en
  `localStorage` con clave `offer_end_<id>` y, al llegar a cero, **fija otras 24 h**. Sólo
  se pinta si `compare_price > price`, así que el descuento es real; lo perpetuo es la
  urgencia. Decisión de negocio pendiente — [pendientes #22](../pendientes.md).
- **`Wallet` se importa y nunca se usa** (`:5`). Peso muerto.
- **La galería no optimiza imágenes** (`:771`): `<img>` crudo sin `srcset` ni dimensiones.
- `ponerProductoJsonLd` trata `stock === null` como `InStock` (`meta.js:125-128`).
- Quedan **tres capas de CSS** conviviendo para esta pantalla (`.ficha-*`,
  `.product-page-*` y una reescritura al final de `index.css`). Las `.product-page-*`
  sobreviven porque el esqueleto de carga y el "no encontrado" todavía las usan.

## Cómo probarlo

```bash
npm run dev   # http://localhost:5173/catalogo/<uuid>
```

1. **Punzón:** una pieza sin `metal` no debe mostrar ninguno; una con "Oro 18k" debe decir 18k.
2. **Talla:** sólo debe aparecer en categoría `Anillos`.
3. **Barra fija:** al hacer scroll más allá del botón "Lo quiero", debe aparecer; al subir,
   desaparecer.
4. **Swipe:** en móvil, un scroll vertical no debe cambiar de foto; uno horizontal sí.
5. **Cuenta atrás:** borra `localStorage.offer_end_<id>`, recarga, y comprueba que sólo se
   pinta si la pieza tiene `compare_price` mayor que `price`.
6. **Compartir:** pega la URL en WhatsApp — debe salir la foto y el nombre de la pieza
   (eso lo sirve `api/ficha.js`, ver [seo-y-compartir.md](seo-y-compartir.md)).
7. `?buy=1` en la URL debe abrir el modal de compra solo.
