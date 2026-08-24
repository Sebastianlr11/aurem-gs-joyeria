# WhatsApp — envío, ventana de 24 h y plantillas

> **Estado:** en producción · **plantillas encendidas y mandando de verdad desde el 22 de agosto de 2026**
> **Última revisión:** 2026-08-23
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
| `supabase/functions/plantillas-programadas/index.ts` | Avisos programados (504 líneas) |

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

**`PLANTILLAS_ACTIVAS` viene apagada por defecto, y en producción está encendida** desde
el 22 de agosto de 2026. Apagada, la función recorre todo el camino —candado incluido— y
reporta qué mandaría sin mandar nada; es como se prueba sin riesgo. El valor por defecto es
«apagado» porque las plantillas cuestan dinero y se mandan a clientes reales: un fallo aquí
no se puede deshacer, el mensaje ya llegó.

**El modo prueba puede quemar plantillas.** Hubo un incidente (`fix/modo-prueba-quema`): un
pedido `es_prueba` disparaba una plantilla real y consumía el candado, de modo que el aviso
de verdad ya no salía. Cuidado al probar.

**`customers.no_escribir`** existe para que alguien que pidió que no le escriban quede
excluido, con independencia de la lógica de cada aviso.

**Los dos frenos los comprueba la base, no el código**, con
`public.puede_recibir_plantillas(telefono)`: que nadie haya pedido que no le escriban y que
nadie del equipo esté atendiendo ese chat. Se pregunta así desde el 23 de agosto de 2026,
porque antes se hacía aquí con `.eq('phone', …)` —comparando la cadena cruda— y **el mismo
número entra de tres formas según el canal**: `3143602930` desde el panel, `+573143602930`
desde el checkout, `573143602930` desde WhatsApp. Con 18 pedidos en la base, diez tenían el
teléfono en un formato distinto al de su ficha de cliente: para esos diez **ninguno de los
dos frenos se consultaba nunca**. La búsqueda no encontraba nada y el código lo leía como
«adelante». No daba error; decía que sí.

La función compara por los últimos diez dígitos con la misma expresión del índice único de
`customers`. Y si la consulta falla, **no se escribe**: callar es recuperable, escribirle a
quien pidió que no lo hicieran no lo es.

**El número de destino se normaliza con `aNumeroDeWhatsApp`** antes de mandar. Un pedido
cargado a mano en el panel guarda el móvil sin indicativo y Meta no entrega a diez dígitos
pelados. Sólo se le antepone el 57 a lo que es inequívocamente un móvil colombiano —diez
dígitos empezando por 3—; a lo demás no se le inventa un país.

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

### Las cuatro plantillas

| Nombre | Categoría | Cuándo sale | Variables |
|---|---|---|---|
| `pieza_en_fabricacion` | Utilidad | Pedido en `procesando` en las últimas 48 h | nombre · pieza |
| `pedido_en_camino` | Utilidad | Pedido en `enviado` con guía y transportadora reconocida | nombre · pieza · transportadora · guía |
| `pago_pendiente` | Utilidad | `pendiente` con enlace de Mercado Pago generado hace 3 h a 2 días | nombre · pieza |
| `cotizacion_sin_cerrar` | **Marketing** | Habló, se interesó en una pieza concreta y no volvió en 2 a 4 días | nombre · pieza |

Las tres primeras se despertaron el 22 de agosto de 2026, cuando Meta las aprobó y se puso
`PLANTILLAS_ACTIVAS=true`. La cuarta —**`pieza_en_fabricacion`, del 23 de agosto**— tapa el
hueco de silencio del recorrido: la clienta abona el envío y lo siguiente que sabe es que el
paquete ya salió, con tres o cuatro días sin noticias en medio, que es justo cuando alguien
que le pagó por WhatsApp a una tienda que no conoce se pone nerviosa. Sale al marcar
«Empezar a fabricar», con hasta una hora de retraso.

### Un fallo cancelaba el aviso para siempre

`mandar()` anota la fila **antes** de enviar, porque el índice único es lo que garantiza que
un aviso no salga dos veces si dos corridas se solapan. Pero cuando el envío fallaba, la
fila se quedaba ahí con el error escrito — y el candado no distingue «ya salió» de «se
intentó y no salió». **Cualquier tropiezo, o una plantilla todavía sin aprobar, cancelaba
definitivamente el aviso de ese pedido**: el cliente no se enteraba nunca y en la tabla sólo
quedaba una fila con un error que nadie mira.

Desde el 23 de agosto de 2026, **si Meta contesta que no, se suelta el candado** y la
siguiente corrida lo reintenta. La ventana de búsqueda de cada aviso —48 horas— acota el
reintento. Si en cambio la petición ni siquiera obtiene respuesta —red, Meta caída—, el
candado **no** se suelta: no se sabe si el mensaje salió, y un duplicado es peor que un
aviso que no llega.

Esto es lo que permite desplegar una plantilla antes de que Meta la apruebe sin quemar nada:
mientras la rechace, cada intento falla y se reintenta; el día que la aprueben, sale.

## Límites conocidos y pendientes

- `pieza_en_fabricacion` **está desplegada pero Meta aún no la ha aprobado**: hasta entonces
  cada intento se rechaza y se reintenta, sin gastar el candado.
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
