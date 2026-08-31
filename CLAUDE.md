# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

> **Última conciliación con el código: 30 de agosto de 2026.**
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
npm test             # Vitest, una pasada (310 pruebas)
npm run test:mirar   # Vitest en marcha, repitiendo al guardar

npm run sitemap      # Regenera public/sitemap.xml desde Supabase
npm run correos      # esbuild: emails/_render.ts -> api/_plantillas.mjs
npm run email        # Previsualizador de React Email en :3010
npm run imagenes     # sharp: public/assets/*.jpg -> WebP multi-tamaño
npm run css:pisadas  # Diagnóstico: reglas CSS que otras pisan
npm run prerenderizar # Pinta la portada en Node y la mete en dist/index.html (lo corre el build)

node scripts/huella-estilos.mjs tomar h.json   # Huella de estilos: qué se ve, medido
node scripts/css-de-quien-es.mjs               # De qué ruta es cada bloque de index.css
node scripts/refrescar-cache-fotos.mjs         # Una vez: resube las fotos del bucket con caché de un año
node scripts/css-mudanza.mjs                   # Qué reglas de index.css son de una sola pantalla (--de-verdad las mueve)
node scripts/huella-estilos.mjs tomar h.json --estados   # …midiendo también el visor, el modal y los filtros
```

Cuatro advertencias sobre el build:

1. **`api/_plantillas.mjs` es un artefacto generado** por `scripts/correos.mjs` y está
   en `.gitignore`. No lo edites a mano: se sobrescribe en cada build. Si `api/correo.js`
   falla con "cannot find module", corre `npm run correos`.
2. **El lint y las pruebas corren en el build, y lo tumban.** Es a propósito: es lo único
   que impide que entre código roto, porque no hay revisión de nadie más.
3. `scripts/sitemap.mjs` nunca tumba el build: si le faltan las variables de Supabase,
   emite sólo las rutas fijas y sigue.
4. **El build termina prerenderizando la portada** y deja **dos** HTML en `dist/`:
   `index.html` con la portada ya pintada dentro de `#root` **y la hoja de estilos en un
   `<style>`**, y `app.html` vacío y con el `<link>` de siempre para todo lo demás.
   `scripts/prerenderizar.mjs` se planta —y tumba el build— si no encuentra el `#root`, si
   la portada sale sin el hero, si no ve el `<link>` de la hoja o si la hoja trae una
   `url()` relativa: desplegar cualquiera de esas cosas mal no se vería.

### Las pruebas

Hay **310**, en veintitrés archivos que viven al lado de lo que prueban:

| Archivo | Qué fija |
|---|---|
| `src/lib/dinero.test.js` · `src/lib/caja.test.js` | Las cuentas de plata |
| `src/lib/circuito.test.js` | Lo que el panel le dice a quien va a pulsar un botón |
| `src/lib/talla.test.js` | Que la guía del sitio y Valentina den la misma talla |
| `src/lib/fotosEnStorage.test.js` | Qué archivos se borran al borrar una pieza |
| `src/pages/admin/chat/*.test.js(x)` | Los ganchos del chat, la ficha, la selección y el diálogo |
| `supabase/functions/_shared/reglas.test.ts` | Las reglas de Valentina |
| `supabase/functions/_shared/bucle.test.ts` | El bucle del agente, sin Deno y sin red |
| `supabase/functions/_shared/redaccion.test.ts` | Lo que se le pide al modelo al redactar una pieza, y lo que se le revisa |
| `src/lib/envio.test.js` | La caja en la que viaja una pieza: `null` nunca viaja como cero |
| `src/lib/nombre.test.js` | Partir un nombre para la guía, sin inventarse un apellido |
| `src/lib/recogida.test.js` | Quién viene por el paquete y cuándo |
| `src/lib/pixeles.test.js` | Que diferir los píxeles no pierda ni un evento, y cuándo arrancan |
| `src/lib/portada.test.js` | Qué saca la portada del catálogo, y que no ofrezca una vitrina vacía |
| `src/lib/tituloPieza.test.js` | Que el `<title>` de una pieza quepa en lo que Google enseña |
| `src/lib/meta.test.js` | Las migas de la ficha y que el `FAQPage` diga lo que se ve |
| `src/lib/nombreUnico.test.js` | Que dos nombres no se confundan y dejen a Valentina sin fotos |
| `src/lib/fotoProducto.test.js` | Que la foto que se precarga sea la misma que se pinta |

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
> `api/` son 2 endpoints (221 líneas). La lógica de negocio son **12 Edge Functions de
> Supabase en Deno + 9 módulos compartidos**.

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
- **El panel son sólo dos rutas.** Portada, Productos, Pedidos, Clientes, Reportes,
  Anotaciones y Ajustes **no son rutas**: son secciones del mismo `Dashboard`, conmutadas
  por estado y sincronizadas con `?tab=`. Los identificadores del parámetro están **en
  inglés** (`dashboard` —el de por defecto—, `products`, `orders`, `customers`, `reports`,
  `notes`, `settings`), no en español.
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
| `redactar-pieza` | JWT de admin | OpenRouter (visión) | `OPENROUTER_API_KEY`, `OPENROUTER_VISION_MODEL` |
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
- `redaccion.ts` — qué se le pide al modelo para redactar una pieza y qué se le revisa a
  lo que contesta, **sin nada de Deno dentro**, para poder probarlo sin desplegar y sin
  gastar modelo
