# Pendientes

Hallazgos encontrados al documentar el proyecto el **22 de agosto de 2026**.
Cada uno lleva dónde está, por qué importa y el arreglo propuesto.

> **Revisado contra el código el 23 de agosto de 2026.** Cerrados ese día: la página de
> error (#13), las meta de las páginas legales (#14), el JSON-LD y el Hero (#9, #10), el
> lint en cero dentro del build (#23), la firma de Mercado Pago (#3, secreto incluido)
> y la superficie de seguridad versionada (#4, a medias y a propósito).
>
> Lo ya resuelto está en [Resueltos](#resueltos) o marcado ✅ donde estaba. Un 🟡 quiere
> decir que se hizo la parte que se podía y queda dicho qué falta. El resto sigue vivo y
> verificado.
>
> **La numeración no se reutiliza.** Los specs de `docs/specs/` enlazan a estos números,
> así que un hallazgo resuelto se marca ✅ pero conserva el suyo.

**Índice**
- [Resueltos](#resueltos)
- [🟠 Alto — gobernanza](#-alto--gobernanza)
- [🟡 Medio — lo que le prometemos al cliente](#-medio--lo-que-le-prometemos-al-cliente)
- [🔵 Deuda técnica](#-deuda-técnica)

---

## Resueltos

### ✅ La lectura de pedidos con la llave pública — y una corrección

Resuelto por `20260822_pedido_publico.sql` + `Confirmacion.jsx:52`.

**Corrección a lo que decía este documento.** La primera versión afirmaba que en
producción cualquiera podía listar todos los pedidos con nombre, teléfono, correo y
dirección. **Eso no era cierto, y el error fue mío**: lo inferí de
`20260311_orders_rls.sql:24-28` —donde la política `orders_anon_read_own` sí está escrita
con `USING (true)`— y lo di por hecho de producción sin comprobarlo contra la base.

Comprobado después con la llave pública: **la base tiene una sola política sobre `orders`,
la de `authenticated`, y la consulta devuelve `[]`.** El archivo y la base llevaban tiempo
separados.

El riesgo real era otro, y más silencioso: el día que alguien reconstruyera la base
aplicando las migraciones en orden, esa política **se habría creado**. La migración nueva
lo cierra con un `DROP POLICY IF EXISTS` colocado después, para que la deshaga.

Y destapó un daño que sí estaba ocurriendo: como `anon` no podía leer `orders`, para una
clienta real la consulta de `/confirmacion` devolvía `null`, la página se quedaba sin
resumen **y `pixelCompra()` nunca se disparaba** — el evento `Purchase` del navegador no
salía, dejando coja la deduplicación con el del servidor justo antes de prender pauta.
Nadie lo notó porque 16 de los 17 pedidos son contraentrega tomados por WhatsApp: ninguna
clienta real había pasado por esa pantalla.

### ✅ Las conversaciones abiertas a la llave pública

`20260822_cerrar_conversaciones_a_anon.sql` (`b427f66`). Cinco tablas tenían
`[public ALL] using=true`: se podía leer **y borrar** toda la correspondencia con las
clientas. Cerrado.

### ✅ Las tablas de respaldo

`20260822_quitar_respaldos_de_chats.sql` eliminó los tres `respaldo_*_20260822`.

### ✅ Migraciones sin commitear

Todas las del 22 de agosto están commiteadas y en `main`.

### ✅ Cualquiera con una sesión podía borrar al dueño

Resuelto por `create-admin` v16, desplegada el 22 de agosto de 2026 (`cb6fd20`).

La función usa la llave de servicio para crear y borrar cuentas, y sólo comprobaba que
quien llamaba estuviera autenticado — no **quién** era. Como todo usuario de Supabase Auth
es administrador en este proyecto, cualquiera con sesión podía darse de alta otra cuenta o
**borrar la del dueño** y quedarse con el panel.

Ahora las tres acciones (`list`, `delete` y crear) exigen ser el dueño. El rol vive en
`app_metadata`, que sólo se escribe con la llave de servicio: `user_metadata` no servía
porque esa la cambia el propio usuario desde el navegador y se marcaría dueño solo.

**El arranque se resuelve solo.** Exigir el rol sin que nadie lo tenga habría dejado el
panel sin administrador posible, obligando a sellar al dueño *antes* de desplegar — la
clase de paso que se olvida y deja a alguien fuera de su propia tienda. Mientras no haya
ningún dueño sellado manda la cuenta más antigua, y se le graba el rol en ese momento.
Nadie puede crear una cuenta anterior a la primera, y en cuanto se usa una vez la excepción
se cierra sola. Si el sellado falla no se deja pasar la acción, porque eso la volvería
permanente.

Al dueño tampoco se le borra desde el panel, ni siquiera por otro dueño.

**Verificado contra el endpoint real**: sin `Authorization`, con token inválido y un
`delete` sin sesión devuelven `401` — nunca `200`.

**Queda una decisión de negocio, no técnica.** Hay una segunda cuenta
(`gercysaavedra@gmail.com`) que a partir de ahora **no puede administrar cuentas**. Es el
efecto buscado, pero si esa persona necesitaba hacerlo, hay que sellarla también como
dueño:

```sql
UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"rol":"dueño"}'::jsonb
 WHERE email = '<correo>';
```

**Nota de configuración:** la función quedó con `verify_jwt: false`, que era su valor
previo. No es un agujero —valida el token por su cuenta con `getUser()`, y las pruebas lo
confirman— pero activarlo sería defensa en profundidad: rechazaría en la puerta lo que hoy
se rechaza dentro.

---

---

## 🟠 Alto — gobernanza

### 3. ✅ `mp-webhook` no valida la firma de Mercado Pago — resuelto

**Dónde:** `supabase/functions/mp-webhook/index.ts`

**Cuál era el riesgo real, con precisión.** La función **nunca se creyó lo que le
mandaban**: toma el id del aviso y consulta el pago contra la API de Mercado Pago con
`MP_ACCESS_TOKEN` antes de tocar nada. Eso significa que **no se podía falsificar un pago
aprobado** invocando el endpoint — que habría sido lo grave.

Lo que sí quedaba abierto: cualquiera podía invocar el endpoint con ids arbitrarios y
provocar consultas a la API de MP (posible agotamiento de cuota) y reprocesos. El candado
`conversion_enviada_en` evitaba que se duplicaran conversiones y correos, así que el daño
era ruido y consumo, no dinero ni datos.

**Hecho el 23 de agosto, completo.** `firmaValida()` está en `mp-webhook/index.ts`,
calcada de `wa-webhook`: HMAC SHA-256 sobre el esquema de Mercado Pago
(`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`) con comparación de tiempo constante.
Y **`MP_WEBHOOK_SECRET` ya está puesto** en los secretos de Supabase, así que la
validación está activa de verdad, no en espera.

*Verificado contra el endpoint real ese mismo día, y otra vez al cerrar este hallazgo:*
sin `x-signature`, con firma inventada y con firma bien formada pero falsa, las tres
responden **401** (antes las tres respondían 200); la notificación firmada por el
simulador de Mercado Pago responde **200**.

Dos detalles que conviene no perder:

- **Falla abierto si el secreto desaparece** — diferencia deliberada con `wa-webhook`,
  para que desplegar el código antes de tener el secreto no tumbe los pagos. Hoy el
  secreto existe; si alguien lo borra, el endpoint vuelve a aceptar todo *en silencio*.
- **Un pago real avisa por dos rutas.** En el panel de MP, la aplicación *Auremgsjoyeria*
  tiene el webhook en modo productivo apuntando a la misma función con el evento *Pagos
  (legacy)*, y además `create-preference` manda esa URL como `notification_url` de cada
  preferencia. Es una red, no un problema: el candado `conversion_enviada_en` evita el
  duplicado.

**Lo único que falta ya no es red de seguridad sino confirmación:** un pago real de
prueba, de punta a punta.

---

### 4. 🟡 El repositorio no puede reconstruir su base — la mitad que importa, hecha

**Dónde:** `supabase/migrations/`

Sólo hay migración para 4 tablas (`taller_precios`, `taller_conocimiento`,
`plantillas_enviadas` y `products` vía `supabase-schema.sql`). **No están en control de
versiones:** `orders`, `order_items`, `customers`, `whatsapp_conversaciones`,
`chat_takeover`, `chat_status`, `contact_tags`, `notes`, `gasto_pauta`,
`ajustes_internos`, `vigilancia_ultima`, la vista `envio_publico`, **ni ninguna de las 8
RPC**, ni la mayoría de las políticas RLS.

**Por qué importa.** Un entorno nuevo (o una restauración) no se levanta desde este repo.
Y las políticas RLS que no están versionadas tampoco se revisan en un diff — que es
exactamente cómo el hallazgo #1 lleva desde marzo sin que nadie lo viera, y cómo cinco
tablas de conversaciones estuvieron abiertas a la llave pública hasta el 22 de agosto.

Ese mismo trabajo destapó **seis tablas que nadie sabía que existían**: tres muertas
(`message_history`, `whatsapp_dedup`, `conversaciones` — cero referencias, cero filas) y
tres respaldos manuales con 104 filas de conversaciones reales y RLS apagado (ya
eliminados). Un volcado del esquema las habría hecho visibles mucho antes.

Y es también lo que hizo posible el error de este documento sobre `orders`: **el archivo
de migración decía una cosa y la base otra**, y no había forma de notarlo desde el
repositorio. Mientras el esquema no esté versionado, leer las migraciones **no** es leer
la base.

**Hecho el 23 de agosto: `supabase/migrations/20260823_superficie_de_seguridad.sql`.**
926 líneas extraídas del catálogo —`pg_policies`, `pg_get_functiondef`,
`pg_get_triggerdef`—: 20 sentencias de RLS, 24 políticas, 21 funciones y 6 disparadores.
Eso es **quién puede tocar qué**, que es lo que se revisa en un diff y lo que dejó pasar
las cinco tablas abiertas.

Lo que **sigue faltando** es el volcado de tablas: sin `supabase db pull` un entorno vacío
no se levanta desde este repo, y ese comando pide la contraseña de la base. Su cabecera lo
dice para que nadie lo confunda con una migración reproducible.

**Arreglo pendiente:**

```bash
npx supabase link --project-ref <ref>
npx supabase db pull --schema public   # vuelca el esquema real a una migración
```

Revisar el resultado a mano (el volcado trae ruido), commitearlo como
`20260822_esquema_existente.sql`, y a partir de ahí **prohibir cambios de esquema desde el
dashboard**. Aprovechar el mismo paso para volcar las 8 RPC.

---

### 5. ✅ Migraciones sin commitear — resuelto

Todas están en `main`. Queda una comprobación que **sigue mereciendo la pena**: confirmar
que están aplicadas en Supabase, no sólo escritas en el repo.

```sql
SELECT * FROM public.chats_sin_responder() LIMIT 1;
SELECT * FROM public.conversaciones_purgables(12) LIMIT 1;
SELECT * FROM public.pedido_publico('<uuid de un pedido>');
SELECT policyname FROM pg_policies
 WHERE tablename = 'objects' AND schemaname = 'storage';
```

Si la política de `chat-media` no está aplicada, el borrado de conversaciones falla en el
paso de fotos y —por diseño, para no dejar archivos huérfanos— **no borra nada**.

---

### 6. `.claude/` está en `.gitignore`

La skill `designing-aurem-gs` —que es la versión operativa de `DESIGN.md`, con los hex y
las prohibiciones listas para construir— **no viaja con el repositorio**. Quien clone se
queda sin ella.

**Arreglo propuesto:** versionar `.claude/skills/` dejando fuera
`.claude/settings.local.json` (que sí es local):

```gitignore
.claude/*
!.claude/skills/
```

De paso: esa skill dice importar las fuentes desde `fonts.googleapis.com`, cosa que el
proyecto ya no hace desde que se autoalojan. Corregir ese bloque.

---

### 7. `supabase-schema.sql` está obsoleto

Define `products` sin `metal`, `piedra`, `engaste`, `images`, `stock`, `compare_price` ni
`talla_rango` — siete columnas que el frontend sí consume — y con un `CHECK` de categoría
que no incluye `Dijes`, que sí está en `CATEGORIAS` de `Catalog.jsx:8`.

**Arreglo:** queda resuelto por el #4. Después, borrarlo o marcarlo como histórico.

---

## 🟡 Medio — lo que le prometemos al cliente

### 8. ✅ La política de devoluciones se contradecía con el FAQ — resuelto

El FAQ (`src/components/Faq.jsx`) prometía **30 días** para devolver; la política
(`src/pages/ReturnsPolicy.jsx`) decía **5 días hábiles**. Dos pantallas del mismo sitio con
plazos distintos por escrito, y **obliga el más generoso**: el sitio se estaba
comprometiendo a 30 días sin quererlo.

Era la confusión que se sospechaba: el FAQ mezclaba el **retracto** (Ley 1480, 5 días
hábiles, sin justificación) con la **garantía** (30 días, y sólo si la pieza salió
defectuosa). No son lo mismo.

**Decidido el 23 de agosto de 2026: el plazo de devolución es el legal, 5 días hábiles.**
El FAQ ya lo dice así, separando el retracto —que el cliente paga— de la pieza defectuosa
o equivocada —que pagamos nosotros—.

**De paso quedaron alineadas las tres promesas de garantía**, que también discrepaban. Los
Términos ya tenían el modelo bueno y ahora lo repiten el FAQ y la política:

| Garantía | Cubre |
|---|---|
| **De por vida** | El **metal**: que una plata 925 sea plata 925. Ajustes de talla y pulido sin costo. |
| **30 días** | **Defectos de fabricación**: engastes, soldaduras, acabados. |
| — | **Las piedras no entran en ninguna**, y se revisan caso por caso. |

El FAQ decía que la garantía de por vida cubría los defectos de fabricación, que es justo
lo que choca con los 30 días. Y la política sólo mencionaba los 30 días: era la pantalla
que el cliente abre para reclamar y la que se quedaba corta frente a lo que la ficha de
cada pieza promete. La fecha de la política, que decía **febrero de 2025**, quedó en agosto
de 2026 como las otras dos.

**La mitad que no está en el código también quedó hecha.** Valentina responde desde
`taller_conocimiento`, no desde estos archivos, y resultó que **no decía 30 días: no decía
nada**. El tema no existía en la tabla. La regla 1 del prompt le prohíbe inventar plazos,
así que escalaba en vez de mentir —bien—, pero una pregunta tan común no debería llegar a
una persona. Se le escribió el tema *Devoluciones y retracto* y se completó *Garantía*, que
sólo mencionaba la de por vida. Va versionado en
`supabase/migrations/20260823_conocimiento_devoluciones.sql`.

> ⚠️ **Una pregunta legal que quedó abierta.** El artículo 47 excluye del retracto los
> bienes *"confeccionados conforme a las especificaciones del consumidor"*, y en este taller
> **todo se hace por encargo**. Ni el sitio ni Valentina invocan esa excepción —prometen los
> 5 días a todo el mundo—, que es lo prudente mientras nadie lo consulte con un abogado.
> Dicho quede: si algún día se quiere invocar, hay que cambiarlo en los dos sitios a la vez.

### 9. ✅ El JSON-LD de la portada promete lo que el sitio ya retiró — resuelto

**Dónde:** `src/pages/Home.jsx:11-21`

Inyecta un `JewelryStore` que anuncia **platino**, **collares, pulseras y aretes** y
**certificación de autenticidad** — las cuatro promesas que el resto del sitio ya corrigió
(`index.html:31-40` documenta haberlas quitado; `TrustBar.jsx:41-45` y `WhyUs.jsx:38` ya
dicen que el certificado cuesta $50.000 aparte).

Es lo que Google lee. Además usa URLs **sin `www`**, incoherentes con la canónica.

**Hecho el 23 de agosto.** El `JewelryStore` dice ahora lo que hay —anillos y dijes en
oro 18k, oro blanco y plata 925, con esmeralda colombiana—, el certificado figura como
opcional y con su precio, y `url` y `logo` van con `www`, igual que la canónica.

### 10. 🟡 Hero y Reviews prometían platino y certificación incluida — Hero resuelto

**El Hero, hecho el 23 de agosto:** ya no anuncia collares, pulseras ni platino, y la
garantía dice "en el metal" en los dos sitios donde aparece, no sólo en uno.

**Reviews sigue igual, por decisión tuya.** `Reviews.jsx:18` tiene un testimonio que
insinúa que la certificación va incluida. Se va cuando se vayan las reseñas inventadas
(#11): se cambian el día que haya testimonios reales.

### 11. Las reseñas son inventadas

**Dónde:** `src/components/Reviews.jsx:4-29, 51-58`

Cuatro testimonios con nombre y foto, *"4,9/5"*, *"+500 piezas entregadas"*, *"+100
clientes"*. **Todo hardcodeado, y no hay clientes reales todavía** — los 17 pedidos de la
base son del equipo.

Esto no es un detalle estético: en Colombia la SIC sanciona la publicidad engañosa, y los
testimonios falsos con cifras concretas son el caso de libro. Además `taller_conocimiento`
puede estar alimentando a Valentina con esas mismas cifras.

**Opciones, de mejor a peor:** conectar reseñas reales cuando las haya; sustituir la
sección por prueba de confianza verificable (fotos del taller, punzón, garantía escrita);
o retirarla hasta tener clientes. Lo que no se puede es dejarla como está cuando empiecen
a entrar pedidos reales.

### 12. 🟡 Verificar que Valentina no siga diciendo "SIN CONFIRMAR" — la base, limpia; el seed, no

`supabase/migrations/20260818_taller_conocimiento.sql:27-29` sembró las 6 filas marcadas
*"SIN CONFIRMAR"*, y Valentina lee esa tabla en caliente para componer su prompt.

**Comprobado el 23 de agosto, y era eso.** Las 6 filas de la base están activas y
ninguna dice "SIN CONFIRMAR": envíos, medios de pago, piezas a medida, qué va incluido,
garantía y piedras. Valentina no está diciéndolo.

**Pero el seed sigue con 7.** `20260818_taller_conocimiento.sql` no se toca —está
aplicada—, así que hace falta **una migración nueva** que deje el conocimiento donde ya
está la producción. Mientras no exista, un entorno nuevo nace mintiendo. Es lo único que
queda de este hallazgo.

### 13. ✅ No hay ruta 404 — resuelto

`src/App.jsx` no define `path="*"`. Cualquier URL inválida cae en el rewrite de
`vercel.json` y renderiza **una página en blanco** con el botón de WhatsApp flotando.

**Hecho el 23 de agosto:** `src/pages/NoEncontrado.jsx`, con la voz del estado vacío del
catálogo —que resuelve el mismo problema, "no está lo que buscas", y aquí siempre termina
igual: se puede hacer por encargo—. Lleva `robots: noindex, follow`, para lo cual hubo que
enseñarle a `ponerMeta` a poner `robots` y **a restaurarlo al salir**: una limpieza a
medias habría dejado el sitio entero sin indexar.

**Una honestidad que conviene dejar escrita:** en una SPA sobre Vercel esta página
responde **HTTP 200**, no 404. Arreglarlo de verdad pide prerender o una función. El
`noindex` evita lo que importa —que Google las coleccione—, pero el código de estado sigue
mintiendo.

### 14. ✅ Las páginas legales no ponen sus meta tags — resuelto

Ninguna de las cuatro llama a `ponerMeta`, así que heredan título, descripción y
**canónica de la portada** — aunque las cuatro están en el sitemap. Cuatro URLs
declarándose como si fueran la home.

**Hecho el 23 de agosto.** Las cuatro tienen título, descripción y canónica propias. Se
resolvió con un componente `<Meta />` en vez de un efecto en cada una: las cuatro son
funciones flecha que devuelven JSX directo, y meterles un efecto habría hecho un diff de
puras llaves. La guía de tallas lleva descripción escrita para quien busca "cómo saber mi
talla de anillo", que es la única de las cuatro que alguien busca.

---

## 🔵 Deuda técnica

### 15. El titular de la portada sale en negrita sintética

**Dónde:** bloque `HERO SECTION` en `src/index.css:7913`, que pisa al original de `:375`.
El selector duplicado está en `:7925`.

Está **fuera de toda media query**, así que gana siempre. `.hero-h1` pierde sus cuatro
declaraciones:

```
L393  .hero-h1
      font-weight: 400                    →  L7925 gana con 800
      font-size: clamp(3rem, 5vw, 4.5rem) →  L7925 gana con 5rem
      line-height: 1.014                  →  L7925 gana con 1.05
      letter-spacing: -0.015em            →  L7925 gana con -0.04em
```

Marcellus **sólo tiene peso 400** (`src/fuentes.css`), así que el navegador engorda los
trazos por su cuenta: el titular de la portada se ve emborronado y contradice `DESIGN.md`.

El bloque además define `.hero-right-col` y `.hero-social-proof`, que no existen en
`Hero.jsx` — es un resto del diseño anterior.

**Arreglo:** borrar el bloque duplicado y confirmar con `npm run css:pisadas`, que hoy lo
reporta como el primero de la lista.

### 16. `src/index.css` son 17.781 líneas

**25 bloques con declaraciones muertas** — venían de 84, así que la limpieza va avanzando.
Los que quedan son casi todos del panel (`.admin-topbar-avatar`, `.chat-contact-item`,
`.chat-quick-replies`…), pisados por la capa de rediseño posterior.

Siguen conviviendo tres capas para la ficha de producto (`.ficha-*`, `.product-page-*` y
una reescritura al final). CSS muerto confirmado: `.admin-table` (12 referencias en CSS, 0
en JSX), `.dash-table` (11/0), `.ficha-tecnica-lista` (5/0), `.product-page-grid`,
`.product-page-btn`.

**Arreglo propuesto, por orden de riesgo:** primero borrar lo que `css:pisadas` marca como
muerto y no aparece en ningún JSX (riesgo cero, ganancia inmediata); después separar en
`index.css` + `admin.css`; y sólo entonces plantear unificar las tres capas de la ficha.
No hacerlo todo de una vez.

### 17. `Dashboard.jsx` son 4.100 líneas (y `ChatPanel.jsx` 2.135)

Contiene las 7 secciones del panel, más `DashboardHome`, `ProductsSection`,
`OrdersSection`, `CustomersSection`, `ReportsSection`, `NotesSection`, `SettingsSection`,
`PrecioOroCard`, `ConocimientoCard`, `CustomerModal`, `ShipModal`…

**Arreglo:** un archivo por sección en `src/pages/admin/secciones/`, dejando `Dashboard.jsx`
como el contenedor que resuelve `?tab=`, la carga de datos y el lente `es_prueba`.

### 18. `ProtectedRoute` no reacciona a que expire la sesión

`src/components/ProtectedRoute.jsx:9-18` llama a `getSession()` **una sola vez al montar**
y no se suscribe a `onAuthStateChange`. Si la sesión caduca o se cierra en otra pestaña,
la ruta sigue montada hasta que algo la remonte.

**Arreglo:** suscribirse a `onAuthStateChange` y limpiar en el `return` del efecto. De
paso, quitar las comprobaciones redundantes de `Dashboard.jsx:3688-3692` y
`ChatPanel.jsx:297-301`.

### 19. El contador de mensajes sin leer no se ve en el Dashboard

`ChatPanel.jsx:1106` pasa `chatUnread`, pero `Dashboard.jsx:3783` monta `AdminSidebar`
**sin esa prop**. El badge sólo aparece cuando ya estás en el chat, que es justo donde no
hace falta.

**Arreglo:** el Dashboard ya consulta los no leídos para la tarjeta "Sin responder";
pasarlos al sidebar.

### 20. 🟡 Las fotos de producto no están optimizadas en la entrega — hecho el mecanismo, faltan las fotos

`src/components/catalog/ProductCard.jsx` y la galería de `ProductPage.jsx` usaban
`<img src={product.image_url}>` crudo: **sin `srcset` y sin `width`/`height`**. La tarjeta
del catálogo sí llevaba `loading="lazy"`; la galería de la ficha no, y sus miniaturas de
52px descargaban la foto entera — abrir una ficha de tres fotos bajaba las tres a tamaño
completo aunque no se mirara ninguna.

**El transformador de imágenes de Supabase Storage no sirve aquí: es de plan Pro.**
Comprobado el 23 de agosto contra el proyecto — `/storage/v1/render/image/public/...`
responde `403 FeatureNotEnabled`. El arreglo propuesto originalmente (`?width=`) no era
viable sin pagar.

**Hecho el 23 de agosto.** Los tamaños se generan **al subir**, extendiendo lo que
`optimizarFoto.js` ya hacía —lienzo, dos versiones, WebP— con copias de 400 y 800 px de
ancho. Y como el catálogo no tiene columna donde anotar qué copias existen, **lo dice el
nombre del archivo**: una foto con el tratamiento completo termina en `-<ancho>x<alto>.webp`
y a su lado viven `-w400.webp` y `-w800.webp`. `src/lib/fotoProducto.js` lee esa marca y
arma el `srcset`; si no está —foto vieja, o URL pegada a mano en el panel— devuelve la URL
sola. Eso es deliberado: **un `srcset` inventado apuntaría a archivos que no existen y la
clienta vería una foto rota**, que es peor que una foto pesada.

También se puso `width`/`height` (donde no estorban), `decoding="async"`, `loading="lazy"`
en las miniaturas y `fetchpriority="high"` en la foto grande de la ficha, que es el LCP de
esa pantalla.

Verificado en Chrome con DPR 2: la tarjeta pide la de **800**, la galería la **grande**, la
miniatura la de **400**. Y comprobado renglón a renglón que el nombre que escribe la subida
y el que lee el `srcset` coinciden en todos los casos —incluida una foto tan chica que no
genera copias, y la gemela `.jpeg` de WhatsApp, que sigue saliendo del mismo nombre—.

**Lo que falta, y no se arregla solo: las fotos que ya están subidas no tienen la marca,
así que hoy siguen bajando en tamaño completo.** El mecanismo sólo entra a trabajar con
fotos nuevas. Para que sirva en las cinco piezas publicadas hay que **volver a subir sus
fotos desde el panel** — no hay migración posible desde aquí, porque las copias se generan
en el navegador de quien sube.

Dos detalles para quien toque esto después:

- **Cambiar la lista de anchos (`ANCHOS` en `fotoProducto.js`) obliga a resubir.** Las
  fotos que ya están en Storage se generaron con 400 y 800 y con ningún otro.
- **Nadie borra los archivos de Storage** cuando se borra una pieza —ya pasaba antes con
  la WebP y la gemela—, así que ahora quedan huérfanas dos copias más por foto.

### 21. El acordeón del FAQ no es accesible

`src/components/Faq.jsx:34` — el `onToggle` está en un `div`, no en un `<button>`: no hay
foco por teclado, ni `aria-expanded`, ni anuncio a lectores de pantalla. Contrasta con el
cuidado del resto (`Catalog.jsx:252-297` implementa un focus trap completo a mano).

**Arreglo:** `<button aria-expanded={abierto} aria-controls={id}>` en la cabecera.

### 22. Cosas pequeñas

- `src/pages/ProductPage.jsx:5` — `Wallet` de Mercado Pago se importa y **nunca se usa**;
  el flujo final es un `<a href={initPoint}>`. Peso muerto en el bundle.
- `src/pages/admin/ResetPassword.jsx` — conserva el diseño anterior ("PORTAL EXCLUSIVO",
  logo como `<img>`) mientras `Login` ya usa `<Isotipo />` y la dirección nueva. Además
  tiene un `onAuthStateChange` con el cuerpo vacío (líneas 14-22) y props de Framer Motion
  (línea 79) sobre un `div` plano, restos de la migración.
- `scripts/prerender.mjs` (201 líneas) está **huérfano**: no lo invoca ningún script de
  `package.json`. Su función la asumió `api/ficha.js`. Candidato a borrar.
- `.claude/settings.local.json` conserva ~60 permisos con rutas de Windows
  (`C:\Users\PC\Desktop\developer\Joyeria`) del equipo anterior. Ya no aplican.
- El contador de oferta de la ficha (`ProductPage.jsx:35-38`) **se reinicia solo** a otras
  24 h cuando llega a cero. Funciona como está escrito; decidir si la urgencia perpetua es
  lo que se quiere.

### 23. ✅ Nada impide que entre código roto — resuelto a medias, y a propósito

El lint ya está dentro del build (`eslint . && … && tsc -b && vite build`) y el
repositorio entero pasa en cero: 35 avisos heredados en `src/` más 29 fuera. De los 64,
**54 eran arreglo real y 10 quedaron suprimidos con el motivo escrito** —cargadores al
montar y suscripciones de Realtime, donde la regla del compilador de React es más
estricta que el problema—. Comprobado en Vercel el 23 de agosto: el despliegue de `main`
corre el lint y pasa.

Los 29 de fuera de `src/` eran todos falsos: la configuración le aplicaba las reglas del
navegador y de React a las edge functions de Deno y a las plantillas de correo. Ahora
`eslint.config.js` tiene un bloque por contexto.

**Lo que sigue faltando son los tests.** No hay ninguno, y montar el andamiaje es otro
proyecto. El lint en el build es el escalón realista, no el destino.

### 24. `npm run build` no corre en esta máquina

Descubierto al verificar esta documentación (22 de agosto de 2026):

```
sh: node_modules/.bin/tsc: /bin/sh: bad interpreter: Operation not permitted
```

**No es un problema del código.** El compilador funciona invocado directamente
(`node node_modules/typescript/bin/tsc -b` → sin errores, y `vite build` compila los 11
chunks). Lo que falla es el **shim de shell** de `node_modules/.bin/tsc`, que macOS no
deja ejecutar — probablemente un atributo extendido de cuarentena o los permisos del
directorio (`node_modules` está como `drwxrwxrwx`).

**Diagnóstico confirmado el 23 de agosto.** Es la cuarentena, no los permisos. Tres
comprobaciones:

- `xattr node_modules/.bin/eslint` → `com.apple.quarantine` (y `com.apple.provenance`).
- Un script `#!/bin/sh` recién creado por mí, con los mismos permisos, **sí corre**. Así
  que no es el directorio ni el modo `drwxrwxrwx`.
- Alcanza a **todos** los shims, no sólo a `tsc`: `vite` y `eslint` fallan igual.
  Invocados por Node funcionan (`node node_modules/eslint/bin/eslint.js --version` →
  v9.39.3).

**Arreglo:**

```bash
xattr -dr com.apple.quarantine node_modules/.bin
```

**No tumba ningún despliegue**, y eso ya está comprobado: Vercel construye en su propia
máquina, y el build con el lint dentro pasó allá en 30 segundos. Es una molestia local —
en esta máquina hay que invocar las herramientas por Node.

---

## Y una recomendación de fondo

El panel ya es más grande que la tienda (~9.250 líneas de CSS frente a ~8.300) y es la
única parte del sistema **sin ninguna guía de diseño**. `DESIGN.md:214-219` lo dice él
mismo: *"cuando el panel tenga sus propias reglas, tendrá su propio documento"*.

Ese documento —`DESIGN-PANEL.md`— es probablemente el trabajo que más rinde después de
cerrar los hallazgos críticos.
