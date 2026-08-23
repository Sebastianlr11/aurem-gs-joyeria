# Panel — conversaciones

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/admin/chat` · `src/pages/admin/ChatPanel.jsx` (1.923 líneas) + `chat/`
> (`comunes.js`, `piezas.jsx`, `BuscadorDeMensajes.jsx`)

## Qué resuelve

Leer lo que Valentina está conversando y **tomar el control cuando hace falta**. Es la
única ruta del panel aparte del Dashboard, y por buenas razones: es una pantalla de tiempo
real que no se puede montar y desmontar como una pestaña.

## Cómo funciona hoy

### Estructura

```
┌────────────┬──────────────────────┬──────────────┐
│ Contactos  │  Hilo activo         │ Ficha del    │
│ (últimos   │  (últimos 200 msg)   │ contacto     │
│ 1000 msg   │                      │ pedidos,     │
│ agrupados) │  compositor          │ notas, tags  │
└────────────┴──────────────────────┴──────────────┘
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `ChatPanel.jsx:304-361` | `fetchContacts` — 1000 mensajes, agrupa por teléfono, cruza `customers`, cuenta no leídos |
| `ChatPanel.jsx:10-14` | Normalización del teléfono con prefijo 57 |
| `ChatPanel.jsx:471-495` | Hilo activo + marcado automático como leído |
| `ChatPanel.jsx:589-749` | Canal `chat-realtime` — dos suscripciones |
| `ChatPanel.jsx:683-700` | Suscripción a **`UPDATE`** — imprescindible |
| `ChatPanel.jsx:706-733` | Fallback de polling si el canal cae |
| `ChatPanel.jsx:756-817` | Envío vía `wa-send`, con burbuja optimista |
| `ChatPanel.jsx:426-468, 819-835` | Takeover |
| `ChatPanel.jsx:71-104` | Imágenes: públicas de catálogo vs privadas firmadas |
| `ChatPanel.jsx:44-68` | `PieDeFoto` — el pie de la clienta y "lo que vio Valentina" |
| `ChatPanel.jsx:534-583` | Móvil: bloqueo de scroll y teclado de iOS |
| `ChatPanel.jsx:410-419` | Búsqueda vía `rpc('buscar_conversaciones')`, debounce 400 ms |
| `src/pages/admin/EliminarChat.jsx` | Borrado completo con fricción |

### Tablas y Storage

`whatsapp_conversaciones`, `customers`, `chat_status`, `contact_tags`, `chat_takeover`,
`products`, `orders`. Storage **`chat-media`** (privado). Edge Function `wa-send`.
RPC `buscar_conversaciones`.

## Decisiones tomadas y por qué

**Hay dos suscripciones de realtime, no una** (`:589-749`). La de `UPDATE` (`:683-700`) es
**imprescindible**, no un extra: una foto entra a la base como `[image]` y un audio como
`[audio]`, y el contenido real llega **segundos después**, cuando el bot termina de
transcribir o describir (ver [chatbot-valentina.md](chatbot-valentina.md)). Sin escuchar
los `UPDATE`, el panel se quedaba enseñando `[audio]` para siempre. Por el mismo canal
llegan los acuses de entrega.

**Hay fallback de polling** (`:706-733`): si el canal cae (`CHANNEL_ERROR` / `TIMED_OUT`),
pasa a consultar contactos cada 10 s y mensajes cada 5 s. Un panel de chat que se queda
mudo sin avisar es peor que uno lento.

**Las fotos de las clientas viven en un bucket privado y se firman al vuelo por 1 hora**
(`:90`). Son fotos que manda gente real —a veces de su propia mano con un anillo puesto—;
no pueden estar en una URL pública adivinable.

**`PieDeFoto` (`:44-68`) muestra el pie que escribió la clienta y esconde tras un clic "lo
que vio Valentina"**: la descripción que el modelo generó para su propio contexto. Es la
ventana para entender por qué el bot respondió lo que respondió, sin ensuciar la lectura
normal del chat.

**El teclado de iOS obligó a CSS a medida** (`:554-583`): variables `--vv-alto` y `--vv-top`
alimentadas desde `visualViewport`, más la clase `chat-abierto` en `<html>` (`:534-538`)
para bloquear el scroll del documento. Sin eso, el compositor quedaba debajo del teclado.

**Burbuja optimista al enviar** (`:756-817`), con marca `_failed` si falla. Escribir por
WhatsApp desde un panel que tarda en confirmar se siente roto.

**El takeover tiene su propio canal de realtime** (`:426-468`): cuando Valentina escala, el
panel suena y notifica **aunque estés en otro contacto**. Se guarda `admin_email` para
saber quién tomó el chat, y la fila se marca visualmente con `--takeover`.

**Los contactos archivados se desarchivan solos si el cliente vuelve a escribir**
(`:618-631`). Archivar significa "terminado", no "no me interesa".

**Notificación de escritorio sólo si la pestaña está oculta**, y toast si el mensaje es de
otro contacto (`:658-665`). Refresco de la lista con debounce de 800 ms.

## Retención y borrado de conversaciones (en curso)

