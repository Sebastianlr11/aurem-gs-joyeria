# Checkout y pagos

> **Estado:** en producción
> **Última revisión:** 2026-08-24

## Qué resuelve

Cobrar. Dos caminos muy distintos:

1. **Pago en línea** con Mercado Pago, con **2% de descuento**.
2. **Contraentrega, sin abono** — el cliente **no paga nada por adelantado**: paga el
   precio publicado, completo y en efectivo, cuando recibe la pieza. Sólo Bogotá. Es la
   forma de pago principal del negocio: en Colombia mucha gente no compra joyería por
   internet pagando por adelantado a una marca que no conoce.

Todo lo raro de esta feature sale de la segunda. Contraentrega significa que **"pedido
confirmado" y "plata recibida" son dos hechos separados por días** — y desde el 1 de
septiembre de 2026, separados por el total: hasta que no se entrega, no ha entrado un peso.

**Hasta ese día se abonaba el envío** ($20.000) para confirmar. Se quitó al ver, con la
pauta encendida, que la gente se echaba atrás justo al llegar a ese cobro; y se pudo quitar
porque las entregas de Bogotá las hace el taller, así que el abono ya no estaba cubriendo el
viaje de ida y vuelta de un domiciliario. **La maquinaria del abono sigue entera**: es
`taller_precios.abono_envio = 0`, y volver a cobrarlo es un `UPDATE`.

## Cómo funciona hoy

### Flujo end-to-end

```
BuyModal (navegador)
  ├── lee envio_publico → abono_envio, tope_contraentrega
  ├── el cliente elige método y llena sus datos
  └── functions.invoke('create-preference', { product|items, buyer, paymentMethod, atribucion })
        │
        ├── valida y calcula el total
        ├── si es contraentrega:
        │     ├── total > tope  → rechaza con mensaje
        │     └── abono = taller_precios.abono_envio · HOY ES 0
        ├── INSERT orders + INSERT order_items (precios congelados)
        │     · con abono → status 'pendiente' (lo confirma el pago)
        │     · sin abono → status 'confirmado' (no hay nada que esperar)
        ├── avisarVenta({evento:'pedido'}) → Meta CAPI + TikTok como InitiateCheckout
        ├── SIN ABONO TERMINA ACÁ → { orderId, isCod, sinAbono: true, saldo }
        │     y el modal muestra la pantalla de pedido confirmado
        └── con abono, crea la preferencia de Mercado Pago
              · en línea:       un renglón por pieza
              · contraentrega:  UN SOLO renglón, el abono
        ↓ devuelve { preferenceId, initPoint, isCod, abono, saldo }
  └── <a href={initPoint}> → Mercado Pago

Mercado Pago cobra
  ↓
mp-webhook (Edge Function)
  ├── resuelve el aviso (IPN antiguo o webhook nuevo) → consulta el pago REAL contra la API de MP
  ├── candado: UPDATE ... WHERE conversion_enviada_en IS NULL   ← marca y lee a la vez
  ├── status = 'pagado' (total) | 'procesando' (sólo el abono)
  ├── avisarVenta({evento:'compra'})  → Meta + TikTok, Purchase con valor real
  ├── WhatsApp al cliente
  └── POST /api/correo → plantilla pedido-confirmado
  ↓
/confirmacion?payment_id=…&status=…&external_reference=<order_id>
  └── SÓLO LEE. Nunca escribe.
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/ProductPage.jsx:142-662` | `BuyModal` — máquina de estados `method → form → loading → wallet → error` |
| `src/pages/ProductPage.jsx:139` | `MP_DISCOUNT` — el 2% |
| `src/pages/ProductPage.jsx:179` | Lectura de `envio_publico` |
| `src/pages/ProductPage.jsx:192` | La opción contraentrega sólo se pinta si `price <= tope` |
| `src/pages/ProductPage.jsx:78-79` | `COD_CIUDAD` / `COD_DEPARTAMENTO` — contraentrega es sólo Bogotá |
| `src/pages/ProductPage.jsx:85-137` | 33 departamentos + ciudades como `<datalist>` sugerido |
| `supabase/functions/create-preference/index.ts:82-118` | Tope, abono y sus defensas |
| `supabase/functions/create-preference/index.ts:213-226` | `order_items` con precios congelados |
| `supabase/functions/create-preference/index.ts:272-282` | El renglón único del abono |
| `supabase/functions/mp-webhook/index.ts:147-152` | El candado anti-duplicado |
| `supabase/functions/mp-webhook/index.ts:127-138` | Pago total vs abono |
| `supabase/functions/mp-webhook/index.ts:333-363` | Resolver `merchant_order` → pago |
| `src/pages/Confirmacion.jsx:52` | `rpc('pedido_publico')` — 5 campos, sin datos personales |
| `src/lib/dinero.js` | **Cuánta plata hay de verdad detrás de un pedido** |

