# WhatsApp — envío, ventana de 24 h y plantillas

> **Estado:** en producción · **plantillas programadas apagadas por defecto**
> **Última revisión:** 2026-08-22
> **Dónde vive:** `supabase/functions/_shared/wa.ts` (464 líneas), `wa-send`, `plantillas-programadas`

## Qué resuelve

Hablarle a un cliente por WhatsApp. Suena simple y no lo es, por dos restricciones que
impone Meta y que gobiernan todo el diseño:

1. **La ventana de 24 horas.** Sólo se puede escribir libremente dentro de las 24 h desde
   el último mensaje del cliente. Fuera de ella, **únicamente plantillas aprobadas**.
2. **Un mensaje largo de un bot se nota.** Un párrafo de 400 caracteres que aparece de
   golpe grita "esto es automático".

## Cómo funciona hoy

### Quién manda mensajes

| Origen | Qué manda |
|---|---|
| `_shared/bot.ts` | Las respuestas de Valentina |
| `wa-send` (Edge Function) | Lo que escribe una persona desde el `ChatPanel` |
| `mp-webhook` | Aviso de pago recibido |
| `plantillas-programadas` | Avisos programados (apagados por defecto) |
| `bot.ts` (escalada) | Plantilla `aviso_equipo` al equipo |

### Piezas clave

| Ruta | Qué |
|---|---|
| `supabase/functions/_shared/wa.ts:255-286` | `enviarTextoNatural` — el troceado |
| `wa.ts:234-245` | Indicador de "escribiendo", refrescado cada 20 s |
| `wa.ts:403, 424-464` | Auto-liberación del takeover a las 6 h |
| `wa.ts` | `enviarTexto`, `enviarImagen`, `enviarPlantilla`, `ventanaAbierta`, `numeroPropioDe` |
| `supabase/functions/wa-send/index.ts` | Envío manual desde el panel (JWT de admin) |
| `supabase/functions/wa-webhook/index.ts:111-135` | Acuses de entrega |
| `supabase/functions/plantillas-programadas/index.ts` | Avisos programados (395 líneas) |

### Tablas y columnas

| Tabla | Uso |
|---|---|
| `whatsapp_conversaciones` | `wa_message_id` (único), `delivery_status`, `error_wa`, `enviado_por`, `wa_phone_id` |
| `plantillas_enviadas` | Candado anti-duplicado, con **dos índices únicos parciales** |
| `customers` | `no_escribir` — lista de exclusión |
| `ajustes_internos` | `cron_secreto`, `telefonos_avisos` |

### Variables de entorno

`WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `PLANTILLAS_ACTIVAS`.

## Decisiones tomadas y por qué

**Los mensajes se trocean por líneas en blanco** (`wa.ts:255-286`): hasta 3 mensajes, con
**pausas proporcionales a la longitud** de cada uno y el indicador de "escribiendo" entre
medias. Es la diferencia entre parecer una persona y parecer un formulario.

**El indicador se refresca cada 20 segundos** (`wa.ts:234-245`) porque **el de Meta expira
a los 25**. Sin el refresco, en una respuesta que tarda, el cliente veía el indicador
desaparecer y volver.

**`wa_phone_id` se guarda por conversación** (migración `20260818_wa_phone_id.sql`).
Arregla un fallo concreto: el bot respondía por el **número de prueba** en vez de por el
número desde el que le habían escrito.

**`wa_message_id` tiene índice único**, y el código detecta el error `23505` de Postgres
(`wa-webhook:189-206`). Meta reenvía mensajes cuando duda de la entrega; sin este candado,
Valentina respondía dos veces al mismo mensaje.

**El webhook responde 200 a Meta de inmediato** y sigue trabajando en
`EdgeRuntime.waitUntil` (`:322`). Meta reintenta si tardas, y reintentar significa
duplicar.

**El takeover se libera solo a las 6 h sin actividad humana** (`wa.ts:424-464`). Una
persona que toma un chat y se olvida deja a Valentina muda para siempre en esa
conversación.

**`plantillas_enviadas` lleva DOS índices únicos parciales**, uno por pedido y otro por
persona (`20260819_plantillas_programadas.sql`). Un `UNIQUE` normal no sirve: **en Postgres
los NULL no colisionan entre sí**, así que un aviso sin pedido asociado se habría podido
mandar infinitas veces.

**`PLANTILLAS_ACTIVAS` está apagada por defecto.** Las plantillas cuestan dinero y se
mandan a clientes reales. Un fallo aquí no se puede deshacer: el mensaje ya llegó.

**El modo prueba puede quemar plantillas.** Hubo un incidente (`fix/modo-prueba-quema`): un
pedido `es_prueba` disparaba una plantilla real y consumía el candado, de modo que el aviso
de verdad ya no salía. Cuidado al probar.

**`customers.no_escribir`** existe para que alguien que pidió que no le escriban quede
excluido, con independencia de la lógica de cada aviso.

**Los disparos están programados con `pg_cron` dentro de Supabase**, autenticados con el
header `x-cron-secreto`, cuyo valor vive en `ajustes_internos.cron_secreto` — no en
variables de entorno, para poder rotarlo sin redesplegar. **La programación está
versionada** desde el 23 de agosto de 2026 en `20260823_el_reloj_de_la_base.sql`:

```
avisos-whatsapp   0 0,1,13-23 * * *   (UTC)
```

Que en Bogotá (UTC-5) es **de 8 de la mañana a 8 de la noche, cada hora en punto**. Fuera
de esa franja no se manda nada: una plantilla a las tres de la madrugada no ayuda a nadie
y sí quema el candado de `plantillas_enviadas`.

**El aviso de despacho ya está hecho y desplegado**; sólo espera a que Meta apruebe la
plantilla `pedido_en_camino`.

## Límites conocidos y pendientes

- El aviso `pedido_en_camino` está bloqueado por la aprobación de Meta.
- No hay panel de plantillas: para saber qué se mandó hay que consultar
  `plantillas_enviadas` a mano.
- WhatsApp **no acepta WebP**: falla con un 200 engañoso. Toda imagen que se mande debe ser
  la gemela `.jpeg` — ver [admin-catalogo.md](admin-catalogo.md).

## Cómo probarlo

1. **Troceado:** haz que Valentina responda algo con dos párrafos separados por línea en
   blanco. Deben llegar como **dos mensajes**, con pausa e indicador entre medias.
2. **Indicador:** provoca una respuesta lenta (una cotización) y comprueba que el
   "escribiendo…" no parpadea.
3. **Ventana de 24 h:** con un chat cuyo último mensaje del cliente tenga más de 24 h,
   `enviarTexto` debe fallar y la ruta correcta ser una plantilla.
4. **Reentrega:** reenvía el mismo `wa_message_id`. No debe duplicarse la fila ni la
   respuesta.
5. **Takeover:** actívalo y espera (o adelanta el reloj de la base). A las 6 h sin
   actividad debe liberarse y Valentina volver a responder.
6. **Candado de plantillas:** invoca `plantillas-programadas` dos veces seguidas. La
   segunda no debe mandar nada.
7. **`PLANTILLAS_ACTIVAS`:** con la variable apagada, la función debe salir sin mandar.

```bash
npx supabase functions logs wa-send --tail
npx supabase functions logs plantillas-programadas --tail
```
