# Panel — conversaciones

> **Estado:** en producción
> **Última revisión:** 2026-09-06
> **Ruta:** `/admin/chat` · `src/pages/admin/ChatPanel.jsx` + catorce archivos
> en `src/pages/admin/chat/`: `comunes.js`, `piezas.jsx`, `ganchos.js`, `useSuscripcion.js`,
> `BuscadorDeMensajes.jsx`, `FichaDelContacto.jsx`, `SelectorDeImagen.jsx`,
> `FilaDeContacto.jsx`, `CabeceraDeContactos.jsx`, `DialogoDeConfirmacion.jsx`,
> `HiloDeMensajes.jsx`, `Compositor.jsx`, `SiguientePorAtender.jsx`,
> `MenuDeAcciones.jsx` — más sus cinco archivos de prueba.

> **Sin números de línea, a propósito.** Los llevaba, y al partirse el componente todos
> quedaron apuntando a sitios que ya no existen. Una referencia falsa manda a buscar donde
> no está: peor que ninguna. Se nombran archivos y funciones.

## Qué resuelve

Leer lo que Valentina está conversando y **tomar el control cuando hace falta**. Es la
única ruta del panel aparte del Dashboard, y por buenas razones: es una pantalla de tiempo
real que no se puede montar y desmontar como una pestaña.

## Cómo funciona hoy

### Estructura

```
┌────┬────────────┬──────────────────────┬──────────────┐
│ ri │ Contactos  │  Hilo activo         │ Ficha del    │
│ el │ (últimos   │  (últimos 200 msg)   │ contacto     │
│ 72 │ 1000 msg   │                      │ pedidos,     │
│ px │ agrupados) │  compositor          │ notas, tags  │
└────┴────────────┴──────────────────────┴──────────────┘
```

**Esta pantalla no lleva la barra de arriba del panel.** Es la única, y desde el 6 de
septiembre de 2026: decía «Conversaciones» y justo debajo la cabecera de la lista repetía
«Chats». Lo que llevaba —el punto de conexión en vivo, el altavoz y el avatar de la
cuenta— se mudó a la cabecera de la lista. Por la misma razón la navegación se encoge a un
riel de 72px sólo aquí (`.admin-layout--riel`): es la única pantalla que se usa de corrido
y los 260px del menú se los estaba quitando al hilo.

### Archivos clave

| Ruta | Qué |
|---|---|
| `ChatPanel.jsx` | `fetchContacts` — 1000 mensajes, agrupa por teléfono, cruza `customers`, cuenta no leídos |
| `chat/comunes.js` | Normalización del teléfono con prefijo 57 y demás utilidades compartidas |
| `ChatPanel.jsx` | Hilo activo + marcado automático como leído |
| `ChatPanel.jsx` | Canal `chat-realtime` — dos suscripciones, y el fallback de polling si cae |
| `chat/useSuscripcion.js` | El gancho que abre y cierra un canal de realtime sin fugas |
| `chat/Compositor.jsx` | La caja de escribir; el envío vía `wa-send` con burbuja optimista está en `ChatPanel.jsx` |
| `chat/CabeceraDeContactos.jsx` · `chat/FilaDeContacto.jsx` | Título, pulso, buscador, pestañas y el menú de cada fila |
| `chat/SiguientePorAtender.jsx` | La tarjeta de arriba de la lista: quién sigue |
| `chat/MenuDeAcciones.jsx` | Las acciones del chat abierto: desplegable en escritorio, hoja inferior en el celular |
| `chat/piezas.jsx` | Imágenes: públicas de catálogo vs privadas firmadas, y `PieDeFoto` |
| `chat/HiloDeMensajes.jsx` | Las burbujas, los acuses y el visor de fotos |
| `chat/ganchos.js` | Los ganchos sueltos: avisos, visor, scroll |
| `chat/BuscadorDeMensajes.jsx` | Búsqueda vía `rpc('buscar_conversaciones')`, debounce 400 ms |
| `chat/FichaDelContacto.jsx` | La ficha lateral: pedidos, etiquetas, plata |
| `chat/SelectorDeImagen.jsx` · `chat/DialogoDeConfirmacion.jsx` | Mandar una foto del catálogo · confirmar lo que no se deshace |
| `src/pages/admin/EliminarChat.jsx` | Borrado completo con fricción |