### Tablas y columnas

- **`orders`** — `status: 'pendiente'`, o `'confirmado'` si es contraentrega sin abono;
  `abono_monto` sólo en contraentrega **y sólo si hubo abono** (si no, `null`: dice «acá no
  hubo abono» y no «se abonaron cero pesos»);
  `conversion_enviada_en` es el candado; toda la atribución se guarda aquí.
- **`order_items`** — `order_id`, `product_id`, `nombre`, `precio`, `cantidad`, `talla`.
- **`taller_precios`** — `abono_envio`, `tope_contraentrega`. RLS restringido.
- **`envio_publico`** (vista) — expone **sólo** esos dos campos a `anon`.

### Variables de entorno

`VITE_MP_PUBLIC_KEY` (navegador) · `MP_ACCESS_TOKEN`, `APP_URL`, `CORREO_SECRETO`,
`SUPABASE_SERVICE_ROLE_KEY` (Edge Functions).

## Decisiones tomadas y por qué

**La vista `envio_publico` existe para no filtrar el margen.** El frontend necesita
`abono_envio` y `tope_contraentrega`, pero `taller_precios` también guarda el **recargo**,
que es el margen del negocio. La vista expone dos columnas y nada más.

**Si `tope_contraentrega` es `null`, la opción no se pinta.** Deliberado: ofrecer
contraentrega y retirarla después es peor que no ofrecerla.

**El candado real está en el servidor**, no en el navegador (`create-preference:104-110`).
El frontend esconde la opción; la Edge Function la rechaza con un mensaje que dice el tope.

**El abono tiene doble red de seguridad** (`:115-118`): si `abono_envio` viene inválido o
resulta mayor o igual que el total, cae a `min(20000, total/2)`. Viene de un incidente
real: **Valentina anunció un abono de "$15.000" y 50 segundos después mandó un enlace de
$20.000**. De ahí también la regla del prompt que repite la cifra exacta tres veces.

**Contraentrega cobra UN SOLO renglón por Mercado Pago** (`:272-282`), no las piezas. Si
se listaran las piezas, el cliente vería el total completo en la pasarela y creería que le
están cobrando todo. El renglón dice explícitamente: *"Se descuenta del total. Al recibir
pagas $X"*.

