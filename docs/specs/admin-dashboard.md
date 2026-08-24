# Panel — Dashboard

> **Estado:** en producción
> **Última revisión:** 2026-08-23
> **Ruta:** `/admin` (sección `dashboard`) · `src/pages/admin/secciones/Portada.jsx`

> **Sin números de línea, a propósito.** Esta spec los llevaba —`:821-841`, `:439-465`— y
> el 23 de agosto `Dashboard.jsx` pasó de 4.100 líneas a 248 al repartirse en
> `secciones/`. Todas apuntaban a sitios que ya no existían, y una referencia falsa es
> peor que ninguna: manda a buscar donde no está. Se nombran archivos y funciones, que
> sobreviven a un reordenamiento.

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
`?tab=`: `dashboard`, `products`, `orders`, `customers`, `reports`, `notes`, `settings`.
Sólo `chat` es una ruta aparte.

El contenedor —carga de datos, lente de pruebas, conmutación de sección— es
`src/pages/admin/Dashboard.jsx` (248 líneas). Cada sección vive en su archivo dentro de
`src/pages/admin/secciones/`, y esta pantalla es `Portada.jsx`. Lo que comparten varias
está en `secciones/comunes.js` (datos) y `secciones/piezas.jsx` (componentes), separados
porque `react-refresh/only-export-components` no deja mezclarlos.

### Carga de datos

| Origen | Dónde |
|---|---|
| `products.select('*')` | `Dashboard.jsx` |
| `orders.select('*, piezas:order_items(nombre, precio, cantidad, talla, creado_en)')` | `Dashboard.jsx` |
| `customers.select('*')` | `Dashboard.jsx` |
| `rpc('chats_sin_responder')` | `Dashboard.jsx` |
| `vigilancia_ultima`, `whatsapp_conversaciones`, `chat_takeover`, `gasto_pauta`, `taller_precios`, `rpc('analiticas_whatsapp')` | `Portada.jsx` |

### El lente de pruebas

En `Dashboard.jsx`: los pedidos con `es_prueba` se **ocultan por defecto en todo el panel**
(pedidos y clientes incluidos). El interruptor está en la barra superior y se recuerda en
`localStorage('aurem:ver-pruebas')`.

**Esto cambia todos los números de la pantalla.** Hoy los 18 pedidos de la base son de
prueba: con el lente apagado, el panel está prácticamente vacío, y eso es correcto.

### Las tarjetas, con su fórmula exacta

**Cobrado · últimos 30 días** — el cálculo es `ingresosDe`, de `src/lib/dinero.js`

```
mpNeto     = Σ bruto de Mercado Pago − comisiones
             comisión = (monto × 3,29% + $800) × 1,19 (IVA)
                      + monto × 1,5%   (retefuente)
                      + monto × 0,414% (ICA)
codCobrado = Σ recibidoDe(pedido) de los contraentrega
total      = mpNeto + codCobrado
```

Las constantes viven en `src/lib/dinero.js`. Ventana: `hace30 = hoy − 30 días` sobre `pedidos30`.

**Falta cobrar** — `Σ porCobrarDe(pedido)` de los contraentrega con saldo, más
cuántos pedidos son. Ver `src/lib/dinero.js`.

**Atender hoy** — **mira todos los pedidos, no sólo 30 días**:

| Concepto | Criterio |
|---|---|
| Por confirmar | `pendiente` **y contraentrega** — falta cerrarlos: llamar, confirmar dirección y cobrar el abono |
| Sin pagar | `pendiente` **y pago en línea** — llenaron el checkout y no pagaron. **Sólo se pinta si hay alguno** |
| Por despachar | `confirmado`, `procesando`, o `pagado` en línea |
| Sin responder | `rpc('chats_sin_responder').length` |

El titular *"Hoy tienes N cosas por atender"* es la suma de los cuatro.