Añadido el 22 de agosto de 2026:
`src/lib/chatArchivo.js`, `EliminarChat.jsx`, `20260822_borrar_chat_media.sql` y
`20260822_conversaciones_purgables.sql`.

### `src/lib/chatArchivo.js` — la API del archivo

Vive fuera de los componentes porque **lo usan tres sitios que no se conocen entre sí**: el
diálogo de eliminar uno, el borrado en lote y el menú de exportar. Antes cada uno tenía su
copia y no hacían lo mismo — **la exportación se llevaba sólo los 200 mensajes cargados en
pantalla y no lo decía**.

| Función | Qué |
|---|---|
| `borrarTodoDe(telefono)` | Borra el hilo entero |
| `borrarFotosDe(telefono)` | Sólo las fotos |
| `traerMensajes(telefono)` | El hilo completo, no los 200 de pantalla |
| `descargarChat(telefonos, formato)` | Exportación TXT/CSV, también en lote |

> **La regla que atraviesa el módulo: Storage primero, filas después.** Las fotos son lo
> único que no vive en una tabla; si se borran las filas y falla Storage, quedan archivos
> huérfanos con la correspondencia de una clienta **que nadie va a volver a encontrar**. Al
> revés no pasa nada: un chat sin borrar se vuelve a borrar. Storage lista de a 1000 y el
> bucle pagina, *"porque un bucle que se planta en el primer millar borra a medias el día
> que sí llega"*.

### Qué se puede purgar — `conversaciones_purgables(p_meses)`

La política de privacidad **promete** que las conversaciones y las fotos se conservan
*"mientras sigas siendo cliente y durante el tiempo en que puedas presentar un reclamo o
hacer valer la garantía"*, y que después se eliminan. Hasta ahora **no había retención en
ninguna tabla del proyecto**: esa frase era una promesa que el panel no podía cumplir.

El criterio lo fija la propia garantía: **la del metal es de por vida**, así que quien
alguna vez hizo un pedido real **no prescribe nunca**. Lo que se puede soltar es el hilo de
quien preguntó, no compró y lleva un año sin volver.

Tres detalles que importan:

- **Cruza teléfonos por los últimos 10 dígitos.** `orders.customer_phone` guarda el mismo
  número como `+573143602930` y como `3143602930`; cruzar las columnas tal cual **no
  encontraba al comprador la mitad de las veces** — y no encontrarlo ahí significa ofrecer
  borrar el hilo de una clienta con garantía viva.
- **Los pedidos `es_prueba` no protegen a nadie**: si contaran, los hilos de las pruebas no
  se podrían limpiar nunca.
- **Un chat con takeover activo está vivo por definición** y queda fuera.

> **Sólo propone.** No borra, no corre solo, no hay cron detrás. El panel lo enseña como
> filtro, se revisa, y **quien decide es una persona**. *"Una purga automática de
> correspondencia de clientas no se enciende sin mirarla."*

### El diálogo y el lote

- Pide escribir **los 4 últimos dígitos del teléfono** (`EliminarChat.jsx:97-98`) — misma
  fricción que `EliminarPieza`; en lote, cuántas son.
- Muestra antes cuántos mensajes y fotos hay y desde cuándo, y avisa de pedidos vivos
  excluyendo `es_prueba`.
- **Un lote que falla entero por una conversación es peor que un lote a medias**
  (`:153`): se sigue con las demás.
- La fila de contacto pasó de `<button>` a `div role="button" tabIndex=0`, porque el menú de
  tres puntos por fila metía un botón dentro de otro botón — HTML inválido.

⚠️ **Si `20260822_borrar_chat_media.sql` no está aplicada, el borrado falla en el paso de
fotos y —por diseño— no borra nada.**

## Límites conocidos y pendientes

- **Conviene confirmar que `20260822_borrar_chat_media.sql` está aplicada en Supabase**,
  no sólo commiteada ([pendientes #5](../pendientes.md)).
- **La purga no está automatizada** y es deliberado: el panel propone, decide una persona.
- `fetchContacts` trae **los últimos 1000 mensajes** y agrupa en cliente: no escala.
- El hilo carga 200 mensajes sin paginación hacia atrás.
- `buscar_conversaciones` **no está versionada**.
- Las respuestas rápidas viven en `localStorage`, así que son por navegador, no por equipo.

## Cómo probarlo

1. **La prueba clave — `UPDATE`:** manda una nota de voz desde WhatsApp con el panel
   abierto. Debe aparecer primero como audio y **actualizarse sola** a la transcripción,
   sin recargar.
2. **Fallback:** corta la red unos segundos y devuélvela. El panel debe seguir
   actualizándose (por polling) y no quedarse mudo.
3. **Foto privada:** abre una foto de una clienta y copia la URL firmada. Al cabo de una
   hora debe dejar de funcionar.
4. **Takeover:** provoca una escalada desde otro contacto. Debe sonar y notificar aunque
   estés mirando otro chat.
5. **Desarchivado:** archiva un contacto y haz que escriba. Debe volver solo a la lista.
6. **iOS:** abre el panel en un iPhone real y toca el compositor. No debe quedar tapado por
   el teclado.
7. **Borrado:** con dígitos equivocados no debe dejar. Con los correctos, comprueba que el
   bucket queda limpio **y** las cuatro tablas también.
