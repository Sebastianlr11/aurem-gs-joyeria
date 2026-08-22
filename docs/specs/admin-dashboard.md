# Panel — Dashboard

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/admin` (sección `dashboard`) · `src/pages/admin/Dashboard.jsx` (4.100 líneas)

## Qué resuelve

Contestar dos preguntas al abrir el panel por la mañana:

1. **¿Qué tengo que atender hoy?**
2. **¿Cuánta plata entró de verdad?**

El énfasis está en *de verdad*. La razón de existir de esta pantalla, tal como está hoy, es
que antes **mentía**: contaba como ingreso plata que todavía estaba en el bolsillo del
cliente.

## Cómo funciona hoy

### Arquitectura de la pantalla

`/admin` es **una sola ruta** con 7 secciones conmutadas por estado y sincronizadas con
`?tab=` (`:3650-3652`, `:3813-3839`): `dashboard`, `products`, `orders`, `customers`,
`reports`, `notes`, `settings`. Sólo `chat` es una ruta aparte.

### Carga de datos

| Origen | Línea |
|---|---|
| `products.select('*')` | `:3696` |
| `orders.select('*, piezas:order_items(nombre, precio, cantidad, talla, creado_en)')` | `:3707-3710` |
| `customers.select('*')` | `:3716` |
| `rpc('chats_sin_responder')` | `:3674` |
| `vigilancia_ultima`, `whatsapp_conversaciones`, `chat_takeover`, `gasto_pauta`, `taller_precios`, `rpc('analiticas_whatsapp')` | `DashboardHome` `:514-556` |

### El lente de pruebas

`:3762-3776` — los pedidos con `es_prueba` se **ocultan por defecto en todo el panel**
(pedidos y clientes incluidos). El interruptor está en la barra superior (`:3796-3807`) y
se recuerda en `localStorage('aurem:ver-pruebas')` (`:3685-3686`).

**Esto cambia todos los números de la pantalla.** Hoy los ~17 pedidos de la base son de
prueba: con el lente apagado, el panel está prácticamente vacío, y eso es correcto.

### Las tarjetas, con su fórmula exacta

**Cobrado · últimos 30 días** (`:821-841`, cálculo en `ingresosDe` `:439-465`)

```
mpNeto     = Σ bruto de Mercado Pago − comisiones
             comisión = (monto × 3,29% + $800) × 1,19 (IVA)
                      + monto × 1,5%   (retefuente)
                      + monto × 0,414% (ICA)