Los dos primeros eran uno solo, «Por confirmar», y mezclaba dos trabajos distintos: un
contraentrega en `pendiente` es plata casi hecha que falta cerrar; un pago en línea en
`pendiente` es un carrito abandonado y nadie está esperando nada. Juntos, el número no
servía para decidir a quién llamar primero. Los criterios viven en `GRUPOS`
(`secciones/comunes.js`) y los comparten la portada y la pantalla de Pedidos.

**Averías** — fila `vigilancia_ultima` (id=1): `hallazgos[]` y
"Revisado hace X" desde `corrida_en`. Ver [vigilancia.md](vigilancia.md).

**Stock** — piezas publicadas con `stock === 0` (agotadas) y
`stock === 1` (última unidad).

**Tendencia de 14 días** — un palito por día con **`Σ amount` de
los pedidos creados ese día**, excluyendo cancelados. Pie: *"Hoy entraron N pedidos por
$X"*, con la nota **"Lo que se pidió, no lo que se cobró"**.

**Pauta** — `Σ gasto_pauta.monto` de 30 días
`× (1 + taller_precios.iva_pauta ?? 0.19)`. La métrica "por cada peso gastado" es
`ingresos.total / gastoPauta`. **Sólo se muestra si hay gasto anotado.**

**Lo último** — mezcla los 8 pedidos más recientes con los 8
últimos mensajes `role === 'user'`, ordenados por fecha y recortados a 7. `leerContenido`
traduce `image` / `audio` / `[unsupported]` a frases en español.

**Cómo le va a Valentina** — sólo si hay conversaciones.
`rpc('analiticas_whatsapp', { p_dias: 30 })` → `total_conversaciones`, `mensajes_totales`,
`conversaciones_con_pedido`, `tasa_conversion`, `tiempo_respuesta_seg/min`. Más
`escalados` = teléfonos distintos en `chat_takeover` de los últimos 30 días.

### Frescura de los datos

Se guarda `actualizadoEn` real, el texto
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
medianoche (`Portada.jsx` recalcula `inicioDeHoy` con el reloj de 30 s) para que la ventana
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
- **El badge de mensajes sin leer no llega al sidebar** desde aquí (`Dashboard.jsx` monta
  `AdminSidebar` sin `chatUnread`) — [pendientes #19](../pendientes.md).
- **4.100 líneas en un archivo** con las 7 secciones dentro — [pendientes #17](../pendientes.md).
- Las 6 RPC de analítica **no están versionadas**.
- El ticket promedio de Reportes usa `amount` completo, no `recibidoDe` — es deliberado y
  está comentado, pero conviene saberlo.

## Un cliente es una persona, no un formato de teléfono

El mismo número entra de tres formas según el canal —`3143602930` desde el panel,
`+573143602930` desde el checkout, `573143602930` desde WhatsApp— y hasta el 23 de agosto
de 2026 `sync_customer_from_order` resolvía el conflicto con `ON CONFLICT (phone)`, que
compara la cadena cruda. **La misma persona aparecía tres veces.**

Con clientas reales eso no es un detalle: infla el conteo de Clientes, parte su historial
en pedazos y, sobre todo, **hace mentir a `clientes_nuevos_vs_recurrentes`** — quien compra
por la web y luego por WhatsApp cuenta como dos clientas nuevas y nunca como una
recurrente, que es justo la cifra que dice si el negocio retiene.

Desde `20260823_un_cliente_por_persona.sql` la unicidad es sobre los **últimos diez
dígitos**, igual que ya hacían `marcar_pedido_de_prueba`, `conversaciones_purgables` y el
buscador del panel. **El valor guardado no se toca**: se sigue almacenando el teléfono tal
como llegó, porque media docena de sitios lo leen; lo que cambió es con qué se compara.

> Al añadir un cliente a mano, si el teléfono ya existe en otro formato el panel lo dice
> con palabras («Ese teléfono ya está guardado, aunque lo escribas con otro formato») en
> vez de escupir el error de Postgres.

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
