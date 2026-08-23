# Modelo de datos

> **Estado:** ⚠️ **sólo 4 de ~22 tablas versionadas en el repositorio**
> **Última revisión:** 2026-08-22

## Qué resuelve

Este documento es el mapa de la base. Y su hallazgo principal es incómodo:

> **El repositorio no puede reconstruir su propia base de datos.**
> La mayoría de las tablas, todas las RPC y buena parte de las políticas RLS se crearon a
> mano en el dashboard de Supabase y **no existen en control de versiones**.

## Cómo funciona hoy

### Qué está y qué no está versionado

| Tabla / objeto | ¿En el repo? | Dónde |
|---|---|---|
| `products` | ✅ sí | `20260228_esquema_base.sql` |
| `taller_precios` | ✅ | `20260818_taller_precios.sql` |
| `taller_conocimiento` | ✅ | `20260818_taller_conocimiento.sql` |
| `plantillas_enviadas` | ✅ | `20260819_plantillas_programadas.sql` |
| `orders` | ⚠️ sólo columnas añadidas y RLS | varias migraciones |
| `whatsapp_conversaciones` | ⚠️ sólo columnas añadidas | `20260818_*`, `20260819_*` |
| `order_items` | ❌ | — |
| `customers` | ❌ | — |
| `chat_takeover` | ❌ | — |
| `chat_status` | ❌ | — |
| `contact_tags` | ❌ | — |
| `notes` | ❌ | — |
| `gasto_pauta` | ❌ | — |
| `ajustes_internos` | ❌ | — |
| `vigilancia_ultima` | ❌ | — |
| vista `envio_publico` | ❌ | — |
| `pagos` | ❌ | El libro de movimientos de `caja.js`, llenado por el trigger `registrar_pago` |
| **Las RPC de analítica** | ❌ | — |
| `chats_sin_responder`, `conversaciones_purgables` | ✅ | migraciones del 22-ago |
| Programación de `pg_cron` | ✅ | `20260823_el_reloj_de_la_base.sql` |

### Las tablas, por área

**Comercio**

| Tabla | Columnas destacadas |
|---|---|
| `products` | `name`, `description`, `price`, `compare_price`, `category`, `metal`, `piedra`, `engaste`, `talla_rango`, `images[]`, `image_url`, `stock`, `is_new`, `is_featured`, y `costo`/`costo_provisional` **muertas** desde el 23-ago |
| `orders` | `customer_name/email/phone`, `product_id`, `product_name`, `amount`, `status`, `payment_method`, `order_source`, `notes`, `carrier`, `tracking_number`, `mp_preference_id`, `mp_payment_id`, `mp_status`, `status_updated_at`, `es_prueba`, `shipping_address/city/department`, `abono_monto`, `abono_pagado_en`, `conversion_enviada_en`, `costo_taller`, `costo_envio`, `costo_anotado_en` + atribución |
| `order_items` | `order_id`, `product_id`, `nombre`, `precio`, `cantidad`, `talla`, `creado_en` — **precios congelados** |
| `customers` | Datos del cliente + `no_escribir` |

`status` ∈ `pendiente | pagado | procesando | enviado | entregado | cancelado`

**Conversaciones**

| Tabla | Columnas destacadas |
|---|---|
| `whatsapp_conversaciones` | `phone_number`, `role`, `content`, `message_type`, `media_url`, `wa_message_id` (**único**), `is_read`, `enviado_por` (`ia`\|`humano`), `delivery_status`, `error_wa`, `wa_phone_id`, `referral` |
| `chat_takeover` | `phone_number` (único), `is_active`, `admin_email`, `reason`, `started_at`, `ended_at` |
| `chat_status` | Resuelta / archivada, upsert por `phone_number` |
| `contact_tags` | Etiquetas por contacto |

**Operación**

| Tabla | Nota |
|---|---|
| `taller_precios` | **Fila única forzada**: `id boolean primary key default true check (id)` |
| `taller_conocimiento` | `tema`, `contenido` — lo que Valentina puede afirmar |
| `plantillas_enviadas` | **Dos índices únicos parciales** (por pedido / por persona) |
| `gasto_pauta` | Único por `fecha, canal` |
| `ajustes_internos` | Clave/valor: `cron_secreto`, `clave_anon`, `url_funciones`, `telefonos_avisos`, `contactos_equipo` |
| `vigilancia_ultima` | Fila id=1 con `hallazgos[]` y `corrida_en` |
| `notes` | Anotaciones internas con prioridad |
| `envio_publico` (vista) | Expone **sólo** `abono_envio` y `tope_contraentrega` |

