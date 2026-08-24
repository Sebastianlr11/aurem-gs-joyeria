# Atribución y píxeles

> **Estado:** en producción
> **Última revisión:** 2026-08-23

## Qué resuelve

Saber **qué anuncio trajo cada venta**, para no quemar pauta a ciegas.

Es más difícil de lo que parece por tres razones propias de este negocio:

1. **Mucha gente nunca vuelve al sitio.** Paga desde el enlace que Valentina le mandó por
   WhatsApp, o cierra la pestaña. El píxel del navegador no ve esa venta.
2. **Contraentrega separa el pedido del pago por días**, y las plataformas sólo atribuyen
   dentro de una ventana de 7 días desde el clic.
3. **TikTok no manda identificador de clic hacia WhatsApp.** Meta sí (`ctwa_clid`).

## Cómo funciona hoy

### Las dos vías, deduplicadas

```
NAVEGADOR                          SERVIDOR
capturarClic()                     create-preference → avisarVenta('pedido')
  guarda en localStorage 7 días        → Meta CAPI + TikTok  (InitiateCheckout)
pixelPagina / pixelVerPieza
pixelIniciarPago                   mp-webhook → avisarVenta('compra')
pixelCompra(pedidoId) ─────────┐       → Meta CAPI + TikTok  (Purchase)
                               │           │
                    eventID = pedidoId ────┘
                    (misma venta, no dos)
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/lib/atribucion.js:30` | Vigencia de **7 días**, alineada con la ventana de `fbc` de Meta |
| `src/lib/atribucion.js:52-78` | `capturarClic()` |
| `src/lib/atribucion.js:64` | **Si no hay identificador nuevo, no toca lo guardado** |
| `src/lib/atribucion.js:101-125` | `datosDeAtribucion()` |
| `src/lib/atribucion.js:104-107` | Prefiere la cookie `_fbc`; si no, la sintetiza |
| `src/lib/atribucion.js:113-117` | Incluye `navigator.userAgent` |
| `src/lib/atribucion.js:134-141` | `origenCorto()` para el `[ref:]` de WhatsApp |
| `src/lib/pixeles.js:13-14, 23-24` | Sin variable de entorno, no carga nada |
| `src/lib/pixeles.js:59-60` | `fbq('set','autoConfig',false,…)` **antes** del `init` |
| `src/lib/pixeles.js:163-170` | Guardia anti-doble-conteo en `sessionStorage` |
| `src/lib/pixeles.js:180, 185` | `eventID` / `event_id` para deduplicar |
| `supabase/functions/_shared/conversiones.ts` | Meta CAPI y TikTok Events API (393 líneas) |
| `src/lib/whatsapp.js:32-38` | El `[ref: …]` escrito en el mensaje |

### Qué se guarda en `orders`

`ttclid`, `ttp`, `fbc`, `fbp`, `client_ua`, `client_ip`, `ctwa_clid`, `anuncio_id`,
`utm_source`, `utm_campaign`.

En `whatsapp_conversaciones`, el objeto `referral` completo que manda Meta.

### Variables de entorno

Navegador: `VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID` — **no están en `.env.local`**, así
que en local los píxeles quedan apagados a propósito.
Servidor: `META_PIXEL_ID`, `META_CAPI_TOKEN`, `TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`.

## Decisiones tomadas y por qué

**Se mide desde el navegador y desde el servidor, y se deduplica por `event_id`**
(`conversiones.ts:1-14`). El píxel sólo dispara la compra si el cliente **vuelve** a la
página de confirmación. Mucha gente no vuelve. El webhook de Mercado Pago, en cambio, se
entera siempre. El `pedidoId` es el mismo en ambas vías, y eso es lo que le dice a Meta y a
TikTok que es **una** venta, no dos.

**El evento de "se comprometió" sale al crear el pedido, no al cobrar.** Con contraentrega,
el pago llega días después y caería **fuera de la ventana de 7 días**: buena parte de las
ventas no se le acreditaría a ningún anuncio. Peor: el algoritmo necesita decenas de
conversiones para dejar de tantear, y con una semana de retraso aprende de lo que pasó hace
una semana. Por eso es `InitiateCheckout` y no `Purchase`; el `Purchase` sale con el dinero
real.

