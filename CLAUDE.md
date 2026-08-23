# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

> **Última conciliación con el código: 22 de agosto de 2026.**
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
npm run build        # sitemap.mjs && correos.mjs && tsc -b && vite build
npm run preview      # Sirve /dist
npm run lint         # ESLint (NO corre en el build)

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
2. **No hay tests, y el lint no corre en el build.** Nada impide que entre código roto.
3. `scripts/sitemap.mjs` nunca tumba el build: si le faltan las variables de Supabase,
   emite sólo las rutas fijas y sigue.

---

## 3. Arquitectura — cuatro planos, no uno

Este es el punto donde más se equivoca quien llega nuevo:

> **El backend real NO está en `api/`.**
> `api/` son 2 endpoints (≈220 líneas). La lógica de negocio son **9 Edge Functions de
> Supabase en Deno + 6 módulos compartidos, ≈3.400 líneas**.

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
- **CSS plano en un solo archivo.** No hay Tailwind, ni CSS modules, ni preprocesador.
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
  sincronizadas con `?tab=`.
- **`capturarClic()` e `iniciarPixeles()` corren a nivel de módulo** (`App.jsx:24-25`),
  no dentro de un efecto. React ejecuta los efectos de los hijos antes que los del
  padre, y metidos en un efecto se perdía el primer `PageView` de cada carga.
- **No hay ruta `*`.** Una URL inválida cae en el rewrite de `vercel.json` y renderiza
  una página en blanco. Es un hueco conocido — ver `docs/pendientes.md`.

---

## 5. Edge Functions

| Función | Autenticación | Servicios externos | Secretos |
|---|---|---|---|
| `wa-webhook` | HMAC SHA-256 de Meta | Meta Cloud API, OpenRouter | `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_TOKEN` |
| `wa-send` | JWT de admin | Meta Cloud API | `WA_TOKEN` |
| `create-preference` | ninguna (pública, CORS `*`) | Mercado Pago, Meta CAPI, TikTok | `MP_ACCESS_TOKEN`, `APP_URL` |
| `mp-webhook` | **ninguna** | Mercado Pago, Meta, TikTok, `/api/correo` | `MP_ACCESS_TOKEN`, `CORREO_SECRETO` |
| `conversion-pedido` | JWT de admin | Meta CAPI, TikTok | `META_CAPI_TOKEN`, `TIKTOK_ACCESS_TOKEN` |
| `correo-despacho` | JWT de admin | `/api/correo` → Resend | `CORREO_SECRETO`, `APP_URL` |
| `plantillas-programadas` | `x-cron-secreto` desde BD | Meta Cloud API | `PLANTILLAS_ACTIVAS` |
| `vigilancia` | `x-cron-secreto` desde BD | HTTP checks, `/api/correo` | `CORREO_SECRETO`, `APP_URL` |
| `create-admin` | JWT (**cualquiera**) | Supabase Auth Admin | `SUPABASE_SERVICE_ROLE_KEY` |

Módulos compartidos en `supabase/functions/_shared/`:

- `bot.ts` (1.095 l.) — Valentina: prompt, herramientas, bucle de agente, escalada
- `wa.ts` (464 l.) — envío a WhatsApp, troceado natural, indicador de "escribiendo", plantillas
- `medios.ts` (221 l.) — transcripción de audio y descripción de imágenes
- `conversiones.ts` (328 l.) — Meta CAPI y TikTok Events API server-side

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
redesplegar). **La programación no está versionada**: para verla, `SELECT * FROM cron.job;`.

---

## 6. Modelo de datos

> **Advertencia de gobernanza: sólo 4 de las ~22 tablas y ninguna de las RPC de analítica
> están en `supabase/migrations/`.** El resto se creó a mano en el dashboard de Supabase.
> **Un entorno nuevo no se puede reconstruir desde este repositorio.** Y las políticas RLS
> que no están versionadas tampoco se revisan en un diff — que es cómo se colaron los dos
> fallos de acceso público. Ver `docs/pendientes.md`.

### Tablas

| Tabla | ¿Migración en repo? | Para qué |
|---|---|---|
| `products` | sí (`20260228_esquema_base.sql`) | Catálogo |
| `orders` | parcial (sólo columnas añadidas) | Pedidos |
| `order_items` | **no** | Piezas de un pedido multi-pieza |
| `customers` | **no** | Clientes |
| `whatsapp_conversaciones` | parcial | Todos los mensajes de WhatsApp |
| `chat_takeover` | **no** | Cuándo una persona toma el control de un chat |
| `chat_status` | **no** | Resuelta / archivada |
| `contact_tags` | **no** | Etiquetas de contacto |
| `notes` | **no** | Anotaciones internas |
| `gasto_pauta` | **no** | Gasto de publicidad por día y canal |
| `taller_precios` | sí | Fila única: oro, recargo, abono, tope, IVA de pauta |
| `taller_conocimiento` | sí | Base de conocimiento editable de Valentina |
| `plantillas_enviadas` | sí | Candado anti-duplicado de plantillas de WhatsApp |
| `ajustes_internos` | **no** | Clave/valor: `cron_secreto`, `telefonos_avisos` |
| `vigilancia_ultima` | **no** | Fila id=1 con el último informe del vigía |
| `envio_publico` | **no** (es una vista) | Expone sólo `abono_envio` y `tope_contraentrega` |
| `pagos` | **no** | El libro de movimientos que lee `src/lib/caja.js`. Lo llena el trigger `registrar_pago` |

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