### RPC

| Función | Consumida por |
|---|---|
| `chats_sin_responder` | Dashboard (`DISTINCT ON`, `SECURITY DEFINER`) |
| `analiticas_whatsapp` | Dashboard y Reportes |
| `buscar_conversaciones` | ChatPanel |
| `tendencia_comparativa`, `top_ciudades_envio`, `revenue_por_fuente`, `clientes_nuevos_vs_recurrentes`, `embudo_whatsapp` | Reportes |

### Storage

| Bucket | Acceso |
|---|---|
| `product-images` | **público** |
| `chat-media` | **privado** — se firman URLs por 1 h |

### Las migraciones, en orden

| Archivo | Qué hizo |
|---|---|
| `20260311_add_shipping_address.sql` | Dirección de envío en `orders` |
| `20260311_orders_rls.sql` | RLS de `orders` — declaraba una política abierta a `anon` que **nunca llegó a la base**; anulada después |
| `20260818_atribucion_anuncios.sql` | `ttclid`, `ttp`, `fbc`, `fbp`, `conversion_enviada_en` |
| `20260818_atribucion_navegador.sql` | `client_ua`, `client_ip` |
| `20260818_referral_anuncios.sql` | `referral jsonb` + índice parcial |
| `20260818_taller_conocimiento.sql` | Crea la tabla + 6 filas ("SIN CONFIRMAR") |
| `20260818_taller_precios.sql` | Crea la fila única |
| `20260818_wa_phone_id.sql` | `wa_phone_id` + índice |
| `20260819_abono_envio.sql` | `abono_monto`, `abono_pagado_en`, `abono_envio` |
| `20260819_atribucion_origen.sql` | `ctwa_clid`, `anuncio_id`, `utm_*` |
| `20260819_plantillas_programadas.sql` | `plantillas_enviadas` + `customers.no_escribir` |
| `20260822_chats_sin_responder.sql` | La función del contador |
| `20260822_cerrar_conversaciones_a_anon.sql` | 🔒 Cierra las conversaciones a `anon` |
| `20260822_borrar_chat_media.sql` | Política DELETE en `chat-media` |
| `20260822_conversaciones_purgables.sql` | Retención de conversaciones |
| `20260822_pedido_publico.sql` | 🔒 `pedido_publico(uuid)` + `DROP` de la política mina |
| `20260822_quitar_respaldos_de_chats.sql` | Elimina los tres respaldos del 22-ago |
| `20260823_costos_del_pedido.sql` | `costo_taller`, `costo_envio`, `costo_anotado_en` en `orders`; jubila `products.costo` |
| `20260823_conocimiento_devoluciones.sql` | Devoluciones y garantía completa para Valentina |
| `20260823_conocimiento_al_dia.sql` | El seed del conocimiento, volcado de producción |
| `20260823_fuera_las_tablas_muertas.sql` | 🔒 Borra las 3 tablas de la era n8n y el cuarto respaldo de chats |
| `20260823_las_rpc_estaban_abiertas.sql` | 🔒 Cierra a `anon` las RPC `SECURITY DEFINER` y borra 4 muertas |
| `20260823_un_cliente_por_persona.sql` | La unicidad de `customers.phone` pasa a ser por los últimos 10 dígitos |

### Los fallos de acceso público, cerrados

`20260822_cerrar_conversaciones_a_anon.sql` cerró el caso **que sí estaba abierto en
producción**: cinco tablas tenían políticas `[public ALL] using=true`, que **incluye a
`anon`**. Como la llave anónima va dentro del bundle público, cualquiera podía leer toda la
correspondencia con las clientas —nombres, teléfonos, fotos, lo preguntado y lo
respondido— **y borrarla**.

La migración documenta la verificación que sostiene el cambio: quién toca de verdad cada
tabla, comprobado sobre el repositorio entero. Tres de las cinco no las usa **nadie**
(`message_history`, `whatsapp_dedup`, `conversaciones`: cero referencias, cero filas) y
quedaron sin ninguna política, alcanzables sólo por `service_role`. **El 23 de agosto se
borraron del todo**, junto con una cuarta que nadie había documentado —
`whatsapp_conversaciones_respaldo`, con 79 mensajes de 6 chats que ya no estaban en la
tabla viva—. Ver `20260823_fuera_las_tablas_muertas.sql`: una copia entera de los chats en
otra tabla hacía falsa la promesa de borrado que el panel y la política de privacidad le
hacen a la clienta.

