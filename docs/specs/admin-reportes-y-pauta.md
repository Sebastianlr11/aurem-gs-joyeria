# Panel — reportes y retorno de pauta

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/admin?tab=reports`

## Qué resuelve

Una sola pregunta: **¿la pauta se está pagando sola?**

Y para contestarla bien hay que resolver antes dos trampas: que el bruto no es lo que
entra, y que **en Colombia cada millón de pauta cuesta 1.190.000** con IVA.

## Cómo funciona hoy

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/pages/admin/Dashboard.jsx:2004` | `ReportsSection` |
| `src/pages/admin/Dashboard.jsx:1999` | `calcMPNet` — comisiones de Mercado Pago |
| `src/pages/admin/Dashboard.jsx:2004-2110` | Cobrado vs por cobrar, separados |
| `src/pages/admin/Dashboard.jsx:2085-2087` | Ticket promedio — usa `amount` completo, comentado a propósito |
| `src/pages/admin/Dashboard.jsx:2363` | Entrada a `PautaRetorno` |
| `src/pages/admin/PautaRetorno.jsx` | Gasto de pauta y retorno (274 líneas) |
| `src/pages/admin/PautaRetorno.jsx:51-53` | Aviso de piezas con `costo_provisional` |

### RPC que consume

`analiticas_whatsapp`, `tendencia_comparativa`, `top_ciudades_envio`, `revenue_por_fuente`,
`clientes_nuevos_vs_recurrentes`, `embudo_whatsapp`. Más cálculo local sobre `orders`.

**Ninguna de las seis está versionada** ([pendientes #4](../pendientes.md)).

### Tablas

`gasto_pauta` (único por `fecha, canal`), `taller_precios.iva_pauta`, `orders`, `products`
(para `costo` y `costo_provisional`).

## Decisiones tomadas y por qué

**El IVA de la pauta se aplica siempre.** Meta y TikTok facturan desde el exterior y en
Colombia eso arrastra IVA: **cada millón de pauta cuesta realmente 1.190.000**. No se puede
evitar. Un ROAS calculado sobre el gasto sin IVA está inflado un 19% — justo en el número
del que dependen las decisiones de inversión. El factor vive en `taller_precios.iva_pauta`
(0,19 por defecto) y no está hardcodeado, para poder ajustarlo si cambia el régimen.

**El retorno se separa en "caja" y "venta"**, no uno solo. Con contraentrega esas dos cosas
divergen durante días: hay ventas comprometidas cuya plata todavía no entró. Un solo número
tendría que elegir entre optimista y pesimista, y las dos elecciones engañan.

**Se avisa de las piezas con `costo_provisional`** (`PautaRetorno.jsx:51-53`). Si el costo
es un supuesto, el margen es un supuesto, y el retorno también. Mejor decirlo que dar un
número con falsa precisión.

**El ticket promedio sí usa `amount` completo** (`:2085-2087`), a diferencia del resto de
las cifras — y está comentado en el código para que nadie lo "arregle". El ticket es
**cuánto vale un pedido**, no cuánto se ha cobrado de él.

**`gasto_pauta` tiene índice único por `fecha, canal`**: anotar dos veces el mismo día
duplicaría el gasto y hundiría el ROAS sin motivo.

**Cuidado con la medición de origen:** hay **dos píxeles de Meta con el mismo nombre y sólo
uno recibe eventos**. Antes de concluir que una campaña no convierte, verifica el ID — ver
[atribucion-y-pixeles.md](atribucion-y-pixeles.md).

## Límites conocidos y pendientes

- **Las 6 RPC no están en el repo.** Si alguien las cambia en el dashboard de Supabase, los
  reportes cambian sin dejar rastro en git.
- El gasto de pauta se anota **a mano**: no hay integración con las APIs de Meta ni TikTok.
- `revenue_por_fuente` depende de que la atribución haya llegado; los pedidos manuales sin
  origen caen en "sin fuente".
- Con los pedidos actuales (todos de prueba), los reportes están vacíos a menos que se
  encienda el lente de pruebas.

## Cómo probarlo

1. **El IVA:** anota $1.000.000 de gasto en `gasto_pauta`. El panel debe mostrar
   **$1.190.000** de costo real, no un millón.
2. **Caja vs venta:** con un pedido contraentrega a medio cobrar, los dos retornos deben
   dar distinto.
3. **Costo provisional:** marca una pieza con `costo_provisional` y véndela. El panel debe
   avisar de que el margen es un supuesto.
4. **Duplicado:** intenta anotar dos veces el mismo día y canal. Debe rechazarlo el índice
   único.
5. **Comisiones:** compara `calcMPNet` con una liquidación real de Mercado Pago.
6. Verifica que las 6 RPC existen: `SELECT proname FROM pg_proc WHERE proname LIKE '%whatsapp%';`