- `envios.ts` (59 l.) — las transportadoras y dónde se rastrea cada una. Aparte porque lo
  usan el correo de despacho y la plantilla de WhatsApp, que no se conocen entre sí:
  duplicarlo sería garantizar que algún día lleven a sitios distintos
- `pedidos.ts` (79 l.) — qué piezas lleva un pedido, listas para enseñar. Aparte por lo
  mismo: lo usan el correo de confirmación y el de despacho
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

> **Las 17 tablas están versionadas desde el 23 de agosto de 2026.** Antes sólo había
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
> intentaría aplicarlos los 44 de golpe: no es el flujo de este proyecto.

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
| `ajustes_internos` | Clave/valor: `cron_secreto`, `clave_anon`, `url_funciones`, `telefonos_avisos`, `contactos_equipo`, `anuncios_piezas` |
| `vigilancia_ultima` | Fila id=1 con el último informe del vigía |
| `envio_publico` | **Es una vista.** Expone sólo `abono_envio` y `tope_contraentrega` |
| `pagos` | El libro de movimientos que lee `src/lib/caja.js`, llenado por el trigger `registrar_pago` (`20260822_libro_de_caja.sql`) |
| `ciudades_envio` | Los 1.273 municipios con su código DANE, para 99envios (`20260824_las_ciudades_de_colombia.sql`) |
| `bot_respondiendo` | El candado de turno: quién le está respondiendo a quién ahora mismo (`20260831_una_valentina_a_la_vez.sql`) |

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
| `20260831_de_que_joya_viene_el_lead.sql` | `ajustes_internos.anuncios_piezas`: de qué pieza es cada anuncio, para que Valentina abra nombrándola |
| `20260831_una_valentina_a_la_vez.sql` | `tomar_turno`/`soltar_turno`: dos corridas del bot le contestaban a la vez a la misma persona |

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

- **El nombre de una pieza es corto y el `<title>` se compone.** Desde el 30 de agosto de
  2026 los nombres van de 15 a 33 caracteres —«Anillo solitario clásico», no «Anillo
  solitario clásico en plata 925 con esmeralda natural»— porque el metal y la piedra ya
  viven en sus columnas y se pintan debajo. Las palabras que se buscan las añade
  `src/lib/tituloPieza.js`, que arma el título por debajo de los 60 caracteres que Google
  enseña y **sin precio**: el precio sigue en el título que sirve `api/ficha.js` a
  WhatsApp, donde es la mitad del motivo de compartir el enlace.
- **Y ningún nombre puede ser subcadena de otro.** Valentina busca la pieza por nombre y
  `buscarPieza()` devuelve `null` a propósito si coinciden dos, así que dos nombres que se
  confundan la dejan sin poder mandar la foto de ninguno. El panel lo comprueba al guardar.
- **La descripción cabe en 180 caracteres.** No es estética: `bot.ts` la corta ahí para
  armar el catálogo que lee Valentina, y una descripción más larga le llega partida. En dos
  frases: qué es la pieza —con metal y piedra, que es lo que le preguntan— y su rasgo.