### Tablas y Storage

`whatsapp_conversaciones`, `customers`, `chat_status`, `contact_tags`, `chat_takeover`,
`products`, `orders`. Storage **`chat-media`** (privado). Edge Function `wa-send`.
RPC `buscar_conversaciones`.

## Decisiones tomadas y por qué

**Hay dos suscripciones de realtime, no una.** La de `UPDATE` es
**imprescindible**, no un extra: una foto entra a la base como `[image]` y un audio como
`[audio]`, y el contenido real llega **segundos después**, cuando el bot termina de
transcribir o describir (ver [chatbot-valentina.md](chatbot-valentina.md)). Sin escuchar
los `UPDATE`, el panel se quedaba enseñando `[audio]` para siempre. Por el mismo canal
llegan los acuses de entrega.

**Hay fallback de polling**: si el canal cae (`CHANNEL_ERROR` / `TIMED_OUT`),
pasa a consultar contactos cada 10 s y mensajes cada 5 s. Un panel de chat que se queda
mudo sin avisar es peor que uno lento.

**Las fotos de las clientas viven en un bucket privado y se firman al vuelo por 1 hora**
(`chat/piezas.jsx`). Son fotos que manda gente real —a veces de su propia mano con un anillo puesto—;
no pueden estar en una URL pública adivinable.

**`PieDeFoto` muestra el pie que escribió la clienta y esconde tras un clic "lo
que vio Valentina"**: la descripción que el modelo generó para su propio contexto. Es la
ventana para entender por qué el bot respondió lo que respondió, sin ensuciar la lectura
normal del chat.

**El teclado de iOS obligó a CSS a medida**: variables `--vv-alto` y `--vv-top`
alimentadas desde `visualViewport`, más la clase `chat-abierto` en `<html>`
para bloquear el scroll del documento. Sin eso, el compositor quedaba debajo del teclado.

**Burbuja optimista al enviar**, con marca `_failed` si falla. Escribir por
WhatsApp desde un panel que tarda en confirmar se siente roto.

**El takeover tiene su propio canal de realtime**: cuando Valentina escala, el
panel suena y notifica **aunque estés en otro contacto**. Se guarda `admin_email` para
saber quién tomó el chat, y la fila se marca visualmente con `--takeover`.

**Los contactos archivados se desarchivan solos si el cliente vuelve a escribir**
(`ChatPanel.jsx`). Archivar significa "terminado", no "no me interesa".

**Notificación de escritorio sólo si la pestaña está oculta**, y toast si el mensaje es de
otro contacto. Refresco de la lista con debounce de 800 ms.

## El rediseño «1b» — 6 de septiembre de 2026

De dos direcciones dibujadas en Claude Design, el joyero eligió ésta. Lo que cambió y por
qué:

**Una tarjeta dice quién sigue** (`SiguientePorAtender.jsx`). La lista contesta «qué pasó»,
ordenada por lo último que entró; no contestaba «qué hago ahora» — y la conversación que
más lleva sin respuesta es justamente la que la lista empuja hacia abajo, porque hace horas
que nadie escribe en ella. El filtro «Por atender» ya recortaba eso, pero hay que acordarse
de pulsarlo. La tarjeta está puesta antes de que nadie pulse nada.

Sus dos decisiones viven en `comunes.js` y están probadas, porque las dos se equivocan en
silencio: `siguientePorAtender()` usa los **mismos tres requisitos** que el filtro —sigue
abierta, la última palabra la tiene la clienta, no está archivada— y de ésas gana la que
**más lleva esperando**, no la más reciente. No se pinta si hay una búsqueda puesta, si hay
una selección abierta, en «archivados» y «para purgar», ni cuando señalaría al chat que ya
está abierto.

**La espera reemplaza a la fecha en la fila.** «4 sept» contesta cuándo habló; «5 h sin
resp.» contesta cuánto lleva sin respuesta, que es lo que hace falta. Sólo se enciende —en
oro— en las que de verdad esperan; en una venta cerrada sería una alarma sobre algo que ya
terminó. La marca de en qué va la venta se mudó de la línea de la vista previa a la cola de
la fila, donde comparte casilla con la insignia de no leídos: **lo no leído gana a en qué
va, y en qué va gana a quién contestó**.

