# Panel — reportes y retorno de pauta

> **Estado:** en producción
> **Última revisión:** 2026-08-24
> **Ruta:** `/admin?tab=reports`

## Qué resuelve

Una sola pregunta: **¿la pauta se está pagando sola?**

Y para contestarla bien hay que resolver antes dos trampas: que el bruto no es lo que
entra, y que **en Colombia cada millón de pauta cuesta 1.190.000** con IVA.

## Cómo funciona hoy

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/admin/secciones/Reportes.jsx` | La pantalla entera |
| `src/lib/dinero.js` | `netoRecibidoDe` y `costoDePasarelaDe` — lo que llegó a la cuenta |
| `src/pages/admin/secciones/Reportes.jsx` | Cobrado vs por cobrar, separados |
| `src/pages/admin/secciones/Reportes.jsx` | Ticket promedio — usa `amount` completo, comentado a propósito |
| `src/pages/admin/secciones/Reportes.jsx` | Entrada a `PautaRetorno` |
| `src/pages/admin/PautaRetorno.jsx` | Gasto de pauta y retorno (336 líneas) |
| `src/pages/admin/PautaRetorno.jsx` | Aviso de pedidos sin costo anotado, y la utilidad |

### RPC que consume

`analiticas_whatsapp`, `tendencia_comparativa`, `top_ciudades_envio`, `revenue_por_fuente`,
`clientes_nuevos_vs_recurrentes`, `embudo_whatsapp`. Más cálculo local sobre `orders`.

**Ninguna de las seis está versionada** ([pendientes #4](../pendientes.md)).

### Tablas

`gasto_pauta` (único por `fecha, canal`), `taller_precios.iva_pauta`, `orders` (incluidas
`costo_taller` y `costo_envio`). **Ya no consulta `products`**: desde el 23 de agosto de
2026 el costo vive en el pedido.

## Decisiones tomadas y por qué

**El IVA de la pauta se aplica siempre.** Meta y TikTok facturan desde el exterior y en
Colombia eso arrastra IVA: **cada millón de pauta cuesta realmente 1.190.000**. No se puede
evitar. Un ROAS calculado sobre el gasto sin IVA está inflado un 19% — justo en el número
del que dependen las decisiones de inversión. El factor vive en `taller_precios.iva_pauta`
(0,19 por defecto) y no está hardcodeado, para poder ajustarlo si cambia el régimen.

**El retorno se separa en "caja" y "venta"**, no uno solo. Con contraentrega esas dos cosas
divergen durante días: hay ventas comprometidas cuya plata todavía no entró. Un solo número
tendría que elegir entre optimista y pesimista, y las dos elecciones engañan.

**Hay una cifra que responde "¿esto deja plata?" y no sólo "¿esto vende?"**: *Queda
después de todo* = lo vendido − lo que costó el taller − el flete − la pauta con IVA. El
múltiplo del ROAS no basta para decidir presupuesto: un 3× con una pieza que deja el 10 %
pierde plata, y hasta el 23 de agosto de 2026 el panel no tenía cómo verlo.

**Y se avisa de los pedidos sin costo anotado**, que es lo que hace que esa cifra salga
corta. Se dice sobre cuántos pedidos está calculada: un margen sobre uno de cinco no es
mentira, pero tampoco es el periodo. Antes el aviso miraba `products.costo_provisional`,
cuando el costo era un número fijo del catálogo.

**El ticket promedio sí usa `amount` completo**, a diferencia del resto de
las cifras — y está comentado en el código para que nadie lo "arregle". El ticket es
**cuánto vale un pedido**, no cuánto se ha cobrado de él.

**`gasto_pauta` tiene índice único por `fecha, canal`**: anotar dos veces el mismo día
duplicaría el gasto y hundiría el ROAS sin motivo.

**Cuidado con la medición de origen:** hay **dos píxeles de Meta con el mismo nombre y sólo
uno recibe eventos**. Antes de concluir que una campaña no convierte, verifica el ID — ver
[atribucion-y-pixeles.md](atribucion-y-pixeles.md).

## La regla de esta pantalla

**Dentro de una tarjeta, el conteo y la plata describen el mismo conjunto de pedidos.**

Está escrita porque se rompió: el 23 de agosto se arregló que el dinero pasara por
`recibidoDe`, pero **los conteos de al lado siguieron contando todos los pedidos**,
cancelados incluidos. La pantalla decía «Anillo Majestuosa · 12 unidades vendidas ·
$20.000» sobre 12 pedidos de los que **1 estaba vivo y 10 cancelados**. Cada mitad de la
frase era cierta por separado; juntas decían que la pieza se vende a $1.667.

En el código: `filtered` es todo lo que entró en el periodo y sólo vale para lo que de
verdad habla de todo —el desglose de estados, cuántos pedidos llegaron—. Para cualquier cosa
que vaya al lado de un peso, `vivos`.

Se corrigieron cinco tarjetas: piezas más vendidas, pedidos por canal, métodos de pago,
actividad diaria y la tasa de pago.

### La tasa de pago ya no lleva los cancelados

Los tenía en el denominador, y eso mezclaba «todavía no ha pagado» con «esto ya no existe».
Con 14 de 18 cancelados, la pantalla decía que se cobra el **11 %** — y con ese número se
deciden presupuestos de pauta. Ahora dice **50 % · 2 de 4 en pie**, y los cancelados tienen
su propia tarjeta: **«Se cayeron · 78 % · 14 de 18»**, que es un dato por sí solo y estaba
escondido dentro de un porcentaje que decía otra cosa.

`Pedidos` sigue contando todo a propósito —cuántos entraron— y por eso ahora dice en qué
quedaron: «2 en pie, 14 cancelados».

## «Ingreso neto» no era neto

`recibidoDe` responde **cuánto entregó la clienta**. Esta pantalla usaba esa cifra debajo de
un rótulo que promete otra: *«Plata que ya entró, con las comisiones descontadas»*. No las
descontaba, y la línea de al lado remataba con *«Comisiones Mercado Pago −$0»*.

El agujero es el abono. **Se cobra por Mercado Pago** —lo genera `create-preference` y lo
confirma `mp-webhook`—, así que la pasarela se lleva **$2.118 de cada $20.000**:

```
Dos abonos, en bruto     $40.000
Lo que quedó de verdad   $35.764
```

Y **la portada ya decía $35.764**, porque tira del libro de caja (`caja.js`), que sí lo
descuenta. Dos pantallas, la misma pregunta, dos respuestas — el bug original de este
proyecto, otra vez.

Ahora las dos llaman a `netoRecibidoDe`, con la sutileza que hace falta hacer bien: de un
contraentrega **entregado** sólo el abono pasó por la pasarela, y el resto lo cobró el
mensajero en efectivo. Se le descuenta la comisión de los $20.000 y no la de los $550.000 —
lo segundo se inventaría $26.000 de gasto que nunca ocurrió. Y sólo si el abono llegó a
pagarse por ahí: `abono_pagado_en` es la prueba, porque un pedido cargado a mano en el panel
nunca pasó por la pasarela.

**La regla de rotulación**, para que no vuelva a mezclarse: lo que diga *entró*, *neto* o
*deja* va **después** de comisiones; lo que diga *vendido* o *pedido* se queda en precio.

### Dónde más faltaba

| Dónde | Qué pasaba |
|---|---|
| Ingreso neto · Comisiones | Los abonos, en bruto. $40.000 → **$35.764**, y −$0 → **−$4.236** |
| «Lo que deja» por pieza | `precio − taller − flete`, sin la comisión |
| «Deja neto» del retorno de pauta | Lo mismo, en la única cifra que responde «¿esto deja plata?» |
| `revenue_por_fuente` · `top_ciudades_envio` · `tendencia_comparativa` | Sumaban `recibido_de` en bruto |
| `ingresosDe` de la portada | Calculaba la comisión sobre el precio, no sobre lo cobrado |

El espejo en SQL es `public.neto_recibido_de(...)`, comprobado caso por caso contra el
JavaScript —incluido el del contraentrega entregado, que es donde es fácil equivocarse—.
**Si tocas una, toca la otra.**

## Los números que mentían

Esta pantalla tuvo, en dos días, **cinco cifras infladas por la misma razón**: sumar
`amount` en vez de preguntar qué entró de verdad. La regla está en CLAUDE.md §8 y en
`src/lib/dinero.js`, y el motivo de que se cuele tan fácil es que **el error no se ve**: da
un número redondo, con signo de pesos y perfectamente creíble.

| Tarjeta | Decía | Entró | Dónde estaba |
|---|---|---|---|
| Ingresos por fuente | $13.239.000 | $40.000 | `revenue_por_fuente` |
| Tendencia mes a mes | $13.239.000 | $40.000 | `tendencia_comparativa` |
| A dónde enviamos | $13.239.000 | $40.000 | `top_ciudades_envio` |
| Métodos de pago | $12.700.000 | $40.000 | `Reportes.jsx`, en JavaScript |
| Pedidos por canal | $1.050.000 | $40.000 | `Reportes.jsx`, en JavaScript |
| Comisiones de Mercado Pago | sobre el precio de todo pedido vivo | sobre lo cobrado | `Reportes.jsx`, en JavaScript |

Las tres primeras sumaban todos los pedidos, cancelados incluidos. «Métodos de pago» hacía
lo mismo. «Pedidos por canal» sí filtraba los muertos con `estaVivo`, pero daba por cobrado
el total de un contraentrega que va en camino —y de esos son 16 de cada 17—.

La de Mercado Pago es la más silenciosa de todas y hoy no se veía, porque no hay ningún
pedido vivo pagado en línea: `mpNet` calculaba la comisión sobre `amount`, así que un pedido
en `confirmado` —vivo pero sin la plata dentro— habría contado como cobrado entero. Ahora va
sobre `recibidoDe`.

**Y una sexta que no era de dinero:** `clientes_nuevos_vs_recurrentes` contaba por
`customer_phone` en crudo. El mismo número entra de tres formas según el canal, así que una
sola persona con dos pedidos salía como «2 clientes nuevos, 0 recurrentes» — el revés justo
de lo que la gráfica existe para medir. Ahora se cuenta por los últimos diez dígitos, como
el índice único de `customers`.

## Límites conocidos y pendientes

- ~~**Las 6 RPC no están en el repo**~~ — las ocho lo están desde el 23 de agosto de 2026.
  Y al leerlas por primera vez aparecieron tres que mentían: ver más abajo.
- 🟠 **Esta pantalla mezcla dos formas de contar.** Los números que salen de `orders` en
  JavaScript obedecen al lente de pruebas; los que salen de una RPC, no —una función
  agregada no puede saber cómo está puesto un interruptor de la interfaz—. Hoy, con los 18
  pedidos de prueba, eso significa que con el lente apagado unas tarjetas se vacían y otras
  no. No hay arreglo limpio sin pasarle el lente como parámetro a las seis RPC.
- El gasto de pauta se anota **a mano**: no hay integración con las APIs de Meta ni TikTok.
- `revenue_por_fuente` depende de que la atribución haya llegado; los pedidos manuales sin
  origen caen en "sin fuente".

## Cómo probarlo

1. **El IVA:** anota $1.000.000 de gasto en `gasto_pauta`. El panel debe mostrar
   **$1.190.000** de costo real, no un millón.
2. **Caja vs venta:** con un pedido contraentrega a medio cobrar, los dos retornos deben
   dar distinto.
3. **Costos del pedido:** anota el costo del taller y el del flete en un pedido vendido.
   *Queda después de todo* debe bajar en esa cantidad. Deja otro pedido sin costo: el panel
   debe avisar y decir sobre cuántos de cuántos calculó.
4. **Duplicado:** intenta anotar dos veces el mismo día y canal. Debe rechazarlo el índice
   único.
5. **Comisiones:** compara `costoDePasarelaDe` con una liquidación real de Mercado Pago.
6. Verifica que las 6 RPC existen: `SELECT proname FROM pg_proc WHERE proname LIKE '%whatsapp%';`
