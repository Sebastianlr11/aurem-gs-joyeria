# Panel — pedidos

> **Estado:** en producción
> **Última revisión:** 2026-08-23
> **Ruta:** `/admin?tab=orders`

## Qué resuelve

Llevar un pedido desde que entra hasta que llega a manos del cliente, y **que el panel diga
en cada paso cuál es la siguiente acción** — que no es la misma según cómo se pague.

## Cómo funciona hoy

### La máquina de estados, que es doble

`status` ∈ `pendiente | pagado | procesando | enviado | entregado | cancelado`

La acción sugerida depende del método de pago (`secciones/Pedidos.jsx`):

| Constante | Para |
|---|---|
| `NEXT_ACTION_PREPAID` | Pago en línea — la plata ya entró, toca fabricar y despachar |
| `NEXT_ACTION_COD` | Contraentrega — falta cobrar en la puerta, "entregado" implica cobro |

En contraentrega, `enviado` **no** significa cobrado (ver [checkout-y-pagos.md](checkout-y-pagos.md)).

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/admin/secciones/Pedidos.jsx` | La pantalla entera |
| `src/pages/admin/secciones/Pedidos.jsx` | `NEXT_ACTION_COD` y `NEXT_ACTION_PREPAID`, las dos tablas de acción sugerida |
| `src/pages/admin/secciones/Pedidos.jsx` | `WA_MESSAGES` — mensaje de WhatsApp por estado |
| `src/pages/admin/secciones/comunes.js` | `fireWebhook` — webhook propio configurable, y `despacharPedido` |
| `src/pages/admin/secciones/piezas.jsx` | `ShipModal` y `StatusConfirmModal` |
| `src/pages/admin/secciones/Pedidos.jsx` | Borrar pedido |
| `src/pages/admin/PedidoModal.jsx` | Registrar un pedido a mano (527 líneas) |
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

## El circuito de un pedido

Los dos caminos, con quién mueve cada paso y qué dispara. **Ésta es la fuente de verdad**:
si el código y esto no cuadran, gana esto y hay que arreglar el código.

```
EN LÍNEA       pendiente ──► pagado ──► procesando ──► enviado ──► entregado
                                                              └──► devuelto

CONTRAENTREGA  pendiente ──► confirmado ──► procesando ──► enviado ──► entregado
                            (paga el abono)                       └──► devuelto

                        cualquiera ──► cancelado   (nunca salió)
```

| Estado | Se lee | Qué significa | Quién lo pone | Qué dispara |
|---|---|---|---|---|
| `pendiente` | Pendiente | El pedido existe y **nadie ha pagado nada** | El checkout, o a mano en el panel | Plantilla `pago_pendiente` si se queda ahí |
| `confirmado` | Confirmado | **Abonó el envío.** Hay compromiso; el taller no ha empezado | `mp-webhook`, solo, al entrar el abono | Anota el abono · plantilla `pedido_confirmado_abono` |
| `pagado` | Pagado | Entró el importe completo | `mp-webhook`, solo | Anota la venta · avisa a Meta y TikTok |
| `procesando` | **Fabricando** | El taller **está haciendo la pieza** | Una persona, «Empezar a fabricar» | Plantilla `pieza_en_fabricacion`, en la siguiente corrida del cron |
| `enviado` | Enviado | Va con la transportadora | Una persona, «Marcar enviado» + guía | Correo con rastreo · plantilla `pedido_en_camino` |
| `entregado` | Entregado | Llegó. En contraentrega, **además cobraste** | Una persona, «Marcar entregado» | En contraentrega: anota el saldo y avisa a Meta y TikTok |
| `devuelto` | Devuelto | Salió, no se recibió y volvió | Una persona, «No la recibió» en la fila del pedido | El abono se queda · deja de haber saldo por cobrar · **no** se avisa a los anuncios |
| `cancelado` | Cancelado | **Nunca salió** | Una persona | — |

### Dónde lo lee quien trabaja

Esta tabla es la fuente de verdad, pero está donde no la va a leer quien tiene el panel
abierto y una clienta al teléfono. Así que el circuito se dice **tres veces, y las tres
salen del mismo sitio** —`src/lib/circuito.js`—, para que no puedan separarse:

1. **En cada fila de Pedidos**, bajo la insignia: `queFalta(pedido)`. La insignia dice
   *dónde* está; esta línea dice *qué falta*.
2. **En el diálogo de confirmar**, antes de pulsar: `loQuePasa(pedido, destino)`, con lo
   que va a ocurrir. Lo que mueve plata se ve distinto de un trámite.
3. **En Ajustes**, la guía completa (`GuiaDelCircuito.jsx`), que **no tiene texto propio**:
   arma los dos caminos llamando a las mismas dos funciones con un pedido de ejemplo. Una
   guía con su propia copia de las frases es una guía que va a mentir.

Si cambia lo que dispara un estado, se corrige en `circuito.js` y las tres pantallas se
enteran solas. Y `src/lib/circuito.test.js` fija las frases que hablan de dinero.

**Un aviso de honestidad:** el panel **no** devuelve la pieza al inventario cuando marcas
`devuelto`. Nadie mueve `products.stock` en todo el código y casi todas las piezas lo
tienen en `null`, porque el taller trabaja por encargo. Por eso la frase dice «vuelve a tus
manos: si le llevas inventario, ajústalo a mano».

### Tres cosas que no son obvias

**«Enviado» en contraentrega no es una venta cobrada.** El paquete va en camino y nadie ha
pagado el resto: los informes sólo cuentan el abono hasta que se marque entregado.

**«Devuelto» no es «cancelado», y la diferencia es plata.** Cancelado es *nunca pasó* y no
deja nada. Devuelto *pasó*, costó un flete y **dejó el abono**, que es exactamente para lo
que el abono existe. Además es el número que dice cuántos de cada diez vuelven, que en un
negocio de contraentrega decide si el negocio aguanta.

**Un pedido cargado a mano en el panel no pasa por `confirmado`.** Ese estado sólo lo pone
el abono al entrar; un pedido tomado por teléfono va de `pendiente` a `procesando` cuando
se le dice al taller que empiece.

### Por qué no se paga a medias

No existe el cobro parcial, y es una decisión del negocio: si la clienta no paga completo,
**el mensajero no entrega** y el pedido vuelve. Y si el mensajero cobra de menos, eso lo
responde la transportadora — por eso el envío va por una empresa y no por un conocido.

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

**Un pedido manual también dispara conversiones** (`secciones/comunes.js` → `conversion-pedido`). Si no, las
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
- Marcar `devuelto` no toca el inventario ni devuelve nada al cliente en pago en línea: las
  dos cosas se dicen en el aviso, pero se hacen a mano.
- ~~`orders` **no está versionada**~~ — se crea en `20260228_esquema_base.sql` desde el 23
  de agosto de 2026 ([pendientes #4](../pendientes.md)).

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
7. **El aviso del diálogo:** en un contraentrega en `enviado`, «Marcar entregado» tiene que
   decir cuántos pesos estás declarando cobrados, y verse sobre fondo de arena. En un
   prepago en el mismo estado, no: ahí es un trámite.
8. **La salida a `devuelto`:** «No la recibió» sólo aparece en pedidos `enviado`.