**Filtros con filete en vez de píldoras.** Sin fondo ni relleno lateral ocupan la mitad, y
por eso pasaron de dos a la vista a tres (cuatro en escritorio) sin que «Por atender» salga
como «Por a».

**El buscador se esconde detrás de una lupa.** Con cuarenta conversaciones se busca de vez
en cuando, y el campo fijo se llevaba una franja de la pantalla del celular todos los días.
Ctrl+K lo abre y lo enfoca; cerrarlo borra lo buscado, porque si no la lista se quedaría
filtrada sin nada que dijera por qué.

**Las respuestas rápidas salieron del desplegable** a una tira de fichas encima del campo.
Son seis frases que se escriben veinte veces al día y el botón —un globo de diálogo— no
decía ninguna: para saber qué había dentro había que abrirlo, así que era más rápido
teclear. Misma lección que «marcar resuelta».

**En el celular las acciones son una hoja que sube desde abajo** y no un desplegable
anclado a la esquina más lejos del pulgar. Es el mismo árbol que el desplegable de
escritorio, con los mismos `.chat-menu-secundarias` y `.chat-menu-ficha` que el CSS enciende
y apaga por ancho; lo que cambia es la forma. Van en tres grupos con título, porque eran
nueve botones seguidos y el noveno borraba la conversación para siempre.

> ⚠️ **Mientras la hoja está abierta se esconde la barra de navegación** (clase
> `chat-hoja-abierta` en el `body`). No es estética: en el celular `.chat-panel` es
> `position: fixed` con `z-index: 1`, o sea que crea un contexto de apilado, y **todo lo que
> hay dentro se pinta por debajo de la barra**, que cuelga del `body`. El `z-index` de la
> hoja no puede nada contra eso — la barra le tapaba los últimos cincuenta píxeles, que son
> los del botón «Cancelar». Si algún día se mete otra cosa flotante dentro del panel, es la
> misma trampa.

**La cabecera de la conversación volvió a una sola fila en el celular.** Fueron dos —el
nombre arriba, los mandos abajo— porque en una sola no cabían. Ahora caben: la insignia de
modo se fue (lo que decía lo dicen el subtítulo, «… · manual», y el punto oro del retrato) y
buscar y archivar bajaron a la hoja.

**Las burbujas: tres esquinas de 12px y una de 2px**, del lado de quien habla. Esa misma
mañana se habían revertido los 16px redondos a 2px porque «el hilo se veía como cualquier
mensajero y no como esta joyería»; sigue siendo verdad de los 16 redondos. La esquina en
punta es la que ancla la burbuja a la marca. Y Valentina pasó de cacao pleno a cacao suave
(`--ink-soft`): sobre la arena del hilo, el `#1C1714` era el contraste más duro de la
pantalla.

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
 : se sigue con las demás.
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
- `buscar_conversaciones` **sigue sin cuerpo en el repositorio**: sólo sus permisos. Es
  una de las cinco RPC que un entorno nuevo no levantaría.
- Las respuestas rápidas viven en `localStorage`, así que son por navegador, no por equipo.
- **La tarjeta de «siguiente por atender» repite casi siempre la primera fila de la lista.**
  Es a propósito —no es un atajo a la lista, es la respuesta—, pero en una bandeja tranquila
  se ve como una fila en negrita.
- `field-sizing: content` en el selector «Más» es de Chrome 123 en adelante. Donde no
  exista, el selector mide lo que su opción más larga y le queda un hueco entre la palabra y
  la flecha; el `max-width` evita que se coma las pestañas.

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
8. **La hoja de acciones, en un celular de verdad:** abre un chat, toca los tres puntos y
   comprueba que se ve el botón «Cancelar» **entero**. Es lo primero que tapa la barra de
   navegación si alguien toca el apilado.
9. **La tarjeta de arriba:** con una búsqueda escrita, en «Archivados» y con la selección
   múltiple abierta **no debe pintarse**. Y al abrir el chat que señala, debe desaparecer.
