# Panel — pedidos

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/admin?tab=orders`

## Qué resuelve

Llevar un pedido desde que entra hasta que llega a manos del cliente, y **que el panel diga
en cada paso cuál es la siguiente acción** — que no es la misma según cómo se pague.

## Cómo funciona hoy

### La máquina de estados, que es doble

`status` ∈ `pendiente | pagado | procesando | enviado | entregado | cancelado`

La acción sugerida depende del método de pago (`Dashboard.jsx:26-40`):

| Constante | Para |
|---|---|
| `NEXT_ACTION_PREPAID` | Pago en línea — la plata ya entró, toca fabricar y despachar |
| `NEXT_ACTION_COD` | Contraentrega — falta cobrar en la puerta, "entregado" implica cobro |

En contraentrega, `enviado` **no** significa cobrado (ver [checkout-y-pagos.md](checkout-y-pagos.md)).

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/admin/Dashboard.jsx:1373` | `OrdersSection` |
| `src/pages/admin/Dashboard.jsx:26-40` | Las dos tablas de acción sugerida |
| `src/pages/admin/Dashboard.jsx:57` | `WA_MESSAGES` — mensaje de WhatsApp por estado |
| `src/pages/admin/Dashboard.jsx:130` | `fireWebhook` — webhook propio configurable |
| `src/pages/admin/Dashboard.jsx:244` | `ShipModal` — transportadora + número de guía |
| `src/pages/admin/Dashboard.jsx:1778` | Borrar pedido |
| `src/pages/admin/PedidoModal.jsx` | Registrar un pedido a mano (443 líneas) |
| `src/pages/admin/PedidoModal.jsx:32-58` | `PAGOS` — qué implica cada método |
| `src/pages/admin/PedidoModal.jsx:189-203` | Inserta en `orders` y dispara `conversion-pedido` |
| `supabase/functions/correo-despacho/index.ts` | Correo de "va en camino" |
| `supabase/functions/conversion-pedido/index.ts` | Conversiones de un pedido manual |

### Tablas

- **`orders`** — lectura con `piezas:order_items(...)` embebido, más `update` y `delete`.
- **`order_items`** — las piezas, con precios congelados.

### Variables de entorno

`META_CAPI_TOKEN`, `TIKTOK_ACCESS_TOKEN` (`conversion-pedido`) ·
`CORREO_SECRETO`, `APP_URL` (`correo-despacho`).

## Decisiones tomadas y por qué

**La acción sugerida se bifurca por método de pago.** Es la traducción a la interfaz de la
regla de `dinero.js`: en contraentrega, mover a `enviado` **no cierra el cobro**, y el panel
no debe sugerir que sí.

**Los mensajes de WhatsApp por estado están preparados** (`WA_MESSAGES`, `:57`): cambiar un
pedido de estado ofrece el enlace con el texto ya escrito. La mayoría de los clientes están
en WhatsApp, no en el correo.

**Los pedidos manuales existen porque la mayoría de las ventas no pasan por la web.** Entran
conversando. `PedidoModal` los registra con el mismo formato, así el panel cuenta todo.

**El costo del pedido se pide sólo al editar, nunca al crearlo.** Es la misma razón por la
que la guía tampoco se pide al crear: cuando el pedido nace, nadie sabe todavía qué va a
costar. El costo del taller —con el oro del día— y el del flete se anotan al despachar, en
la sección «Lo que costó», y quedan **congelados en ese pedido** igual que el precio se
congela en `order_items`. Un pedido viejo no cambia de margen porque hoy suba el oro.

Antes esto vivía en el catálogo, como un costo fijo por pieza. No se podía mantener, así
que se llenaba de estimaciones y el panel terminaba avisando de que sus propios márgenes
eran de relleno. Ver `supabase/migrations/20260823_costos_del_pedido.sql`.

**`PedidoModal` nombra lo que falta antes de intentar guardar** (el pie del modal), en vez
de rechazar al pulsar. Y **explica qué implica cada método de pago** (`PAGOS`, `:32-58`) en
la misma pantalla donde se elige: quien registra el pedido no tiene por qué recordar que
contraentrega arrastra abono y tope.

**Un pedido manual también dispara conversiones** (`:203` → `conversion-pedido`). Si no, las
ventas por WhatsApp —que son la mayoría— serían invisibles para Meta y TikTok, y el
algoritmo optimizaría contra una fracción de la realidad.

**El despacho pide transportadora y guía juntas** (`ShipModal`, `:244`), y desde ahí sale el
correo `pedido-despachado`. Un despacho sin guía es un cliente preguntando "¿y mi pedido?".

**Hay un webhook propio configurable** (`fireWebhook`, `:130`) para conectar el panel con
herramientas externas sin tocar código.

## Límites conocidos y pendientes

- No hay historial de cambios de estado: sólo `status_updated_at`, el último.
- El borrado de un pedido no está protegido con la fricción de escribir la referencia, como
  sí lo está el de piezas y chats.
- La talla elegida en la ficha pública **no llega** al pedido; sólo la traen los pedidos con
  `items[]` (WhatsApp y manuales).
- Los estados no se validan como transiciones: se puede saltar de `pendiente` a `entregado`.
- `orders` **no está versionada** en migraciones más allá de las columnas añadidas
  ([pendientes #4](../pendientes.md)).

## Cómo probarlo

**Marca siempre los pedidos de prueba con `es_prueba`** — si no, contaminan el dashboard y
pueden quemar plantillas de WhatsApp.

1. **Bifurcación:** crea dos pedidos idénticos, uno prepago y otro contraentrega. La acción
   sugerida debe ser distinta en el mismo estado.
2. **Contraentrega en `enviado`:** el panel debe seguir mostrando saldo por cobrar.
3. **Pedido manual:** regístralo y comprueba en los logs de `conversion-pedido` que salieron
   los eventos a Meta y TikTok.
4. **Despacho:** marca uno como enviado con transportadora y guía. Debe llegar el correo
   `pedido-despachado` con el número.
5. **Multi-pieza:** un pedido con dos anillos de tallas distintas debe mostrar las dos
   tallas, cada una con su pieza.
6. **Validación de `PedidoModal`:** deja campos vacíos — el pie debe nombrarlos antes de que
   pulses guardar.