- **`is_featured` es lo que la portada enseña.** Una pieza destacada va en el carrusel de
  «Piezas seleccionadas» y es la cara de su categoría en «Lo que hacemos». Si no hay
  ninguna destacada manda la más reciente, y una pieza agotada nunca va de cara. Hasta el
  30 de agosto de 2026 el interruptor decía «aparece en la portada» y no hacía nada: la
  portada no leía el catálogo.
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
  self-hosting fue lo que arregló un LCP de 5,7 s: entonces el elemento LCP era el logo del
  navbar, que es texto en Marcellus, y venía de otro dominio al final de una cadena de
  cuatro pasos. Hoy el LCP es la foto del hero —ver §11—, pero el motivo para autoalojarlas
  sigue en pie.
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
- **El CSS ya no son dos archivos: son ocho.** `src/index.css` (2.900 líneas — el sistema
  de diseño, la portada y todo lo compartido), `src/panel.css` (el panel), y **seis hojas de
  ruta** que se cargan sólo con su pantalla: `src/pages/ProductPage.css`, `Catalog.css`,
  `RingSizeGuide.css`, `Confirmacion.css`, `NoEncontrado.css` y `legales.css` —esta última
  la comparten las tres legales—, más `src/components/TiltedCarousel.css`.
  **Todas se cargan DESPUÉS de `index.css`, así que a igual especificidad ganan ellas.**
  `panel.css` lo importan **cuatro** pantallas: `Dashboard.jsx`, `ChatPanel.jsx`,
  `Login.jsx` y `ResetPassword.jsx`.

  El corte se hizo el 30 de agosto de 2026 porque `index.css` bloqueaba el primer pintado
  **entera y en todas las rutas**: la portada se bajaba el CSS de la ficha, del catálogo y
  de la guía de tallas para no usarlos. El CSS bloqueante bajó de 19,3 a 12,9 KB
  comprimidos, y ese mismo día, con la segunda tanda —237 bloques que sólo usan la ficha, el
  catálogo y confirmación, y que la primera no vio porque son estados que no existen hasta
  que alguien hace clic—, **a 8,87 KB**. La movió `scripts/css-mudanza.mjs`.

- **Mover una regla de una hoja a otra cambia quién gana la cascada, y eso no lo ve ninguna
  prueba.** Hay dos herramientas para eso, y las dos hacen falta:
  - `node scripts/huella-estilos.mjs tomar antes.json` → se toca el CSS → `tomar
    despues.json` → `comparar`. Abre las nueve pantallas públicas a cuatro anchos en Chrome
    sin cabeza y compara 54 propiedades calculadas de 8.930 elementos. Es lo único que
    responde «¿cambió lo que se ve?».
  - `node scripts/css-de-quien-es.mjs` dice de qué ruta es cada bloque **preguntándoselo al
    navegador**, no adivinando por el nombre de la clase. Sólo mira pantallas públicas: lo
    que use `/admin` hay que comprobarlo aparte —así se coló `.punzon--dark` en la hoja de
    la guía de tallas, y lo usan Portada y Reportes del panel—.
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
- **Antes de dar por bueno un cambio de CSS, corre `npm run css:pisadas`.** Mira las ocho
  hojas —las busca en disco— y hoy reporta **3** bloques con declaraciones pisadas, desde
  los 143 que había. **Sólo compara dentro de un mismo archivo**: desde que hay hojas de
  ruta, un par cuyo perdedor está en `index.css` y cuyo ganador está en una hoja de ruta le
  es invisible. Para eso está la huella.
  Lee la primera línea de su salida, no cuentes los bloques impresos: sólo enseña los 25
  peores. Acepta una ruta (`node scripts/css-pisadas.mjs src/panel.css`) y un filtro de
  selector.
- **`/assets/` se sirve con caché de un año e `immutable`, y la regla de siete días lleva
  `(?!assets/)` delante a propósito.** En Vercel **gana la última regla que coincide**, y sin
  ese lookahead la de siete días pisaba a la del año: hasta el 30 de agosto de 2026 las
  fuentes y la foto del hero caducaban en una semana aunque `vercel.json` pidiera un año.
  Consecuencia de tenerlo bien: los archivos de `public/assets/` **no llevan hash en el
  nombre**, así que al cambiar una foto hay que cambiarle también el nombre — si no, quien ya
  la tenga verá la vieja hasta un año.
