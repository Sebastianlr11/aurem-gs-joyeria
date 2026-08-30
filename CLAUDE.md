# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

> **Última conciliación con el código: 24 de agosto de 2026.**
> Si algo de este documento no cuadra con lo que ves en el código, gana el código —
> y avísalo, porque significa que este archivo volvió a quedarse atrás.

---

## 1. Qué es esto

**Aurem Gs Joyería** — joyería de oro y plata en Bogotá, Colombia. Vende piezas de
catálogo y fabricación a medida.

Lo importante para entender cualquier decisión del código:

- **El motor comercial es WhatsApp, no la web.** La mayoría de los pedidos entran
  conversando. La web es vitrina, prueba de que la tienda es real, y checkout para
  quien prefiere pagar solo.
- **La atiende "Valentina"**, un bot con LLM que responde WhatsApp, entiende fotos y
  notas de voz, cotiza oro a medida, arma pedidos y escala a una persona cuando hace
  falta. Vive en `supabase/functions/_shared/bot.ts`.
- **La forma de pago principal es contraentrega con abono**: el cliente abona el envío
  para confirmar y paga el resto en la puerta. Esto contamina toda la lógica de dinero
  del panel — ver §8.
- **No hay clientes reales todavía.** Los ~17 pedidos de la base son pruebas del
  equipo, marcados con `es_prueba`. Cualquier cifra del panel se lee con eso en mente.

**Todo se escribe en español de Colombia**: código, comentarios, UI, nombres de rama y
mensajes de commit. Es una convención dura del proyecto, no una preferencia.

---

## 2. Comandos

```bash
npm run dev          # Vite en http://localhost:5173
npm run build        # eslint && vitest && sitemap.mjs && correos.mjs && tsc -b && vite build
npm run preview      # Sirve /dist
npm run lint         # ESLint (sí corre en el build)
npm test             # Vitest, una pasada (219 pruebas)
npm run test:mirar   # Vitest en marcha, repitiendo al guardar

npm run sitemap      # Regenera public/sitemap.xml desde Supabase
npm run correos      # esbuild: emails/_render.ts -> api/_plantillas.mjs
npm run email        # Previsualizador de React Email en :3010
npm run imagenes     # sharp: public/assets/*.jpg -> WebP multi-tamaño
npm run css:pisadas  # Diagnóstico: reglas CSS que otras pisan
```

Tres advertencias sobre el build:

1. **`api/_plantillas.mjs` es un artefacto generado** por `scripts/correos.mjs` y está
   en `.gitignore`. No lo edites a mano: se sobrescribe en cada build. Si `api/correo.js`
   falla con "cannot find module", corre `npm run correos`.
2. **El lint y las pruebas corren en el build, y lo tumban.** Es a propósito: es lo único
   que impide que entre código roto, porque no hay revisión de nadie más.
3. `scripts/sitemap.mjs` nunca tumba el build: si le faltan las variables de Supabase,
   emite sólo las rutas fijas y sigue.

### Las pruebas

Hay **219**, en dieciséis archivos que viven al lado de lo que prueban:

| Archivo | Qué fija |
|---|---|
| `src/lib/dinero.test.js` · `src/lib/caja.test.js` | Las cuentas de plata |
| `src/lib/circuito.test.js` | Lo que el panel le dice a quien va a pulsar un botón |
| `src/lib/talla.test.js` | Que la guía del sitio y Valentina den la misma talla |
| `src/lib/fotosEnStorage.test.js` | Qué archivos se borran al borrar una pieza |
| `src/pages/admin/chat/*.test.js(x)` | Los ganchos del chat, la ficha, la selección y el diálogo |
| `supabase/functions/_shared/reglas.test.ts` | Las reglas de Valentina |
| `supabase/functions/_shared/bucle.test.ts` | El bucle del agente, sin Deno y sin red |
| `src/lib/envio.test.js` | La caja en la que viaja una pieza: `null` nunca viaja como cero |
| `src/lib/nombre.test.js` | Partir un nombre para la guía, sin inventarse un apellido |
| `src/lib/recogida.test.js` | Quién viene por el paquete y cuándo |
| `src/lib/pixeles.test.js` | Que diferir los píxeles no pierda ni un evento |

**Una de ellas no comprueba código, compara dos copias.** La talla de anillo está
implementada dos veces —`src/lib/talla.js` para la guía del sitio y
`supabase/functions/_shared/reglas.ts` para Valentina— porque corren en runtimes distintos
y `supabase functions deploy` sólo empaqueta lo que hay en su carpeta. `src/lib/talla.test.js`
las barre milímetro a milímetro y tumba el build si dejan de coincidir. **Si tocas una,
toca la otra.** Se empezó por el dinero a
propósito, porque es el único sitio donde un error **no se ve**.

Los ganchos del chat se prueban por otra razón: **no hay forma de probarlos a mano**. Para
ver el visor hace falta una foto en un hilo y para ver un aviso hace falta que entre un
mensaje de WhatsApp de verdad; forzarlo insertando una fila haría que el cron le mandara
una plantilla real a un número real. Sacarlos de `ChatPanel.jsx` los volvió comprobables,
que es la mitad del motivo para sacarlos.

Ese archivo corre en jsdom, y se pide **por archivo** con `// @vitest-environment jsdom`
en la primera línea, no en la configuración global: montar jsdom para las funciones puras
son segundos de arranque en cada corrida a cambio de nada. Un fallo de CSS se nota al abrir la pantalla y uno de enrutado tumba la página,
pero una cuenta mal hecha enseña un número redondo, con signo de pesos y perfectamente
creíble — que es exactamente lo que pasó cuando el panel daba por cobrado un contraentrega
que iba en camino.

La tabla de `recibidoDe` en la prueba **es** la tabla de §8 de este documento. Si cambias
la regla de negocio, cambia ahí; si la rompes sin querer, el build no pasa.

