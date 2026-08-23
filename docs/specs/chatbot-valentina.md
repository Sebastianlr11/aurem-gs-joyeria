# Valentina — el chatbot de WhatsApp

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Dónde vive:** `supabase/functions/_shared/bot.ts` (1.095 líneas)

## Qué resuelve

**Valentina es el motor comercial del negocio, no un widget de soporte.** Atiende WhatsApp
en español de Colombia, entiende fotos y notas de voz, responde con el catálogo real,
cotiza piezas a medida con el precio del oro del día, arma pedidos completos y escala a
una persona cuando algo se sale de lo que sabe.

El encargo original es preciso: **es para cotizar a medida, no para vender catálogo**. El
catálogo es el suelo de lo que puede afirmar; el trabajo de verdad es la pieza que todavía
no existe.

La premisa que gobierna todo el diseño:

> **Un modelo al que le falta un número no calla: rellena.**
> Por eso el catálogo, las políticas, los precios y los pedidos **salen de la base, no del
> modelo** (`bot.ts:1-5`).

## Cómo funciona hoy

### Flujo end-to-end

```
Cliente escribe por WhatsApp
  ↓
Meta → wa-webhook (POST)
  ├── valida la firma HMAC SHA-256      ← falla CERRADO si no hay WA_APP_SECRET
  ├── ¿acuse de entrega? → actualiza delivery_status y termina
  ├── ¿tipo no interpretable? → responde pidiendo otra cosa
  └── guarda la fila role='user' con wa_message_id (índice único = anti-reentrega)
        ├── audio → transcribe        ┐ y REESCRIBE la fila con el contenido real
        └── imagen → describe         ┘ para que el modelo no lea "[audio]"
  ↓ responde 200 a Meta ya; sigue en EdgeRuntime.waitUntil
  ↓ espera 8 s   ← deja que el cliente termine de escribir
  ↓ ¿llegó otro mensaje mientras tanto? → esta invocación se calla
  ↓
responder()  [bot.ts]
  ├── ¿hay takeover activo? → no contesta, escribe una persona
  ├── arma el system prompt EN CALIENTE:
  │     catálogo publicado + taller_conocimiento + cifras COD + anuncio de origen
  ├── contexto: últimos 20 mensajes
  └── bucle de agente: máx 3 pasos / 25 s, último paso SIN herramientas
        ├── mostrar_pieza
        ├── calcular_talla
        ├── cotizar_oro
        ├── crear_pedido    → delega en create-preference
        └── escalar_a_humano
  ↓
enviarTextoNatural()  → ver whatsapp-envio-y-plantillas.md
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `supabase/functions/_shared/bot.ts:8` | `MODELO` — `OPENROUTER_MODEL`, por defecto `openai/gpt-5.6-luna-pro` |
| `bot.ts:9` | `MENSAJES_DE_CONTEXTO = 20` |
| `bot.ts:14-16` | `MAX_PASOS = 3`, `PRESUPUESTO_MS = 25_000`, `MAX_FOTOS = 3` |
| `bot.ts:22-23` | `DIAS_PARA_AVISAR = 3`, `DIAS_PARA_NO_COTIZAR = 10` |
| `bot.ts:28-60` | Catálogo y políticas leídos de la base |
| `bot.ts:62-90` | `cifrasContraentrega()` |
| `bot.ts:92-120` | `referralDe()` — el anuncio de origen |
| `bot.ts:174-326` | **El system prompt**, compuesto en runtime. 24 reglas numeradas |
| `bot.ts:328-445` | Definición de las 5 herramientas |
| `bot.ts:470-471` | `temperature: 0.3`, `max_tokens: 600` |
| `bot.ts:484-489` | Tabla de tallas **en código**, fuera del prompt |
| `bot.ts:637-640` | Se niega a cotizar si el precio del oro lleva >10 días sin tocar |
| `bot.ts:861-991` | Escalada a humano |
| `bot.ts:1005-1010` | Ventana de contexto |
| `bot.ts:1030-1032` | Prefijo `[Lo escribió una persona del equipo]` |
| `bot.ts:1048-1055` | El bucle de agente |
| `supabase/functions/wa-webhook/index.ts` | Entrada (326 líneas) |
| `supabase/functions/_shared/medios.ts` | Audio y visión (221 líneas) |

### Tablas y columnas

| Tabla | Uso |
|---|---|
| `whatsapp_conversaciones` | Todo el historial. `wa_message_id` **único** es el candado anti-reentrega |
| `taller_conocimiento` | Las políticas que puede afirmar — editables desde el panel |
| `taller_precios` | Precio del oro, recargo, gramos mínimos, tope y abono de contraentrega |
| `products` | El catálogo real que se inyecta en el prompt |
| `chat_takeover` | Si está activo, Valentina se calla |
| `ajustes_internos` | `telefonos_avisos` — a quién avisar al escalar |

### Variables de entorno

`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_VISION_MODEL`,
`OPENROUTER_AUDIO_MODEL` (por defecto `mistralai/voxtral-small-24b-2507`), `WA_TOKEN`,
`WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.