- **El `Cache-Control` de una foto del catálogo se decide al subirla.** Supabase lo guarda en
  los metadatos del archivo y por defecto pone una hora; `ProductModal.jsx` sube con un año.
  Cambiarlo en las que ya están no se puede sin volver a subirlas —no hay «actualizar
  cabeceras» en la API—: para eso está `scripts/refrescar-cache-fotos.mjs`, que reescribe
  **la misma ruta** y nunca renombra.
- **Una regla que se muda a una hoja de ruta aterriza al final de ella, y eso cambia quién
  gana.** Las hojas de ruta se cargan después de `index.css`, así que a igual especificidad
  gana la movida. Si el selector **ya existe** en el destino —aunque sea dentro de un
  `@media`—, la nueva copia queda debajo y le gana a la que mandaba. Pasó al probar la
  mudanza: `.catalogo-panel` cayó después del `@media` que lo ajustaba en `Catalog.css` y el
  panel de filtros se ensanchó de 510 a 1.326 px. `css-mudanza.mjs` veta ese caso solo, pero
  si mueves una regla a mano, el selector del destino hay que mirarlo **incluyendo los
  `@media`**.
- **La huella sólo ve la página recién cargada, salvo que le pidas `--estados`.** El visor de
  fotos, el modal de compra y el panel de filtros no existen en el DOM hasta que alguien hace
  clic, así que su CSS quedaba sin vigilar — y es el de la pantalla donde se paga. Con
  `--estados` los abre y los mide; sin él, una regresión ahí pasa con un «ni una diferencia»
  perfectamente creíble. Las dos tomas tienen que llevar la misma opción o `comparar` se
  planta.
- **Una lectura pública a Supabase con cabeceras `apikey`/`Authorization` paga un viaje de
  red de más.** Ninguna de las dos está en la lista de cabeceras inofensivas de CORS, así que
  el navegador manda antes un `OPTIONS` y espera su respuesta para recién entonces pedir los
  datos: medido en producción el 30 de agosto de 2026, **261 ms de preflight** delante de una
  consulta de 194. Los GET públicos llevan la llave en la URL (`&apikey=…`) y ninguna
  cabecera propia, que es lo que los convierte en peticiones «simples». **No les añadas
  cabeceras**, ni siquiera un `Accept`, o vuelve el preflight. Los POST —`create-preference`,
  las RPC— sí las llevan: siempre preflightean y no están en la ruta crítica.
- **Los dos `preconnect` a Supabase de `index.html` sirven, aunque Lighthouse diga que no.**
  Medido con el protocolo de Chrome sobre producción: la consulta del catálogo sale con dns,
  conexión y TLS marcados como reusados —cero coste—, mientras que en esa misma carga el
  favicon, que no está precalentado, paga 171 ms de conexión y 142 de TLS. El aviso de
  «preconnect no utilizado» es un falso positivo aquí. **No los quites.**
- **Cada HTML del build lleva sólo lo suyo, y el prerenderizador lo recorta.** `index.html`
  se queda con la precarga de la foto del hero y **sin** el adelanto de la pieza; `app.html`,
  al revés. Antes los dos llevaban todo: cada ficha, cada catálogo y cada pantalla del panel
  precargaban `pen-hero-768.webp` con `fetchpriority="high"` —20 KB a máxima prioridad
  compitiendo con la foto que sí era su LCP—. El script se planta si no encuentra alguno de
  los dos bloques: son recortes que se creen hechos.
- **El HTML de una pantalla que NO se prerenderiza no puede pasar de ~14 KB comprimidos.**
  Es la ventana inicial de congestión de TCP: lo que cabe ahí llega en un viaje de red, lo
  que no, paga otro entero. Y en `app.html` el HTML es la raíz de la cadena —de él cuelgan
  el bundle, el adelanto de la pieza y, a través de éste, la foto del LCP—, así que ese
  viaje de más **se lo cobra a todo lo que viene detrás**. Medido con PageSpeed el 30 de
  agosto de 2026 al meterle la hoja de estilos adentro: el HTML pasó de 4,45 KiB y 65 ms a
  15,39 KiB y 368 ms, la consulta de la pieza de 225 a 919 ms, la ruta crítica de 371 a
  1.246 ms, y la ficha de 95 a 93. Se revirtió.
  **La portada es el caso contrario y por eso ahí sí conviene**: viene pintada, no cuelga
  nada de ella, y el viaje de más se paga una vez en el FCP en lugar de multiplicarse.
  Ojo con probar esto en local: el estrangulamiento de Chrome es un balde de fichas y **no
  simula la ventana de congestión** — seis corridas locales dieron lo mismo con hoja
  enlazada y en línea. Lo ve Lighthouse y no lo ve tu banco de pruebas.