Las pruebas viven al lado de lo que prueban, no en una carpeta aparte, y corren en Node
sin jsdom: lo que se prueba hoy son funciones puras. El día que se pruebe un componente,
se le pone jsdom a ese archivo.

---

## 3. Arquitectura — cuatro planos, no uno

Este es el punto donde más se equivoca quien llega nuevo:

> **El backend real NO está en `api/`.**
> `api/` son 2 endpoints (221 líneas). La lógica de negocio son **11 Edge Functions de
> Supabase en Deno + 8 módulos compartidos**.

| Plano | Dónde | Runtime | Qué hace |
|---|---|---|---|
| **Frontend** | `src/` | Vite + React 19 + react-router 7 | Tienda pública y panel de administración |
| **Serverless Vercel** | `api/` | Node | Sólo dos cosas: fichas para crawlers y envío de correo |
| **Edge Functions** | `supabase/functions/` | Deno | Valentina, WhatsApp, Mercado Pago, conversiones, vigía |
| **Correos** | `emails/` | React Email → Resend | 4 plantillas transaccionales |

Stack real (lo que hay en `package.json`, ni más ni menos):

- React 19 + Vite 7 + react-router-dom 7
- TypeScript en modo `strict` — pero **casi todo el código es `.jsx`**. El único `.tsx`
  de la app es `src/main.tsx`.
- Supabase (Auth, Postgres, Storage, Realtime, Edge Functions)
- Mercado Pago (`@mercadopago/sdk-react`)
- Resend + React Email
- **CSS plano, escrito a mano, en dos archivos** (`src/index.css` y `src/panel.css`).
  No hay Tailwind, ni CSS modules, ni preprocesador.
- **No hay Framer Motion.** Se eliminó (~41 KB) y se reemplazó por `src/lib/aparecer.js`.

---

## 4. Mapa de rutas

Definidas en `src/App.jsx:74-136`. Todas las páginas son `lazy()`.

| Ruta | Componente | Layout | Protegida |
|---|---|---|---|
| `/` | `Home` | Navbar + Footer | — |
| `/catalogo` | `Catalog` | Navbar + Footer | — |
| `/catalogo/:id` | `ProductPage` | **sólo Footer** | — |
| `/confirmacion` | `Confirmacion` | Navbar + Footer | — |
| `/politica-de-privacidad` | `PrivacyPolicy` | Navbar + Footer | — |
| `/terminos-de-servicio` | `TermsOfService` | Navbar + Footer | — |
| `/politica-de-devoluciones` | `ReturnsPolicy` | Navbar + Footer | — |
| `/guia-de-tallas` | `RingSizeGuide` | Navbar + Footer | — |
| `/admin/login` | `Login` | ninguno | — |
| `/admin/reset-password` | `ResetPassword` | ninguno | — |
| `/admin` | `Dashboard` | propio | `ProtectedRoute` |
| `/admin/chat` | `ChatPanel` | propio | `ProtectedRoute` |

Cosas que hay que saber antes de tocar el enrutado:

- **La ficha va sin Navbar a propósito** (`App.jsx:98-101`): es la pantalla donde se
  decide la compra y la píldora de navegación le quitaba sitio a la pieza. El camino de
  vuelta es el botón sobre la foto.
- **El panel son sólo dos rutas.** Productos, Pedidos, Clientes, Reportes, Anotaciones y
  Ajustes **no son rutas**: son secciones del mismo `Dashboard`, conmutadas por estado y
  sincronizadas con `?tab=`. Los identificadores del parámetro están **en inglés**
  (`products`, `orders`, `customers`, `reports`, `notes`, `settings`), no en español.
  Desde el 23-ago cada una vive en `src/pages/admin/secciones/`; en `Dashboard.jsx` (248
  líneas) sólo queda el contenedor. Lo que comparten varias está en `secciones/comunes.js`
  (datos) y `secciones/piezas.jsx` (componentes) — separados porque
  `react-refresh/only-export-components` no deja mezclarlos.
- **`capturarClic()` e `iniciarPixeles()` corren a nivel de módulo** (`App.jsx:24-25`),
  no dentro de un efecto. React ejecuta los efectos de los hijos antes que los del
  padre, y metidos en un efecto se perdía el primer `PageView` de cada carga.
- **Sí hay ruta `*`** (`App.jsx:135`), con `NoEncontrado` dentro del layout normal. Antes
  no la había y una URL inválida caía en el rewrite de `vercel.json` y renderizaba una
  página en blanco; se cerró el 23 de agosto de 2026.

---

## 5. Edge Functions

| Función | Autenticación | Servicios externos | Secretos |
|---|---|---|---|
| `wa-webhook` | HMAC SHA-256 de Meta | Meta Cloud API, OpenRouter | `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_TOKEN` |
| `wa-send` | JWT de admin | Meta Cloud API | `WA_TOKEN` |
| `create-preference` | ninguna (pública, CORS `*`) — **por eso el precio sale del catálogo, no del cuerpo** | Mercado Pago, Meta CAPI, TikTok | `MP_ACCESS_TOKEN`, `APP_URL` |
| `mp-webhook` | **ninguna** | Mercado Pago, Meta, TikTok, `/api/correo` | `MP_ACCESS_TOKEN`, `CORREO_SECRETO` |
| `conversion-pedido` | JWT de admin | Meta CAPI, TikTok | `META_CAPI_TOKEN`, `TIKTOK_ACCESS_TOKEN` |
| `correo-despacho` | JWT de admin | `/api/correo` → Resend | `CORREO_SECRETO`, `APP_URL` |
| `plantillas-programadas` | `x-cron-secreto` desde BD | Meta Cloud API | `PLANTILLAS_ACTIVAS`, `PLANTILLA_EN_CAMINO` |
| `cotizar-envio` | JWT de admin | 99envios | `ENVIOS99_EMAIL`, `ENVIOS99_PASSWORD`, `ENVIOS99_URL` |
| `crear-guia` | JWT de admin | 99envios | ídem, más `ENVIOS99_SEGURO` y `ENVIOS99_DICE_CONTENER` |
| `vigilancia` | `x-cron-secreto` desde BD | HTTP checks, `/api/correo` | `CORREO_SECRETO`, `APP_URL` |
| `create-admin` | JWT con `app_metadata.rol = 'dueño'` | Supabase Auth Admin | `SUPABASE_SERVICE_ROLE_KEY` |