`status` ∈ `pendiente | pagado | procesando | enviado | entregado | cancelado`.
`payment_method` ∈ `mercadopago | contraentrega | …`.

**`whatsapp_conversaciones`** — `id`, `phone_number`, `role`, `content`, `message_type`,
`media_url`, `wa_message_id` (**único**, es el candado anti-reentrega), `is_read`,
`enviado_por` (`ia` | `humano`), `delivery_status`, `error_wa`, `wa_phone_id`, `referral`,
`created_at`.

**`products`** — base + `images[]`, `stock`, `metal`, `piedra`, `engaste`, `talla_rango`,
`compare_price`. (`costo` y `costo_provisional` siguen en la tabla pero están **muertas**
desde el 23-ago: el costo vive en el pedido.)

### RPC (ninguna versionada)

`chats_sin_responder`, `analiticas_whatsapp`, `buscar_conversaciones`,
`clientes_nuevos_vs_recurrentes`, `embudo_whatsapp`, `revenue_por_fuente`,
`tendencia_comparativa`, `top_ciudades_envio`.

### Buckets de Storage

- `product-images` — público. Fotos de catálogo.
- `chat-media` — **privado**. Fotos que mandan las clientas; se firman al vuelo por 1 h.

### Migraciones, en orden

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
| `20260822_chats_sin_responder.sql` | Función `chats_sin_responder()` |
| `20260822_cerrar_conversaciones_a_anon.sql` | 🔒 Cierra a `anon` las 5 tablas de conversaciones y enciende RLS en 3 respaldos |
| `20260822_borrar_chat_media.sql` | Política DELETE en `chat-media` |
| `20260822_conversaciones_purgables.sql` | Función `conversaciones_purgables()` — retención |
| `20260822_pedido_publico.sql` | 🔒 `pedido_publico(uuid)` y anulación de la política mina |
| `20260822_quitar_respaldos_de_chats.sql` | Elimina los respaldos del 22-ago |

`20260822_cerrar_conversaciones_a_anon.sql` arregló un fallo del mismo tipo que el que
sigue abierto en `orders`: `whatsapp_conversaciones` y `chat_takeover` tenían políticas
`[public ALL] using=true`, así que **con la llave pública se podía leer y borrar toda la
correspondencia con las clientas**. Ya está cerrado. **`orders` no** — ver
`docs/pendientes.md` #1.

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
`TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`, `APP_URL`, `PLANTILLAS_ACTIVAS`, `CORREO_SECRETO`

Todo lo que empieza por `VITE_` **acaba dentro del bundle público**. La anon key de
Supabase es visible para cualquiera: la seguridad real depende enteramente de RLS.

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

| Estado | Pago en línea | Contraentrega |
|---|---|---|
| `pendiente` | 0 | 0 |
| `pagado` | total | total |
| `procesando` | total | **sólo el abono** |
| `enviado` | total | **sólo el abono** |
| `entregado` | total | total |
| `cancelado` | 0 | 0 |

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
  sintética. (Hay un caso vivo de esto en el titular de la portada — ver `docs/pendientes.md`.)
- **`--accent-red: #ea4335` sigue definido pero es legado** de catálogo/admin.
  `DESIGN.md` lo prohíbe como acento de marca. Para estados de error usa los tonos de la
  marca: `#8C2F1E`, `#5E2114`, `#FBEDE9`.
- **Las fuentes se autoalojan** (`src/fuentes.css` + `public/assets/fuentes/*.woff2`).
  **No importes nada de `fonts.googleapis.com`** — se midió: pasar de Google Fonts a
  self-hosting fue lo que arregló un LCP de 5,7 s, porque el elemento LCP es el logo del
  navbar, que es texto en Marcellus.
- **`DESIGN.md` cubre la landing, no el panel.** El panel reutiliza los tokens pero
  descarta las reglas de conversión, y todavía **no tiene documento propio**.

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
  6.981 líneas) y `src/panel.css` (el panel, 7.922), que importan `Dashboard.jsx` y
  `ChatPanel.jsx`. **`panel.css` se carga después, así que ante igual especificidad gana.**
  Si mueves una regla de un archivo al otro, compruébalo: se hizo midiendo 24 propiedades
  calculadas de 3.691 elementos en once pantallas.
- **Qué es "del panel" no se decide por el nombre de la clase.** Se intentó por prefijos y
  `.joyero` —que es la ficha de producto— acabó en el panel y rompió la ficha. El criterio
  es dónde se usa: sólo en `src/pages/admin/` y en ningún otro sitio.
- **`index.css` arrastra capas del diseño anterior que deshacen los cambios nuevos.**
  Antes de dar por bueno un cambio de CSS, corre `npm run css:pisadas`. Hoy reporta **82**
  bloques con declaraciones pisadas — y lee la primera línea de su salida, no cuentes los
  bloques impresos: sólo enseña los 25 peores.
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
- [`diseno-y-frontend.md`](docs/specs/diseno-y-frontend.md) — CSS, fuentes, animaciones

**Y aparte:** [`docs/pendientes.md`](docs/pendientes.md) — hallazgos priorizados, incluidos
hallazgos pendientes, entre ellos dos de seguridad todavía sin resolver.