- **La hoja de estilos viaja DENTRO de `dist/index.html`, no colgando de un `<link>`.**
  Por eso pesa 44 KB en crudo. Es la hoja entera y en el sitio donde estaba el `<link>` —no
  un recorte «crítico»—, justamente para que la cascada no cambie; comprobado con
  `huella-estilos.mjs --estados`. Dos consecuencias: **una `url()` relativa en `index.css`
  se rompería** (en línea se resuelve contra `/` y no contra `/assets/`; el script lo veta),
  y **no le añadas un `preload` de la hoja a `index.html`**, que sería bajarla dos veces.
- **`dist/index.html` y `dist/app.html` NO son el mismo archivo.** El primero trae la
  portada ya pintada; el segundo es el cascarón vacío al que `vercel.json` manda todo lo
  demás. Si el comodín volviera a apuntar a `/index.html`, quien abre el enlace que Valentina
  le mandó por WhatsApp **vería la portada** un instante antes de que React pusiera su pieza.
  Por eso el `source` del comodín termina en `.+` y no en `.*`: la ruta raíz no puede caer
  ahí ni por accidente.
- **Nada que se pinte puede depender del navegador en el PRIMER render.** Desde que la
  portada se prerenderiza, el HTML sale de Node: sin `navigator`, sin `localStorage`, sin la
  fecha de hoy. Si el primer render del navegador no coincide con ese HTML, React tira lo que
  ya estaba pintado y reconstruye el árbol entero — o sea, deshace el prerenderizado **sin
  que se note en pantalla**. Ya pasó con el enlace de WhatsApp (`isMobile()` y la marca
  `[ref:]`): para eso está `useWaUrl` en `src/lib/whatsapp.js`, que pinta lo mismo en los dos
  lados y arregla el enlace después de montar. Lo mismo cubren `useEfectoDeDiseno` en
  `aparecer.js` y el `suppressHydrationWarning` del año en el `Footer`.
- **390px no basta para probar móvil.** El iframe es la única forma de medir de verdad
  el comportamiento en pantallas reales en esta sesión.
- **Hay dos píxeles de Meta con el mismo nombre y sólo uno recibe eventos.** Verifica el
  ID antes de concluir que la medición está rota.
- **Meta descarta eventos server-side sin `user-agent`.** Por eso `client_ua` se guarda
  en `orders` y viaja en la atribución.
- **Valentina sabe de qué anuncio viene alguien, pero la pieza se la dice una tabla.** El
  `referral` de Meta trae el id del anuncio, su titular y su cuerpo — nunca la joya. El
  puente es `ajustes_internos.anuncios_piezas` (`source_id` → uuid de pieza), y **vive en la
  base a propósito**: Meta no deja editar el enlace de un creativo publicado, así que cada
  cambio de anuncio trae un id nuevo, y en el código cada campaña sería un despliegue.
  Guarda el uuid y no el nombre ni el precio: los dos se leen del catálogo al responder. Un
  id que no esté en la tabla no rompe nada —se cae al flujo de preguntar— pero **deja el
  `source_id` en el registro de `wa-webhook`**, que es la única forma de enterarse de que
  falta una fila.