**El correo y el teléfono se mandan cifrados con SHA-256** (`conversiones.ts:15-21`).
**No sale** el nombre, ni la dirección de entrega, ni nada del medio de pago. La IP y el
user-agent sí van en claro porque **ambas plataformas los exigen**: Meta descarta el evento
web que llega sin user-agent.

**`capturarClic` no borra lo guardado si la visita no trae identificador** (`:64`). Alguien
que hizo clic en un anuncio anteayer y hoy entra escribiendo la URL a mano **sigue
atribuido** a ese anuncio. Sin esta regla, la segunda visita borraba el origen de la
primera.

**La ventana es de 7 días** (`:30`) para coincidir con la de `fbc` de Meta. Guardar más
tiempo produciría atribuciones que la plataforma ya no acepta.

**Si no hay cookie `_fbc`, se sintetiza** como `fb.1.<momento>.<fbclid>` (`:104-107`): es el
formato que Meta espera y permite atribuir aunque la cookie no se haya escrito.

**Se apaga `autoConfig` de Meta antes del `init`** (`pixeles.js:59-60`): la recolección
automática de clics manda eventos que nadie pidió y ensucia la medición.

**Nada carga si falta la variable de entorno** (`:13-14`). Es lo que mantiene la medición
limpia en desarrollo.

**Guardia anti-doble-conteo en `sessionStorage`** con clave `compra-medida-<pedidoId>`
(`:163-170`). Recargar la página de confirmación disparaba otra compra. **Falla abierto en
navegación privada** — se prefiere un duplicado ocasional a perder la medición.

**El `[ref: …]` en el mensaje de WhatsApp** (`whatsapp.js:32-38`) es la respuesta al
problema de TikTok: no manda nada equivalente al `ctwa_clid` de Meta, así que **la única
forma de saber de dónde viene un chat es anotarlo en el propio texto**.

## Límites conocidos y pendientes

- ⚠️ **Hay dos píxeles de Meta con el mismo nombre y sólo uno recibe eventos.** Antes de
  concluir que una campaña no convierte, **verifica el ID**. Es la trampa que más tiempo ha
  costado en este proyecto.
- El `[ref:]` de TikTok es visible para el cliente en su propio mensaje.
- `client_ip` se toma del primer valor de `x-forwarded-for`; detrás de ciertos proxis puede
  no ser la del cliente.
- No hay panel que compare lo que reporta Meta con lo que dice `revenue_por_fuente`.
- La guardia anti-doble-conteo no funciona en navegación privada.

## Cómo probarlo

1. **Deduplicación (lo más importante):** haz una compra completa volviendo a
   `/confirmacion`. En el Events Manager de Meta debe verse **una** compra, marcada como
   deduplicada entre navegador y servidor — no dos.
2. **El píxel correcto:** confirma el ID que está recibiendo eventos y compáralo con
   `VITE_META_PIXEL_ID` y `META_PIXEL_ID`. Deben ser el mismo, y el que de verdad recibe.
3. **Persistencia:** entra con `?ttclid=abc`, cierra, vuelve a entrar sin parámetros y
   compra. El pedido debe conservar `ttclid = abc`.
4. **No borrar:** tras lo anterior, entra con `?utm_source=x` sin `ttclid`. El `ttclid`
   guardado **no debe perderse**.
5. **Sin variables:** en local, sin `VITE_META_PIXEL_ID`, no debe cargarse ningún script de
   Meta (mira la pestaña de red).
6. **Anti-doble-conteo:** recarga `/confirmacion` varias veces. Sólo debe medirse una compra.
7. **WhatsApp:** entra desde TikTok y pulsa cualquier botón de WhatsApp. El mensaje debe
   acabar en `[ref: tiktok]`.
8. **Privacidad:** revisa el cuerpo que sale en `conversiones.ts` — **no debe llevar nombre
   ni dirección**.