Las Edge Functions no se enteran del cambio: usan `admin()` de `_shared/wa.ts`, que es
`SERVICE_ROLE_KEY` y **se salta RLS por completo**.

Los tres `respaldo_*_20260822` eran respaldos manuales con 104 filas de conversaciones
reales y RLS apagado. Primero se les encendió RLS —*"borrar el respaldo de otro no se hace
sin preguntar"*— y después se eliminaron (`20260822_quitar_respaldos_de_chats.sql`).

**`orders` se cerró aparte**, con `20260822_pedido_publico.sql`. El caso tiene una lección
propia: la política `orders_anon_read_own` estaba escrita en `20260311_orders_rls.sql` con
`USING (true)`, **pero no existía en la base** — comprobado con la llave pública, devuelve
`[]`. El archivo y la base llevaban meses separados. La migración nueva la borra igual,
para el día que alguien reconstruya reproduciendo las migraciones en orden.

> **Mientras el esquema no esté versionado, leer las migraciones no es leer la base.** Ver
> [pendientes #4](../pendientes.md).

## Decisiones tomadas y por qué

**Fila única por esquema, no por convención** (`taller_precios`): `id boolean primary key
default true check (id)` hace **imposible** insertar una segunda fila. Con dos filas de
precios, media aplicación leería una y media la otra.

**Dos índices únicos parciales en `plantillas_enviadas`, no uno.** En Postgres **los NULL
no colisionan entre sí**, así que un `UNIQUE(pedido_id, plantilla)` normal habría dejado
mandar infinitas veces un aviso sin pedido asociado.

**`wa_message_id` con índice único** es el candado anti-reentrega: Meta reenvía mensajes
cuando duda de la entrega, y el código detecta el error `23505` para absorberlo.

**`conversion_enviada_en` se usa como candado con un UPDATE que marca y lee a la vez**:
serializa dos webhooks concurrentes en la propia base.

**La vista `envio_publico` existe para no filtrar el margen.** `taller_precios` guarda el
recargo; la vista expone dos columnas y nada más.

**`chats_sin_responder()` es `SECURITY DEFINER` con `search_path = public`**, revocada de
`anon` y concedida a `authenticated` y `service_role`. Es la forma correcta: la función
necesita ver más de lo que ve quien la llama, y por eso hay que fijar el `search_path`.

**Los precios se congelan en `order_items`**: un pedido es un hecho del pasado.

## Límites conocidos y pendientes

- 🟠 **La mayoría de las tablas y las RPC de analítica no están versionadas** —
  [pendientes #4](../pendientes.md). Es el hallazgo de fondo: hizo invisibles seis tablas
  y permitió que un archivo de migración contradijera a la base sin que nadie lo notara.
- ~~**`supabase-schema.sql` está obsoleto**~~: borrado el 23 de agosto. Lo reemplaza
  `20260228_esquema_base.sql`, volcado del catálogo. Le faltaban 7 columnas que el frontend consume
  y su `CHECK` de categoría no incluye `Dijes`.
- Las políticas RLS que no están versionadas **tampoco se revisan en un diff** — que es
  exactamente cómo el fallo #1 lleva desde marzo sin que nadie lo viera.
- Borrar una pieza no borra sus archivos del Storage.

## Cómo probarlo

```bash
# ¿Qué migraciones conoce el proyecto remoto?
npx supabase migration list

# Volcar el esquema real para compararlo con el repo (recomendado, ver pendientes #4)
npx supabase db pull --schema public
```

```sql
-- Las políticas reales de orders
SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'orders';

-- Las RPC que existen de verdad
SELECT proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public';

-- La programación de pg_cron
SELECT jobname, schedule, command FROM cron.job;
```

**La prueba que más importa** — debe devolver `[]`, y hoy lo hace. Conviene repetirla tras
cualquier cambio de RLS:

```bash
curl "$VITE_SUPABASE_URL/rest/v1/orders?select=customer_name,customer_phone" \
     -H "apikey: $VITE_SUPABASE_ANON_KEY"
```