**El modelo va por OpenRouter, no por una API de proveedor directa.**

## Decisiones tomadas y por qué

**El prompt se compone en caliente en cada respuesta** (`bot.ts:174-326`). No es una
constante: cada vez se leen el catálogo publicado, `taller_conocimiento`, las cifras de
contraentrega y el anuncio del que vino el chat. Así, publicar una pieza o corregir una
política cambia lo que Valentina dice **sin desplegar nada**.

**Las cifras de contraentrega se le dan explícitamente, y la regla las repite tres veces**
(`bot.ts:62-90` y regla 6b). Viene del primer incidente real: le dijo a un cliente que el
abono eran *"unos $15.000"* y **cincuenta segundos después le mandó un enlace de $20.000**.
No tenía el dato, así que lo adivinó. La regla ahora dice literalmente *"no lo redondees,
no digas 'unos', no digas 'aproximadamente' y NUNCA des otra cifra"*. **Si el dato no está
disponible, se le instruye que no ofrezca contraentrega en absoluto** — perder una venta es
una molestia; prometer una cifra equivocada sobre plata ajena es otra cosa.

**La tabla de tallas está en código, no en el prompt** (`bot.ts:484-489`). Convertir
milímetros a talla es aritmética, y un modelo que "razona" una tabla numérica se equivoca.
Es una herramienta, no una instrucción.

**No cotiza con el oro rancio** (`bot.ts:637-640`). Si `taller_precios` lleva más de 10
días sin actualizarse, `cotizar_oro` se niega. A los 3 días ya avisa. El comentario aclara
el matiz: el joyero **no** cambia la cotización por movimientos chicos —*"si mañana baja
5000 o sube 3000 no importa"*— así que el dato se usa tal cual; lo que se vigila es que no
esté **abandonado**.

**Espera 8 segundos antes de responder** (`wa-webhook:18, 297`), y si mientras tanto llega
otro mensaje, **esta invocación se calla** (`:299-309`). La gente escribe en ráfagas de tres
mensajes cortos; sin esto, Valentina contestaba tres veces a medias.

**El audio y la imagen reescriben la fila del mensaje** (`wa-webhook:262-292`). Se guarda
primero como `[audio]`, se transcribe, y **se sobrescribe el contenido**. Si no, el modelo
leería literalmente `[audio]` en el contexto y respondería a eso. Efecto secundario visible
en el panel: por eso `ChatPanel` necesita suscribirse a los `UPDATE` y no sólo a los
`INSERT`.

**Los mensajes escritos por una persona se le marcan** (`bot.ts:1030-1032`) con el prefijo
`[Lo escribió una persona del equipo]`. Sin la marca, Valentina veía una cotización hecha a
mano en el historial, la tomaba por suya, e intentaba **recalcularla** con datos que no
tenía.

