# Ficha de producto

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/catalogo/:id` · `src/pages/ProductPage.jsx` (1.429 líneas)

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
| `products` | `select('*').eq('id')` — consume `images[]`, `piedra`, `engaste`, `talla_rango`, `compare_price`, `is_featured`, `stock` |
| `products` | Relacionadas: `.eq('category').neq('id').limit(3)` |
| `envio_publico` (vista) | `abono_envio`, `tope_contraentrega` — para el checkout |

### Variables de entorno

`VITE_MP_PUBLIC_KEY` — `initMercadoPago` se ejecuta **al importar esta página**
(`:13`), no en `App`.

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