**El evento de anuncios se manda al crear el pedido, no al cobrar** (`:228-260`). En
contraentrega el pago llega días después, y **Meta y TikTok sólo atribuyen dentro de los 7
días desde el clic**. Si la única señal fuera el pago, buena parte de las ventas caería
fuera de la ventana y no se le acreditaría a ningún anuncio — y el algoritmo estaría
aprendiendo de lo que pasó hace una semana. Por eso es `InitiateCheckout` ("se
comprometió") y no `Purchase`. El `Purchase` sale cuando entra el dinero, con valor real.

**Los precios se congelan en `order_items`** (`:213-226`): *"un pedido es un hecho del
pasado, no una consulta al catálogo de hoy"*. Si esa inserción falla, **no se tumba la
venta** —el total ya está en `orders`— pero se registra el error, porque sin las filas el
correo enseña una pieza sola y el taller no sabe qué fabricar.

**Basta con correo O teléfono** (`:52-59`): los pedidos que entran por WhatsApp pueden no
traer correo, y bloquear la venta por eso *"sería cambiar plata por un dato"*.

**El candado anti-duplicado es un UPDATE que marca y lee a la vez**
(`mp-webhook:147-152`): `UPDATE … .is('conversion_enviada_en', null)`. Dos webhooks
simultáneos se serializan en la base; sólo uno recibe filas.

**`mp-webhook` acepta las dos formas de aviso** (IPN antiguo por URL y webhook nuevo por
cuerpo). Leer sólo una era descartar la mitad **con un 200**: el pago entra y el pedido
nunca se entera.

**`/confirmacion` sólo lee.** Antes marcaba `status='pagado'` desde el navegador con la
anon key: **cualquiera podía falsificar un pago escribiendo una URL** (`Confirmacion.jsx:23-35`).
Ahora el estado lo escribe el webhook y el valor de `pixelCompra` sale de la base, no de la
URL.

**Y lee por RPC, no por tabla** (`20260822_pedido_publico.sql`). `anon` no tiene lectura
sobre `orders`, así que la consulta directa devolvía `null` para una clienta real: la
página se quedaba sin resumen **y `pixelCompra()` nunca se disparaba**, porque está
condicionado a que el pedido exista. El `Purchase` del servidor sí salía desde
`mp-webhook`, pero la deduplicación entre los dos embudos estaba coja justo antes de
prender pauta. `pedido_publico(p_id)` es `SECURITY DEFINER` y devuelve **cinco columnas
contadas a mano** sobre lo que la pantalla usa: ni nombre, ni teléfono, ni correo, ni
dirección — **ni siquiera `status`**, porque la pantalla se guía por el parámetro de la URL
y darle el de la base sólo invitaría a usarlo.

**Los departamentos son un `<select>` cerrado; las ciudades un `<datalist>` sugerido**
(`:94-102`): una lista cerrada de municipios de Colombia sería enorme y siempre
incompleta.

## El precio lo pone el catálogo

`create-preference` es pública —CORS `*`, sin JWT, sin secreto— y hasta el 24 de agosto de
2026 **cobraba el precio que viniera en el cuerpo de la petición**. Con el id de una pieza,
que está en la URL del catálogo, se podía pedir un anillo de $4.500.000 por $1.000 y recibir
un enlace de Mercado Pago legítimo por esa cantidad. Ver
[pendientes #41](../pendientes.md).

Ahora consulta `products` y decide ella: acepta el precio del catálogo o hasta un 2% menos
—el único descuento que existe, el de pagar en línea— y fuera de ese rango cobra el del
catálogo. **Falla hacia cobrar de más**, que se reclama, y no hacia cobrar de menos, que se
pierde en silencio. El nombre de la pieza también sale del catálogo, porque acaba en la
plantilla de WhatsApp y en el correo.

El 2% vive en dos sitios: `MP_DISCOUNT` en `src/pages/ProductPage.jsx`, que es quien lo
anuncia, y `DESCUENTO_EN_LINEA` en `create-preference`, que es quien lo consiente. Si se
separan, gana el catálogo.

## Límites conocidos y pendientes

- ~~**`mp-webhook` no valida la firma de Mercado Pago.**~~ Resuelto el 23 de agosto:
  `firmaValida()` valida el `x-signature` con `MP_WEBHOOK_SECRET`, que ya está puesto.
  Sin firma o con firma falsa el endpoint responde 401. **Falla abierto si el secreto
  desaparece**, a propósito, para que un despliegue sin secreto no tumbe los pagos.
  [pendientes #3](../pendientes.md).
- ~~**El webhook del panel recibe 401 en cada aviso.**~~ **Resuelto el 23 de agosto, y el
  culpable era nuestro código, no el panel.**

  Un pago llegaba por dos caminos. El del **panel de Mercado Pago** —sección *Webhooks*,
  formato moderno `?data.id=…&type=payment`— trae firma verificable, responde **200** y es
  el que procesa: en el pago real quedó registrado como `payment.created · 200 Entregada`.
  El otro venía de **nuestra propia preferencia**: `create-preference` ponía
  `notification_url`, y eso **no configura un webhook sino una notificación IPN**, el
  mecanismo viejo, que llega como `?id=…&topic=payment` (más `topic=merchant_order`).

  La documentación de Mercado Pago lo dice sin rodeos: *"Las notificaciones IPN van a ser
  descontinuadas. Además, **a pesar de recibir el header `x-Signature`, no permiten la
  validación mediante la clave secreta**"*. O sea que desde que la firma está activa,
  **cada IPN se rechaza con 401 por diseño**. En el pago de prueba se rechazaron nueve.

  Comprobado en el panel: la sección **IPN está vacía** —ninguna URL configurada— así que
  las IPN salían únicamente de `notification_url`. Se quitó ese campo de la preferencia y
  queda un solo camino, firmado. El comentario en `create-preference` cuenta la historia
  entera, incluido por qué se había puesto.

- **La talla del selector de la ficha no llega al pedido.** Sólo al mensaje de WhatsApp.
- Contraentrega es **sólo Bogotá**, forzado en el cliente.
- La validación del formulario es por `onBlur`, no por submit.
- `/confirmacion` no llama a `ponerMeta` (está en `robots.txt` como `Disallow`, así que es
  aceptable).

## Cómo probarlo

**Usa siempre credenciales de prueba de Mercado Pago y marca los pedidos con `es_prueba`.**

1. **Tope de contraentrega:** pon `tope_contraentrega` por debajo del precio de una pieza.
   En la ficha la opción debe desaparecer. Fuérzala igual invocando `create-preference` con
   `paymentMethod: 'cod'` — debe responder con el mensaje del tope, no crear el pedido.
2. **`tope_contraentrega = null`:** la opción no debe pintarse.
3. **Abono:** el renglón en Mercado Pago debe ser uno solo, por el valor del abono, con la
   frase del saldo. El total en `orders.amount` debe ser el completo y `abono_monto` el
   abono.
4. **Doble webhook:** invoca `mp-webhook` dos veces con el mismo pago. La segunda no debe
   mandar ni conversiones ni correo (`conversion_enviada_en` ya está marcado).
5. **Estados de dinero:** un pedido contraentrega en `enviado` debe contar **sólo el
   abono** como recibido en el panel. Es la regla que más se ha roto.
6. **Precios congelados:** cambia el precio de la pieza después de comprar; `order_items`
   debe seguir diciendo el precio viejo.