codCobrado = Σ recibidoDe(pedido) de los contraentrega
total      = mpNeto + codCobrado
```

Constantes en `:428-432`. Ventana: `hace30 = hoy − 30 días` sobre `pedidos30` (`:558-559`).

**Falta cobrar** (`:843-860`) — `Σ porCobrarDe(pedido)` de los contraentrega con saldo, más
cuántos pedidos son. Ver `src/lib/dinero.js`.

**Atender hoy** (`:563-565`, `:781-818`) — **mira todos los pedidos, no sólo 30 días**:

| Concepto | Criterio |
|---|---|
| Por confirmar | `status === 'pendiente'` |
| Por despachar | `status ∈ {pagado, procesando}` |
| Sin responder | `rpc('chats_sin_responder').length` |

El titular *"Hoy tienes N cosas por atender"* es la suma de los tres (`:579`, `:726`).

**Averías** (`:517-519`, `:741-759`) — fila `vigilancia_ultima` (id=1): `hallazgos[]` y
"Revisado hace X" desde `corrida_en`. Ver [vigilancia.md](vigilancia.md).

**Stock** (`:571-572`, `:765-778`) — piezas publicadas con `stock === 0` (agotadas) y
`stock === 1` (última unidad).

**Tendencia de 14 días** (`:636-661`, `:864-886`) — un palito por día con **`Σ amount` de
los pedidos creados ese día**, excluyendo cancelados. Pie: *"Hoy entraron N pedidos por
$X"*, con la nota **"Lo que se pidió, no lo que se cobró"**.

**Pauta** (`:548-555`, `:894-914`) — `Σ gasto_pauta.monto` de 30 días
`× (1 + taller_precios.iva_pauta ?? 0.19)`. La métrica "por cada peso gastado" es
`ingresos.total / gastoPauta`. **Sólo se muestra si hay gasto anotado.**

**Lo último** (`:688-710`, `:916-937`) — mezcla los 8 pedidos más recientes con los 8
últimos mensajes `role === 'user'`, ordenados por fecha y recortados a 7. `leerContenido`
(`:679-686`) traduce `image` / `audio` / `[unsupported]` a frases en español.

**Cómo le va a Valentina** (`:528-539`, `:942-989`) — sólo si hay conversaciones.
`rpc('analiticas_whatsapp', { p_dias: 30 })` → `total_conversaciones`, `mensajes_totales`,
`conversaciones_con_pedido`, `tasa_conversion`, `tiempo_respuesta_seg/min`. Más
`escalados` = teléfonos distintos en `chat_takeover` de los últimos 30 días.

### Frescura de los datos

`:487-500`, `:785-792`, `:3727-3760` — se guarda `actualizadoEn` real, el texto
"Actualizado hace X" se refresca con un reloj de 30 s y es **clicable para recargar**.
Además recarga sola al volver a la pestaña (`visibilitychange` / `focus`) con una gracia de
60 s.

## Decisiones tomadas y por qué

**Todo el dinero pasa por `src/lib/dinero.js`.** El bug que lo motivó: un pedido
contraentrega en estado `enviado` figuraba como $550.000 de ingresos cuando lo único que
había entrado eran los $20.000 del abono. **Con pauta encendida, eso es calcular el retorno
contra ingresos imaginarios.** Y peor: la ficha del cliente en el chat y el dashboard
contaban distinto, así que el mismo cliente daba dos números según dónde se mirara.

**Se descuentan las comisiones de Mercado Pago.** El bruto no es lo que entra a la cuenta.
Un panel que enseña el bruto sirve para sentirse bien, no para decidir.

**"Atender hoy" ignora la ventana de 30 días** a propósito: un pedido pendiente de hace 40
días sigue estando pendiente hoy.

**La tendencia cambió de plata cobrada a plata pedida**, con la nota explícita. Son dos
preguntas distintas y mezclarlas era el origen de la confusión. Se recalcula sola a
medianoche (`:613-616` recalcula `inicioDeHoy` con el reloj de 30 s) para que la ventana
cruce el día sin recargar.

**El panel dice cuándo se enteró.** Un dashboard sin marca de tiempo miente por omisión:
parece en vivo y no lo es.

**La pauta sólo aparece si hay gasto anotado**: un "retorno ∞" por dividir entre cero no
informa de nada.

**El contador de chats sin responder se movió a una RPC.** Antes se calculaba en el cliente
trayendo 300 mensajes y recortando a 3, así que **"Hoy tienes N cosas por atender" nunca
pasaba de 3**. La función `chats_sin_responder()` usa `DISTINCT ON (phone_number)` y es
`SECURITY DEFINER` con permisos revocados a `anon`.

## Límites conocidos y pendientes

- ⚠️ **Si `chats_sin_responder()` no está desplegada en Supabase, el contador queda en 0** y
  el panel dice "todo al día" siendo falso. La migración ya está commiteada (`2d140cc`);
  falta confirmar que está aplicada — [pendientes #5](../pendientes.md).
- **El badge de mensajes sin leer no llega al sidebar** desde aquí (`:3783` monta
  `AdminSidebar` sin `chatUnread`) — [pendientes #19](../pendientes.md).
- **4.100 líneas en un archivo** con las 7 secciones dentro — [pendientes #17](../pendientes.md).
- Las 6 RPC de analítica **no están versionadas**.
- El ticket promedio de Reportes usa `amount` completo, no `recibidoDe` — es deliberado y
  está comentado (`:2085-2087`), pero conviene saberlo.

## Cómo probarlo

1. **La regla de oro:** crea un pedido contraentrega de $550.000 con abono de $20.000 y
   ponlo en `enviado`. El panel debe mostrar **$20.000 cobrados** y **$530.000 por cobrar**.
   Si muestra $550.000 cobrados, `dinero.js` se rompió.
2. **Lente de pruebas:** con el interruptor apagado, ningún pedido `es_prueba` debe sumar en
   ninguna cifra. Enciéndelo y todas deben cambiar a la vez.
3. **Chats sin responder:** `SELECT * FROM public.chats_sin_responder();` debe devolver una
   fila por teléfono. Si da error, el contador está mintiendo.
4. **Frescura:** deja la pestaña en segundo plano más de 60 s y vuelve. Debe recargar y
   actualizar el "hace X".
5. **Medianoche:** cambia el reloj del sistema al día siguiente y espera 30 s. La tendencia
   debe correrse sola.
6. **Comisiones:** compara `mpNeto` con lo que Mercado Pago liquidó de verdad en un pago.