**El bucle de agente tiene tres frenos** (`bot.ts:14-15, 1048-1055`): máximo 3 pasos, 25
segundos de presupuesto, y **el último paso va sin herramientas** para garantizar que
siempre termina con algo que decirle al cliente. *"Un agente sin freno es una factura sin
freno."*

**`temperature: 0.3` y `max_tokens: 600`**: es una asesora de ventas que debe ser
consistente y breve, no creativa.

**Regla 2: no puede decir "no te entendí".** Debe repetir lo que creyó entender y preguntar
por lo que falta. Un "no te entendí" en WhatsApp es una conversación perdida.

**Regla 5: nunca deja un pedido sin cerrar por un correo.** Lo pide, insiste **una** vez, y
si no lo dan cierra igual. *"Vale mucho más la venta que el dato."*

**La escalada avisa por dos vías** (`bot.ts:861-991`): plantilla `aviso_equipo` a los
números de `ajustes_internos.telefonos_avisos` **y** correo `chat-escalado` a todos los
usuarios de `auth.users`. Se libera sola a las 6 h sin actividad humana
(`wa.ts:403, 424-464`) — porque una escalada olvidada deja a Valentina muda para siempre en
ese chat.

**El anuncio de origen se usa para abrir, no para recitar.** Meta manda el `referral` sólo
en el primer mensaje, así que se busca el más antiguo de la conversación. La instrucción
es demostrar que sabe qué vio el cliente, sin repetir el texto del anuncio — y **si el
anuncio prometía algo que no está en las políticas, no confirmarlo y escalar**.

## Límites conocidos y pendientes

- **Verificar `taller_conocimiento`.** El seed de la migración dejó las primeras 6 filas marcadas
  *"SIN CONFIRMAR"*, y Valentina lee esa tabla en caliente. Los claims ya se verificaron
  con el joyero, así que lo probable es que la base esté al día y sólo el seed haya
  quedado atrás — pero conviene confirmarlo, y actualizar el seed
  ([pendientes #12](../pendientes.md)).
- El contexto son 20 mensajes: en una conversación larga, lo del principio se pierde.
- El coste por conversación no está instrumentado.
- No hay evaluaciones automáticas del prompt. Cada regla nueva se añade tras un incidente.
- `MAX_FOTOS = 3` por tanda: más satura el chat.

## Cómo probarlo

**Nunca pruebes contra un número de cliente real.** Usa el número de pruebas de Meta.

1. **Que no invente:** pregúntale por una pieza que no está en el catálogo. Debe decir que
   no la tiene y ofrecer lo que sí hay.
2. **El abono:** pregúntale cuánto es el abono de contraentrega. Debe dar la cifra **exacta**
   de `taller_precios.abono_envio`, sin "unos" ni "aproximadamente".
3. **Sin cifras:** pon `abono_envio` a `null` y vuelve a preguntar. **No debe ofrecer
   contraentrega.**
4. **Oro rancio:** atrasa la fecha del precio del oro más de 10 días. `cotizar_oro` debe
   negarse.
5. **Ráfaga:** manda tres mensajes seguidos rápido. Debe responder **una sola vez**, a los
   tres.
6. **Audio e imagen:** manda una nota de voz y una foto. En `whatsapp_conversaciones` el
   `content` debe acabar siendo la transcripción/descripción, no `[audio]`.
7. **Reentrega:** Meta reenvía mensajes. El `wa_message_id` único debe absorberlo sin
   duplicar (busca el código `23505` en los logs).
8. **Escalada:** pídele algo fuera de sus políticas. Debe marcar `chat_takeover`, avisar por
   plantilla y por correo, y **callarse** hasta que la persona termine.
9. **Tras la escalada:** que un humano escriba y luego se libere el takeover. Valentina no
   debe recalcular lo que escribió la persona.

```bash
npx supabase functions logs wa-webhook --tail
```