- **Dos mensajes seguidos de la misma persona pueden arrancar dos Valentinas.** `wa-webhook`
  espera 15 s para agruparlos, pero esa espera sólo protege el **arranque**: una corrida
  tarda diez o veinte segundos entre el modelo y las fotos, y lo que entre en ese rato
  arranca otra que pasa su propio chequeo. El 31 de agosto de 2026 eso mandó la misma foto
  dos veces y dos cierres contradictorios —«te muestro dos opciones» y «te muestro tres»— en
  once segundos, a la primera clienta que llegó por pauta. Lo cierra el candado
  `tomar_turno`/`soltar_turno`. **Si tocas ese bucle, mira las dos constantes juntas**:
  `VUELTAS_MAX` está atado al plazo de caducidad del candado (90 s), y subir una sin la otra
  hace que el candado caduque debajo de la corrida que lo tiene.
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
- **El elemento LCP de la portada es la foto del hero — pero lo fue el texto del logo.**
  Lo era mientras las fuentes venían de Google; con las fuentes propias y la foto precargada
  pasó a ser el `<img>`, medido el 30 de agosto de 2026 contra producción. La costumbre sigue
  siendo la misma y es la que importa: **mirar qué dice `largest-contentful-paint-element` en
  el informe antes de tocar nada**, porque este sitio ya se optimizó dos veces contra el
  elemento equivocado.
- **La foto de la ficha se precarga desde el HTML, y eso son TRES copias de la misma
  regla.** El `<script>` de `index.html` arma el `srcset` de la foto en cuanto llega el JSON
  de la pieza —a los ~250 ms, en vez de esperar a que React pinte el `<img>` sobre el segundo
  1,5—. Para eso repite lo que hacen `fotoProducto()` y el `sizes` del `<img>`. **Si las tres
  dejan de decir lo mismo, el navegador precarga un archivo y pinta otro: la foto se baja dos
  veces**, sin error y sin nada raro en pantalla. `fotoProducto.test.js` extrae la función
  del HTML y la corre contra la de verdad; el `sizes` vive una sola vez, en `TAMANOS_FICHA`.
  Y la precarga va **sin `href`** a propósito: con él, un navegador que no entienda
  `imagesrcset` se bajaría un archivo que el `<img>` no va a usar.
- **«Mejora la entrega de imágenes» miente cuando hay densidad de pantalla de por medio.**
  El 30 de agosto de 2026 dijo que sobraban 36 KiB en la foto de la ficha: que el archivo
  (717×800) era más grande de lo necesario para sus dimensiones de visualización (461×461).
  Está **comparando píxeles de pantalla contra píxeles CSS**: 717 y 800 son 412 y 461
  multiplicados por el 1,75 de densidad del Moto G que emula. Con cualquier densidad mayor
  que 1 el archivo siempre va a parecer grande. Medido de verdad, con la caja real y el
  recorte de `object-fit: cover` —que en una foto cuadrada manda el lado MAYOR de la caja,
  no el ancho—:

  | Aparato | Caja | Necesita | Baja | |
  |---|---|---|---|---|
  | Moto G Power (el de Lighthouse) | 412×461 · 1,75 | 807 px | 800 | falta 1 % |
  | iPhone 14/15 | 390×470 · 3 | 1.410 px | 1.254 | falta 11 % |
  | Galaxy A típico | 412×470 · 2,625 | 1.234 px | 1.254 | sobra 2 % |
  | Escritorio 1440 | 720×900 · 2 | 1.800 px | 1.254 | falta 30 % |

  O sea que la escalera `[400, 800]` más el original está bien calibrada, y si algo le pasa
  es que **se queda corta arriba**, no que sobre. **No resubas fotos por este aviso**, y no
  añadas un peldaño de 600: no hay aparato que lo pida —el Moto G necesita 807 y seguiría
  eligiendo el de 800—. El script para volver a medirlo está en la spec de la ficha.
- **`decoding="async"` en el elemento LCP es un tiro en el pie.** Le dice al navegador que
  pinte sin esperar a descodificar la imagen y que la descodifique cuando pueda — y ese
  «cuando pueda», en un celular lento, es después de hidratar React. La foto del hero lo
  llevaba: con ella bajada desde el primer momento, el LCP saltaba entre 1,7 y 2,7 s de una
  corrida a otra. Se quitó el 30 de agosto de 2026. Vale para el hero y para la foto de la
  ficha: **en lo que es el LCP no se difiere nada**.
- **Y lo que tarda no es bajar la foto, es pintarla.** El desglose del LCP el 30 de agosto de
  2026: la foto entera a los 1,0 s y `Render Delay` de 4.936 ms —el 83 %—, porque `#root`
  estaba vacío y no había nada que pintar hasta que React montaba. Por eso la portada se
  prerenderiza. Si vuelves a ver un LCP alto, mira **la fase**: si es `Render Delay`, el
  problema no es la red y precargar cosas no lo va a arreglar.

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