Módulos compartidos en `supabase/functions/_shared/`:

- `bot.ts` (974 l.) — Valentina: prompt, herramientas, escalada
- `bucle.ts` (115 l.) — el bucle del agente, **con las dependencias inyectadas**: es lo que
  permite probarlo sin Deno, sin red y sin gastar un céntimo de modelo
- `wa.ts` (464 l.) — envío a WhatsApp, troceado natural, indicador de "escribiendo", plantillas
- `medios.ts` (221 l.) — transcripción de audio y descripción de imágenes
- `conversiones.ts` (393 l.) — Meta CAPI y TikTok Events API server-side
- `reglas.ts` — la lógica de Valentina **sin nada de Deno dentro**: la talla, la cotización
  del oro, la atribución, los teléfonos y el parseo de lo que el modelo pide al tomar un
  pedido. Existe para poder probarla: son las tres cosas del
  bot donde equivocarse le cuesta dinero a alguien, y `bot.ts` no se puede cargar desde
  Node porque importa de `jsr:` y llama a `Deno.env`

Los dos endpoints de Vercel:

- **`GET /api/ficha?id=<uuid>`** — HTML con OG tags de una pieza, **sólo para crawlers
  sociales**. El desvío está en `vercel.json`, filtrando por `user-agent`. Googlebot
  queda fuera a propósito, para no incurrir en cloaking.
- **`POST /api/correo`** — única salida de correo del sistema. Existe porque las
  plantillas son React y quien las dispara corre en Deno. Protegido con el header
  `x-correo-secreto` comparado en tiempo constante.

**Los disparos periódicos van por `pg_cron` dentro de Supabase.** `plantillas-programadas`
y `vigilancia` se invocan con el header `x-cron-secreto`, cuyo valor está en
`ajustes_internos.cron_secreto` (no en variables de entorno, para poder rotarlo sin
redesplegar). **La programación sí está versionada** desde el 23 de agosto:
`20260823_el_reloj_de_la_base.sql`. Son dos trabajos — `avisos-whatsapp`
(`0 0,1,13-23 * * *`, que en Bogotá son las 8 a las 20) y `vigilancia` (`30 * * * *`).
Los tres valores que necesitan —`url_funciones`, `clave_anon`, `cron_secreto`— viven en
`ajustes_internos`, no en la migración, y ésta se niega a aplicarse si falta alguno.

---

## 6. Modelo de datos

> **Las 16 tablas están versionadas desde el 23 de agosto de 2026.** Antes sólo había
> migraciones incrementales —añadir una columna, cerrar una política— sobre tablas que
> nunca se crearon aquí, y **un entorno nuevo ni siquiera arrancaba**:
> `20260311_add_shipping_address.sql` hacía un `ALTER` sobre una `orders` inexistente.
> `20260228_esquema_base.sql` las crea todas; va fechada antes que ninguna a propósito, y
> está volcada del catálogo de Postgres, no escrita a mano.
>
> **Y desde el 23 de agosto por la noche, también las ocho RPC.** Las cinco que faltaban
> entraron en `20260824_las_cinco_que_faltaban.sql`, y al leerlas —por primera vez, porque
> nunca habían pasado por un diff— aparecieron tres que mentían: dos repetían el fallo de
> `revenue_por_fuente` y una decía lo contrario de lo que existe para medir. Ver
> [pendientes #37](docs/pendientes.md).
>
> **Ojo con cómo se aplican.** Los archivos de `supabase/migrations/` son el registro
> escrito; a la base los cambios entran uno a uno, y `supabase_migrations.schema_migrations`
> guarda nombres propios que no coinciden con los de los archivos. `supabase db push`
> intentaría aplicarlos los 38 de golpe: no es el flujo de este proyecto.

### Tablas

Todas se crean en `20260228_esquema_base.sql` salvo donde se diga.

| Tabla | Para qué |
|---|---|
| `products` | Catálogo |
| `orders` | Pedidos |
| `order_items` | Piezas de un pedido multi-pieza |
| `customers` | Clientes |
| `whatsapp_conversaciones` | Todos los mensajes de WhatsApp |
| `chat_takeover` | Cuándo una persona toma el control de un chat |
| `chat_status` | Resuelta / archivada |
| `contact_tags` | Etiquetas de contacto |
| `notes` | Anotaciones internas |
| `gasto_pauta` | Gasto de publicidad por día y canal |
| `taller_precios` | Fila única: oro, recargo, abono, tope, IVA de pauta (`20260818_taller_precios.sql`) |
| `taller_conocimiento` | Base de conocimiento editable de Valentina (`20260818_taller_conocimiento.sql`) |
| `plantillas_enviadas` | Candado anti-duplicado de plantillas de WhatsApp (`20260819_plantillas_programadas.sql`) |
| `ajustes_internos` | Clave/valor: `cron_secreto`, `clave_anon`, `url_funciones`, `telefonos_avisos`, `contactos_equipo` |
| `vigilancia_ultima` | Fila id=1 con el último informe del vigía |
| `envio_publico` | **Es una vista.** Expone sólo `abono_envio` y `tope_contraentrega` |
| `pagos` | El libro de movimientos que lee `src/lib/caja.js`, llenado por el trigger `registrar_pago` (`20260822_libro_de_caja.sql`) |
| `ciudades_envio` | Los 1.273 municipios con su código DANE, para 99envios (`20260824_las_ciudades_de_colombia.sql`) |

**Ya no existen** `message_history`, `whatsapp_dedup`, `conversaciones` ni
`whatsapp_conversaciones_respaldo`: borradas el 23-ago
(`20260823_fuera_las_tablas_muertas.sql`). Las tres primeras eran restos de la era n8n; la
cuarta era una copia entera de los chats que hacía falsa la promesa de borrado del panel.

### Columnas que importan

**`orders`** — `id`, `customer_name`, `customer_email`, `customer_phone`, `product_id`,
`product_name`, `amount`, `status`, `payment_method`, `order_source`, `notes`, `carrier`,
`tracking_number`, `mp_preference_id`, `mp_payment_id`, `mp_status`, `status_updated_at`,
`created_at`, `es_prueba`, `shipping_address`, `shipping_city`, `shipping_department`,
`abono_monto`, `abono_pagado_en`, `conversion_enviada_en`, `costo_taller`, `costo_envio`,
`costo_anotado_en`, y la atribución
(`ttclid`, `ttp`, `fbc`, `fbp`, `client_ua`, `client_ip`, `ctwa_clid`, `anuncio_id`,
`utm_source`, `utm_campaign`).

`status` ∈ `pendiente | confirmado | pagado | procesando | enviado | entregado | devuelto |
cancelado`. **La columna es texto sin restricción**: acepta cualquier cosa, así que el
vocabulario lo sostienen el código y esta tabla, no la base.
`payment_method` ∈ `mercadopago | contraentrega | …`.

**`whatsapp_conversaciones`** — `id`, `phone_number`, `role`, `content`, `message_type`,
`media_url`, `wa_message_id` (**único**, es el candado anti-reentrega), `is_read`,
`enviado_por` (`ia` | `humano`), `delivery_status`, `error_wa`, `wa_phone_id`, `referral`,
`created_at`.

**`products`** — base + `images[]`, `stock`, `metal`, `piedra`, `talla_rango`,
`compare_price`. (`costo` y `costo_provisional` siguen en la tabla pero están **muertas**
desde el 23-ago: el costo vive en el pedido; `engaste` lo está desde el 30-ago: el taller
nunca lo llenó.)

`category` ∈ `Anillos | Collares | Aretes | Topos | Pulseras | Dijes | Juegos`, y **aquí sí
hay `CHECK`** —al revés que `orders.status`—: una categoría nueva pide migración.

### RPC

| Función | ¿El cuerpo está en el repo? |
|---|---|
| `chats_sin_responder` | sí (`20260822_chats_sin_responder.sql`) |
| `revenue_por_fuente` · `embudo_whatsapp` | sí (`20260824_los_informes_cuentan_lo_que_entro.sql`) |
| `analiticas_whatsapp` · `buscar_conversaciones` · `clientes_nuevos_vs_recurrentes` · `tendencia_comparativa` · `top_ciudades_envio` | sí (`20260824_las_cinco_que_faltaban.sql`) |

**Las ocho están.** Los permisos, además, en `20260823_las_rpc_estaban_abiertas.sql`: eran
`SECURITY DEFINER` y **cualquiera con la llave pública podía ejecutarlas**, que es la misma
clase de agujero que el de las tablas pero por la puerta de al lado.

**Ninguna filtra `es_prueba`, y es a propósito**: el lente de pruebas es un interruptor de
la interfaz y una RPC agregada no puede saber cómo está puesto. La consecuencia hay que
tenerla presente: en Reportes conviven números que obedecen al lente —los que salen de
`orders` en JavaScript— con números que no —los de las RPC—.

### Buckets de Storage

- `product-images` — público. Fotos de catálogo.
- `chat-media` — **privado**. Fotos que mandan las clientas; se firman al vuelo por 1 h.

### Migraciones, en orden

**El nombre del archivo va en UTC; la prosa, en hora de Bogotá.** Las dos
`20260824_*` se aplicaron la noche del 23 de agosto de 2026 —pasadas las 7 p. m., que en
UTC ya es el 24—, y el nombre coincide con lo que quedó registrado en
`supabase_migrations.schema_migrations`. **No los renombres para «cuadrar» la fecha**: el
nombre es el identificador que la base ya tiene anotado.


| Archivo | Qué hizo |
|---|---|
| `20260311_add_shipping_address.sql` | Dirección de envío en `orders` |
| `20260311_orders_rls.sql` | RLS de `orders` — declaraba una política abierta a `anon` que nunca llegó a la base; anulada el 22-ago |
| `20260818_atribucion_anuncios.sql` | `ttclid`, `ttp`, `fbc`, `fbp`, `conversion_enviada_en` |
| `20260818_atribucion_navegador.sql` | `client_ua`, `client_ip` (Meta descarta eventos sin UA) |
| `20260818_referral_anuncios.sql` | `referral jsonb` en conversaciones |
| `20260818_taller_conocimiento.sql` | Crea la base de conocimiento + 6 filas sembradas |
| `20260818_taller_precios.sql` | Crea la fila única de precios de taller |
| `20260818_wa_phone_id.sql` | Arregla que el bot respondiera por el número de prueba |
| `20260819_abono_envio.sql` | `abono_monto`, `abono_pagado_en`, `abono_envio` |
| `20260819_atribucion_origen.sql` | `ctwa_clid`, `anuncio_id`, `utm_*` |
| `20260819_plantillas_programadas.sql` | `plantillas_enviadas` + `customers.no_escribir` |
| `20260822_libro_de_caja.sql` | La tabla `pagos` y el disparador `registrar_pago`: cuándo entró cada peso |
| `20260822_chats_sin_responder.sql` | Función `chats_sin_responder()` |
| `20260822_cerrar_conversaciones_a_anon.sql` | 🔒 Cierra a `anon` las 5 tablas de conversaciones y enciende RLS en 3 respaldos |
| `20260822_borrar_chat_media.sql` | Política DELETE en `chat-media` |
| `20260822_conversaciones_purgables.sql` | Función `conversaciones_purgables()` — retención |
| `20260822_pedido_publico.sql` | 🔒 `pedido_publico(uuid)` y anulación de la política mina |
| `20260822_quitar_respaldos_de_chats.sql` | Elimina los respaldos del 22-ago |
| `20260823_las_rpc_estaban_abiertas.sql` | 🔒 Las RPC `SECURITY DEFINER` eran leíbles con la llave pública: cerrar tablas no cierra funciones |
| `20260823_un_cliente_por_persona.sql` | Índice único por los últimos diez dígitos: el mismo número entraba de tres formas y creaba tres clientes |
| `20260823_clientes_del_equipo.sql` | Los contactos del equipo también se marcan de prueba, no sólo sus pedidos |
| `20260823_costos_del_pedido.sql` | El costo pasa del catálogo al pedido: `costo_taller`, `costo_envio`, `costo_anotado_en` |
| `20260823_avisar_cancelaciones.sql` | El candado de `PedidoCancelado` hacia Meta y TikTok |
| `20260823_conocimiento_al_dia.sql` | Quita los «SIN CONFIRMAR» del seed de Valentina, que ya estaban confirmados |
| `20260823_conocimiento_devoluciones.sql` | Valentina no tenía nada que decir de devoluciones: escalaba en vez de responder |
| `20260823_plazos_de_verdad.sql` | Los plazos que promete Valentina, ajustados a cómo trabaja el taller |
| `20260823_superficie_de_seguridad.sql` | Volcado de RLS, políticas y funciones tal como están en producción, para poder diffearlo |
| `20260823_el_reloj_de_la_base.sql` | Declara los dos trabajos de `pg_cron`; antes el horario sólo vivía en la base |
| `20260823_tener_sesion_no_es_ser_del_equipo.sql` | 🔒 Las 20 políticas del panel exigen `es_del_equipo()`, no sólo tener sesión |
| `20260823_storage_tambien_pide_ser_del_equipo.sql` | 🔒 Lo mismo para las fotos: subir y borrar pide rol de equipo |
| `20260823_el_vigia_mira_el_candado.sql` | `politicas_flojas()`: el vigía avisa si una política deja de exigir `es_del_equipo()` |
| `20260823_a_quien_se_le_puede_escribir.sql` | 🔒 `puede_recibir_plantillas()`: el «no me escriban» se comprobaba con la cadena cruda y fallaba en 10 de 18 pedidos |
| `20260824_confirmado_y_devuelto.sql` | Dos estados nuevos en el circuito, y el guardián que compara la regla del dinero de la base con la tabla de §8 |
| `20260824_los_informes_cuentan_lo_que_entro.sql` | `revenue_por_fuente` sumaba todos los pedidos: decía 331 veces más de lo que había entrado |
| `20260824_las_cinco_que_faltaban.sql` | Las cinco RPC que sólo vivían en la base; tres de ellas mentían |
| `20260824_lo_que_llega_a_la_cuenta.sql` | `neto_recibido_de`: el abono se cobra por Mercado Pago y los informes lo sumaban en bruto |
| `20260824_el_embudo_se_ensanchaba.sql` | El embudo dibujaba 0 → 1 → 0: sus peldaños no eran subconjuntos |
| `20260824_cancelar_el_duplicado_no_el_pedido_de_ayer.sql` | El disparador de duplicados no veía el mismo teléfono en otro formato, y mataba pedidos legítimos de días atrás |
| `20260824_el_vigia_cuadra_la_caja.sql` | `caja_cuadra_con_la_regla()`: que el libro de pagos le haga caso a `recibido_de` |
| `20260824_las_ciudades_de_colombia.sql` | Los 1.273 municipios con su código DANE, que es lo que pide 99envios |
| `20260824_de_lo_que_escribe_la_clienta_al_codigo_dane.sql` | `codigo_dane()`: traduce la ciudad escrita a mano, y calla si es ambigua |
| `20260830_topos_y_juegos.sql` | Dos categorías nuevas en el `CHECK` de `products`: los topos y los combos de dije con aretes |

`20260822_cerrar_conversaciones_a_anon.sql` cerró el fallo más grave de todos:
`whatsapp_conversaciones` y `chat_takeover` tenían políticas
`[public ALL] using=true`, así que **con la llave pública se podía leer y borrar toda la
correspondencia con las clientas**. Ya está cerrado, y **`orders` también**: la política
`orders_anon_read_own` estaba escrita con `USING (true)` en la migración pero nunca llegó a
la base, y `20260822_pedido_publico.sql` la deshace con un `DROP POLICY` posterior para que
un entorno nuevo no la cree. Ver [Resueltos](docs/pendientes.md#resueltos).

---

## 7. Variables de entorno

Sólo nombres. **Nunca imprimas ni commitees valores.**

**En `.env.local` (desarrollo)**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MP_PUBLIC_KEY`, `CORREO_SECRETO`,
`RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`

**Sólo en Vercel (producción)**
`VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID` — **no están en `.env.local` a propósito**:
en local los píxeles quedan apagados y no ensucian la medición.

**Secretos de Supabase (Edge Functions)**
`SUPABASE_SERVICE_ROLE_KEY`, `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET`,
`WA_VERIFY_TOKEN`, `MP_ACCESS_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
`OPENROUTER_VISION_MODEL`, `OPENROUTER_AUDIO_MODEL`, `META_PIXEL_ID`, `META_CAPI_TOKEN`,
`TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`, `APP_URL`, `PLANTILLAS_ACTIVAS`, `CORREO_SECRETO`,
`ENVIOS99_EMAIL`, `ENVIOS99_PASSWORD`, `ENVIOS99_URL`, `ENVIOS99_SEGURO`,
`ENVIOS99_DICE_CONTENER`, `PLANTILLA_EN_CAMINO`

Todo lo que empieza por `VITE_` **acaba dentro del bundle público**. La anon key de
Supabase es visible para cualquiera: la seguridad real depende enteramente de RLS.

Y RLS, desde el 23 de agosto de 2026, **no se conforma con que tengas sesión**. Todas las
políticas del panel llaman a `public.es_del_equipo()`, que exige `app_metadata.rol` ∈
(`dueño`, `equipo`). Antes decían `to authenticated using (true)`, y eso significaba que
cualquiera que se registrara —el registro público estaba abierto— podía leer y borrar
pedidos, clientes y conversaciones. **El registro ya está cerrado, pero el candado no
depende de ese interruptor.** Si añades una tabla al panel, su política se escribe con
`es_del_equipo()`, nunca con `using (true)`.

**Para desplegar Edge Functions**: siempre con el CLI (`npx supabase functions deploy`)
y un token personal. Nunca transcribiendo el código a mano en el dashboard.

---

## 8. Reglas de negocio que el código no explica solo

### Contraentrega con abono

El cliente **abona el envío** (por defecto $20.000, en `taller_precios.abono_envio`) para
confirmar el pedido, y paga el resto **en efectivo cuando el domiciliario llega**.

- La opción sólo se ofrece si el precio de la pieza `<= taller_precios.tope_contraentrega`.
- El frontend lee esos dos números de la vista `envio_publico`, no de `taller_precios`
  (que tiene RLS restringido: el recargo es el margen del negocio).
- **Si `tope_contraentrega` es `null`, la opción no se pinta.** Es deliberado: mejor no
  ofrecerla que ofrecerla y retirarla.
- El candado real está en `create-preference`, no en el navegador.
- Contraentrega fuerza destino Bogotá y no pide departamento ni ciudad.

### Cómo se cuenta la plata — `src/lib/dinero.js`

La regla que más se ha equivocado históricamente:

> **Un pedido contraentrega en estado `enviado` NO cuenta como cobrado.**
> Sólo cuenta el abono. El paquete va en camino y nadie ha pagado el resto.

| Estado | Se lee | Pago en línea | Contraentrega |
|---|---|---|---|
| `pendiente` | Pendiente | 0 | 0 |
| `confirmado` | Confirmado | 0 | **el abono** |
| `pagado` | Pagado | total | total |
| `procesando` | **Fabricando** | total | **sólo el abono** |
| `enviado` | Enviado | total | **sólo el abono** |
| `entregado` | Entregado | total | total |
| `devuelto` | Devuelto | 0 | **el abono se queda** |
| `cancelado` | Cancelado | 0 | 0 |

**`procesando` se lee «Fabricando» en pantalla.** El valor de la base no se renombró a
propósito: tocaría la base, cuatro edge functions, las RPC y los disparadores, con riesgo
real y ninguna ganancia. Cambia la palabra, no el dato.

**Y «sigue viva» también vive en dos sitios**: `estaVivo` en el panel y `venta_viva(status)`
en la base. El vigía compara las dos contra esta tabla cada hora.

**Estas reglas están escritas DOS veces**, y tiene que ser así: las de `src/lib/dinero.js`
calculan sobre filas que el panel ya tiene en el navegador, y sus espejos
—`public.recibido_de(...)`, `public.neto_recibido_de(...)`, `public.venta_viva(...)`— corren
dentro de Postgres para el disparador que llena `pagos` y para las RPC de informes.
Ninguna puede llamar a la otra. **Si tocas una, toca la otra** — y el vigía comprueba cada
hora que la de la base siga diciendo lo que dice esta tabla (`regla_del_dinero_cuadra()`).

**Y lo que hace cada botón se escribe en `src/lib/circuito.js`**, no en las pantallas.
`queFalta(pedido)` da la línea de «qué falta» de cada fila; `loQuePasa(pedido, destino)` da
lo que va a pasar al confirmar. Las usan la tabla de Pedidos, el diálogo de confirmar y la
guía de Ajustes, para que las tres no puedan decir cosas distintas. El circuito completo
está en [`docs/specs/admin-pedidos.md`](docs/specs/admin-pedidos.md), que manda.

**Y `recibidoDe` NO es lo que llegó a la cuenta.** Responde cuánto entregó la clienta; lo
que quedó después de la pasarela es `netoRecibidoDe`, con su `costoDePasarelaDe`. La
diferencia importa porque **el abono del contraentrega se cobra por Mercado Pago**, que se
lleva $2.118 de cada $20.000. Con la sutileza que hace falta hacer bien: de un contraentrega
**entregado** sólo el abono pasó por la pasarela —el resto lo cobró el mensajero en
efectivo—, así que se descuenta la comisión de los $20.000 y no la de los $550.000.

La regla de rotulación, para que no se vuelva a mezclar: lo que diga **«entró», «neto» o
«deja» va después de comisiones**; lo que diga **«vendido» o «pedido» se queda en precio**.

`porCobrarDe` = `amount − recibidoDe` en pedidos vivos. `estaVivo` = ni `cancelado` ni
`pendiente`. **Cualquier cifra de dinero del panel debe pasar por estas funciones**: el
bug original era que la ficha del chat y el dashboard contaban distinto y el mismo
cliente daba dos números.

### Otras reglas

- **Los precios se congelan en `order_items`.** Un pedido viejo no cambia de importe
  porque hoy suba el oro.
- **`es_prueba` es un lente global del panel.** Los pedidos de prueba se ocultan por
  defecto en todas partes; el toggle se guarda en `localStorage('aurem:ver-pruebas')`.
  Los ~17 pedidos que hay son todos del equipo.
- **El descuento por pagar en línea es 2%** (`MP_DISCOUNT` en `ProductPage.jsx`).
- **La talla del anillo no viaja al checkout.** Sólo al mensaje de WhatsApp.
- **La talla se calcula igual en la guía y en el chat, y eso está atado con una prueba.**
  Entre dos tallas se toma la mayor —un anillo holgado se ajusta, uno apretado no entra—
  con 0,35 mm de tolerancia para bajar y 0,6 mm de holgura antes de mandar a fabricar a
  medida. Hasta el 23 de agosto de 2026 el bot no tenía ninguna de las dos y discrepaba con
  la guía en el **29 %** de las medidas.
- **La referencia visible de una pieza es `AG-` + los últimos 4 dígitos del uuid.** Misma
  fórmula en `meta.js`, `ProductPage.jsx` y `EliminarPieza.jsx`.
- **Comisiones de Mercado Pago que aplica el panel**: `(monto × 3,29% + $800) × 1,19`
  de IVA, más 1,5% de retefuente y 0,414% de ICA.
- **Cada millón de pauta cuesta 1.190.000** con IVA. El factor vive en
  `taller_precios.iva_pauta` (0,19 por defecto).

---

## 9. Convenciones

### Idioma

Español de Colombia en **todo**: nombres de función y variable, comentarios, textos de
interfaz, nombres de rama y mensajes de commit. El código existente lo cumple
consistentemente (`recibidoDe`, `estaVivo`, `versionesDeFoto`, `capturarClic`).

### Git

- Ramas: `feat/`, `fix/`, `perf/`, `chore/`, `revert/`, `docs/` + **frase descriptiva en
  español** — `feat/como-le-va-a-valentina`, `fix/dashboard-decia-lo-que-no-sabia`,
  `fix/whatsapp-no-acepta-webp`.
- Merge explícito a `main`, sin fast-forward.
- **El mensaje de commit describe el efecto para el negocio, no el cambio técnico**:
  "el panel contaba como ingresos plata que todavía no ha entrado", no "refactor de
  dinero.js".
- No commitear ni hacer push salvo que se pida.

### Comentarios

El código de este proyecto está inusualmente bien comentado, y es deliberado: **casi cada
decisión no obvia lleva escrito el incidente que la motivó**, con fecha. Mantener esa
costumbre. Si cambias algo que un comentario explica, actualiza el comentario o borra la
razón que ya no aplica — no lo dejes mintiendo.

---

## 10. Diseño

**`DESIGN.md` en la raíz es la fuente de verdad del sistema de diseño y manda sobre
cualquier color que aparezca en este archivo.** `.claude/skills/designing-aurem-gs/` es
su versión operativa: úsala para construir.

Dirección: **"Luz de vitrina"** — base marfil, tinta cacao, un solo oro, Marcellus +
Mulish, escala de 8px, radio de 2px.

| Token | Valor | Uso |
|---|---|---|
| `--bg-marfil` | `#FBF7F2` | Fondo principal |
| `--bg-arena` | `#F2EAE0` | Fondo secundario |
| `--ink` / `--text-primary` | `#1C1714` | Tinta cálida — **nunca negro puro** |
| `--text-secondary` | `#6B615A` | Texto de apoyo |
| `--text-muted` | `#766D66` | Aclarado desde `#9C938B` por contraste AA (4,74:1) |
| `--oro` / `--accent-gold` | `#A8863F` | **El único oro** |
| `--oro-ink` | `#7A5F26` | Oro oscuro sobre claro |
| `--hairline` | `#E6DED3` | Líneas |
| `--font-display` | Marcellus | Titulares — **sólo peso 400** |
| `--font-ui` | Mulish | Interfaz y cuerpo |

Reglas que se rompen con facilidad:

- **Marcellus sólo tiene peso 400.** Cualquier `font-weight` mayor produce negrita
  sintética. Hubo un caso en el titular de la portada; se corrigió el 23 de agosto de 2026.
- **`--accent-red: #ea4335` sigue definido pero es legado** de catálogo/admin.
  `DESIGN.md` lo prohíbe como acento de marca. Para estados de error usa los tonos de la
  marca: `#8C2F1E`, `#5E2114`, `#FBEDE9`.
- **Las fuentes se autoalojan** (`src/fuentes.css` + `public/assets/fuentes/*.woff2`).
  **No importes nada de `fonts.googleapis.com`** — se midió: pasar de Google Fonts a
  self-hosting fue lo que arregló un LCP de 5,7 s, porque el elemento LCP es el logo del
  navbar, que es texto en Marcellus.
- **`DESIGN.md` cubre la landing; el panel tiene el suyo: `DESIGN-PANEL.md`.** Hereda
  la identidad entera y cambia lo que la densidad obliga —el cuerpo baja de 1rem a
  propósito, la escala es de 4px y no de 8, y el estado de un pedido se distingue por un
  punto y no por un color de fondo—. Para cualquier pantalla de `/admin`, manda aquél.
  Trae además la deuda medida, y lo que queda de ella: de 491 colores escritos a pelo a
  **45**, y de dos oros que no son el de la marca a **ninguno**.

---

## 11. Trampas conocidas

Cosas que ya costaron un incidente. Léelas antes de tocar lo que describen.

- **WhatsApp no acepta WebP.** Falla con un 200 engañoso: la API responde bien y el
  mensaje nunca llega. Por eso cada foto de producto se guarda **dos veces**: la `.webp`
  para la web y una gemela `.jpeg` para WhatsApp (`src/lib/optimizarFoto.js`). **Borrar
  las `.jpeg` deja a Valentina sin poder mandar fotos.**
- **El nombre de una foto de producto es información, no decoración.** La marca
  `-<ancho>x<alto>.webp` al final es lo único que le dice al sitio que existen las copias
  `-w400.webp` y `-w800.webp` del `srcset` (`src/lib/fotoProducto.js`), y la gemela de
  WhatsApp se deriva cambiándole la extensión. **Renombrar o mover un archivo del bucket
  rompe las dos cosas.** El transformador de imágenes de Supabase, que habría evitado todo
  esto, es de plan Pro y en este proyecto responde 403.
- **Gmail borra los `<style>` externos.** Por eso `emails/_marca.tsx` duplica los tokens
  en línea y usa Georgia en vez de Marcellus.
- **El CSS son DOS archivos desde el 23-ago:** `src/index.css` (tienda y compartido,
  6.854 líneas) y `src/panel.css` (el panel, 7.862). **`panel.css` se carga después, así
  que ante igual especificidad gana.** Lo importan **cuatro** pantallas: `Dashboard.jsx`,
  `ChatPanel.jsx`, `Login.jsx` y `ResetPassword.jsx`.
  Si mueves una regla de un archivo al otro, compruébalo: se hizo midiendo 24 propiedades
  calculadas de 3.691 elementos en once pantallas.
- **Una pantalla del panel a la que se llega por la URL tiene que importar `panel.css`
  ella misma.** Del 23 al 24 de agosto de 2026, `/admin/login` y `/admin/reset-password` se
  pintaron **crudas** —enlaces azules, el isotipo a tamaño natural, cursivas donde van
  versalitas— para quien abriera la dirección de entrada. Sus 69 reglas viven en
  `panel.css`, que entonces sólo importaban `Dashboard.jsx` y `ChatPanel.jsx`. **No se vio
  en un mes porque desde dentro del panel se ve bien**: al cerrar sesión la hoja ya está
  cargada, y es el único camino que recorre quien programa. El primero que la abrió en frío,
  en un celular, fue el joyero.

- **Qué es "del panel" no se decide por el nombre de la clase.** Se intentó por prefijos y
  `.joyero` —que es la ficha de producto— acabó en el panel y rompió la ficha. El criterio
  es dónde se usa: sólo en `src/pages/admin/` y en ningún otro sitio.
- **Antes de dar por bueno un cambio de CSS, corre `npm run css:pisadas`.** Mira los dos
  archivos y hoy reporta **4** bloques con declaraciones pisadas, desde los 143 que había.
  Lee la primera línea de su salida, no cuentes los bloques impresos: sólo enseña los 25
  peores. Acepta una ruta (`node scripts/css-pisadas.mjs src/panel.css`) y un filtro de
  selector.
- **390px no basta para probar móvil.** El iframe es la única forma de medir de verdad
  el comportamiento en pantallas reales en esta sesión.
- **Hay dos píxeles de Meta con el mismo nombre y sólo uno recibe eventos.** Verifica el
  ID antes de concluir que la medición está rota.
- **Meta descarta eventos server-side sin `user-agent`.** Por eso `client_ua` se guarda
  en `orders` y viaja en la atribución.
- **La ventana de WhatsApp se cierra a las 24 h.** Pasado ese plazo sólo se puede
  escribir con plantillas aprobadas por Meta.
- **El modo prueba puede quemar plantillas.** Un pedido `es_prueba` que dispara una
  plantilla real consume el candado de `plantillas_enviadas`.
- **`vercel.json` es JSON estricto y con esquema cerrado.** No admite comentarios ni claves
  inventadas: una clave `_comentario` hizo que Vercel **rechazara el despliegue entero antes
  de compilar**, sin logs de build porque nunca hubo build. Lo que haya que explicar va en
  la spec, no en el archivo.
- **En 99envios, un flete en $0 no es un envío gratis.** Significa que el código de convenio
  de esa transportadora todavía no está generado —tarda uno o dos días hábiles— y que con
  ella no se pueden emitir guías. `cotizar-envio` lo trata como «no cotizó» por eso: si se
  colara como opción se ordenaría la primera por barata y la emisión fallaría después.
- **El elemento LCP de la portada es el texto del logo, no la foto.** Está escrito aquí
  desde el principio y aun así se optimizó dos veces contra la imagen. Antes de tocar
  rendimiento, mirar qué dice `largest-contentful-paint-element` en el informe.

---

## 12. Índice de specs

El detalle de cada feature vive en `docs/specs/`. Formato: qué resuelve, cómo funciona
hoy, decisiones tomadas y por qué, límites conocidos, cómo probarlo.

**Tienda pública**
- [`landing.md`](docs/specs/landing.md) — portada y sus secciones
- [`catalogo.md`](docs/specs/catalogo.md) — `/catalogo`
- [`ficha-producto.md`](docs/specs/ficha-producto.md) — `/catalogo/:id`
- [`checkout-y-pagos.md`](docs/specs/checkout-y-pagos.md) — Mercado Pago y contraentrega
- [`paginas-de-contenido.md`](docs/specs/paginas-de-contenido.md) — legales y guía de tallas

**WhatsApp y Valentina**
- [`chatbot-valentina.md`](docs/specs/chatbot-valentina.md) — el bot
- [`whatsapp-envio-y-plantillas.md`](docs/specs/whatsapp-envio-y-plantillas.md) — la mensajería

**Panel de administración**
- [`admin-acceso.md`](docs/specs/admin-acceso.md) — autenticación y administradores
- [`admin-dashboard.md`](docs/specs/admin-dashboard.md) — la portada del panel y sus fórmulas
- [`admin-catalogo.md`](docs/specs/admin-catalogo.md) — gestión de piezas
- [`admin-pedidos.md`](docs/specs/admin-pedidos.md) — gestión de pedidos y despacho
- [`admin-chat.md`](docs/specs/admin-chat.md) — el panel de conversaciones
- [`admin-reportes-y-pauta.md`](docs/specs/admin-reportes-y-pauta.md) — analítica y retorno de pauta
- [`admin-ajustes.md`](docs/specs/admin-ajustes.md) — precios de taller y conocimiento

**Transversales**
- [`modelo-de-datos.md`](docs/specs/modelo-de-datos.md) — tablas, RPC, RLS, migraciones
- [`correos.md`](docs/specs/correos.md) — Resend y React Email
- [`atribucion-y-pixeles.md`](docs/specs/atribucion-y-pixeles.md) — medición Meta y TikTok
- [`seo-y-compartir.md`](docs/specs/seo-y-compartir.md) — meta tags, JSON-LD, prerender
- [`vigilancia.md`](docs/specs/vigilancia.md) — el vigía
- [`envios-99envios.md`](docs/specs/envios-99envios.md) — cotizar el envío con las cinco transportadoras
- [`diseno-y-frontend.md`](docs/specs/diseno-y-frontend.md) — CSS, fuentes, animaciones

**Y aparte:** [`docs/pendientes.md`](docs/pendientes.md) — los 41 hallazgos de la revisión,
**todos cerrados** a 24 de agosto de 2026. Se conserva porque cada uno lleva escrito qué
pasaba y por qué se decidió lo que se decidió; los specs enlazan a sus números.
