# Pendientes

Hallazgos encontrados al documentar el proyecto el **22 de agosto de 2026**.
Cada uno lleva dónde está, por qué importa y el arreglo propuesto.

> **Revisado contra el código el 23 de agosto de 2026.** Cerrados ese día: la página de
> error (#13), las meta de las páginas legales (#14), el JSON-LD y el Hero (#9, #10), el
> lint en cero dentro del build (#23), la firma de Mercado Pago (#3, secreto incluido),
> el plazo de devolución (#8), la fase cero (#6, #12, #22, #24), la fase uno (#15, #18,
> #19, #21) y la base reconstruible (#4, #7).
>
> **Y uno nuevo, encontrado al hacer el #4: las RPC estaban abiertas a la llave pública.**
> Ver [#25](#25--las-rpc-estaban-abiertas-a-la-llave-pública--resuelto).
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

### 4. ✅ El repositorio no podía reconstruir su base — resuelto

**Dónde:** `supabase/migrations/`

Sólo había migraciones **incrementales** —añadir una columna, cerrar una política— sobre
tablas que nunca se crearon aquí: se habían hecho a mano en el panel de Supabase. Un
entorno nuevo no arrancaba, y no por falta de una tabla suelta: `20260311_add_shipping_address.sql`
hace un `ALTER` sobre `orders`, y `orders` no existía.

**Hecho el 23 de agosto.** `20260228_esquema_base.sql` crea las 12 tablas que faltaban, sus
claves, únicos, CHECKs, 17 índices y la vista `envio_publico`. Va **fechada antes que todas
las demás** a propósito: tiene que correr primero para que las incrementales encuentren su
tabla.

**Está volcada del catálogo de Postgres, no escrita a mano.** Y se verificó comparando el
`md5` de lo generado contra el de la base: idénticos, así que no hay ni una columna ni un
tipo mal copiado en 180 columnas.

**Al hacerlo aparecieron cuatro cosas que no se sabían:**

1. **Las 21 funciones y las políticas ya estaban versionadas**, en
   `20260823_superficie_de_seguridad.sql` — 926 líneas que este documento no mencionaba. El
   hueco era sólo de tablas.
2. **Hay una tabla `pagos`** que ni `CLAUDE.md` ni este documento listaban: es el libro de
   movimientos que lee `src/lib/caja.js`, con su trigger `registrar_pago`.
3. **`orders.status` admite un séptimo estado, `confirmado`**, que no aparece en el panel ni
   en la documentación. Se conserva tal cual: quitarlo es otra decisión.
4. **Tres migraciones se rompían solas en un entorno nuevo** por tocar tablas que hoy ya no
   existen. Ver abajo.

**La cadena, comprobada de principio a fin.** Se simuló el orden de las 28 migraciones
sobre una base vacía, sentencia por sentencia, buscando cualquiera que toque una tabla
antes de crearla. Salieron cuatro; tres eran reales y quedaron envueltas en
comprobaciones `to_regclass` —el mismo patrón que el propio repositorio ya usaba—, y una
era `storage.objects`, que Supabase siempre trae.

Dos de esas correcciones tocan migraciones ya aplicadas, contra la costumbre de no
reescribirlas. La excepción está razonada dentro de cada archivo: sobre la base real no
cambian nada, y sin ellas el repositorio seguía sin poder levantar su base — que es
justamente lo que este hallazgo pedía arreglar. Un caso concreto: `obtener_conversacion`
declaraba una variable **del tipo** de la tabla `conversaciones`, y `CREATE FUNCTION` sí
valida eso —comprobado—, así que la migración moría ahí.

**Lo único que no se ha hecho es levantar un entorno nuevo de verdad.** La comprobación es
estática, y la base real no puede servir de prueba porque ya tiene todo. Hacerlo de verdad
pide una rama de Supabase, que cuesta.

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

### 6. ✅ `.claude/` estaba en `.gitignore` — resuelto

La skill `designing-aurem-gs` —la versión operativa de `DESIGN.md`, con los hex y las
prohibiciones listas para construir— no viajaba con el repositorio. Quien clonara volvía a
inventarse el sistema de diseño.

**Hecho el 23 de agosto.** La regla quedó más estrecha que la propuesta original:

```gitignore
.claude/*
!.claude/skills/
.claude/skills/*
!.claude/skills/designing-aurem-gs/
```

Los dos últimos renglones no estaban previstos y hacen falta: las otras cinco entradas de
`.claude/skills/` son **symlinks a skills instaladas fuera del repositorio**
(`../../.agents/skills/…`, y `.agents/` también está ignorado). Versionarlas habría metido
cinco enlaces rotos en el clon de cualquiera. `settings.local.json` sigue fuera, que es
donde debe estar.

Y se corrigió lo que la skill decía de las fuentes: pedía importarlas de
`fonts.googleapis.com`, y el proyecto las autoaloja desde que eso arregló un LCP de 5,7 s.
Dejarla así era sembrar la regresión en quien la use para construir.

---

### 7. ✅ `supabase-schema.sql` estaba obsoleto — resuelto

Definía `products` sin `metal`, `piedra`, `engaste`, `images`, `stock`, `compare_price` ni
`talla_rango` —siete columnas que el frontend sí consume— y con un `CHECK` de categoría que
no incluía `Dijes`, que sí está en `CATEGORIAS` de `Catalog.jsx`. La base real sí lo
incluye; era el archivo el que mentía.

**Borrado el 23 de agosto**, como preveía el #4. Lo reemplaza
`20260228_esquema_base.sql`, que sale del catálogo y no de la memoria de nadie. Queda en el
historial de git por si alguien lo echa de menos.

---

### 25. ✅ Las RPC estaban abiertas a la llave pública — resuelto

**Encontrado el 23 de agosto**, mientras se versionaba el esquema del #4. Es el mismo
fallo que el de las conversaciones abiertas a `anon`, por un lado que nadie había mirado:
**las funciones**.

Catorce eran `SECURITY DEFINER` —se saltan RLS por diseño— y `anon` podía ejecutarlas. La
llave anónima viaja dentro del bundle público, así que le bastaba a cualquiera con abrir
el sitio.

**No era teórico. Comprobado contra el endpoint real, con la anon key:**

| Función | Devolvió |
|---|---|
| `revenue_por_fuente` | los ingresos del negocio, por canal |
| `top_ciudades_envio` | los ingresos por ciudad |
| `buscar_conversaciones` | teléfono y contenido de mensajes con clientas |

Y `crear_orden_whatsapp`, `SECURITY DEFINER`, creaba pedidos saltándose RLS a petición de
cualquiera.

**Arreglado en `20260823_las_rpc_estaban_abiertas.sql`.** Se borraron cuatro funciones de
la era n8n que no llama nadie, y a las de analítica y las de trigger se les quitó el
permiso a `anon` y a `PUBLIC`. Verificado después: las tres de arriba responden **401
permission denied** y `crear_orden_whatsapp` ya no existe.

**`pedido_publico` sigue abierta a propósito** —la pantalla de confirmación la necesita sin
sesión— y por eso devuelve cinco columnas contadas a mano. Responde 200, como debe.

Un aviso para quien mire esto después: **`cancel_duplicate_pending_orders` parecía muerta y
no lo estaba.** No aparece en `src/`, `supabase/functions/` ni `api/`, pero **la usa un
trigger** sobre `orders`. Grepear el repositorio no basta para dar una función por muerta;
hay que preguntarle también a `pg_trigger`. Lo cazó Postgres al negarse a borrarla.

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

### 12. ✅ El seed de Valentina decía "SIN CONFIRMAR" — resuelto

`20260818_taller_conocimiento.sql` sembró los seis temas marcados *"SIN CONFIRMAR"*, y
Valentina lee esa tabla en caliente. Los claims se verificaron con el joyero el 20 de
agosto y la base se corrigió a mano, pero el seed se quedó atrás: **un entorno nuevo nacía
mintiendo** — con una Valentina diciéndole a la clienta que no tiene confirmado si el
estuche va incluido, cuando va, y hace meses.

**Hecho el 23 de agosto.** `20260823_conocimiento_al_dia.sql` deja el conocimiento
exactamente como está en producción, **volcado desde la base y no transcrito**: se generó
con `quote_literal` desde Postgres y se verificó comparando el `md5` de cada uno de los
siete temas contra la base. Los siete coinciden.

Es idempotente (`on conflict (tema) do update`), así que corre sobre la base que ya existe
sin romper nada, e incluye los dos temas del 23 de agosto —devoluciones y la garantía
completa—, con lo que absorbe a `20260823_conocimiento_devoluciones.sql`. Esa se queda
donde está: una migración aplicada no se reescribe.

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

### 15. ✅ El titular de la portada salía en negrita sintética — resuelto

Un bloque `HERO SECTION` del diseño anterior, en `src/index.css:7913` y **fuera de toda
media query**, pisaba a `.hero-h1` con `font-weight: 800`. Marcellus sólo tiene el peso
400, así que el navegador engordaba los trazos por su cuenta: el titular de la portada
—que además es el elemento LCP— salía emborronado, contra lo que dice `DESIGN.md`.

**Hecho el 23 de agosto**, y no borrando el bloque de un tajo como se había propuesto,
porque no se podía: **`.hero-content-grid` tenía ahí su única definición de escritorio**.
Borrarlo tal cual habría dejado la portada sin rejilla. Así que la rejilla se mudó al
bloque bueno, se conservó el apilado de los botones en el celular —que sí es del diseño de
ahora— y se fue todo lo demás, incluidas `.hero-right-col` y `.hero-social-proof`, que no
existen en ningún JSX.

Un efecto colateral que hubo que devolver: al irse el bloque, el hero pasaba a heredar los
`7rem` de la regla de 968px y ganaba 32px de vacío arriba **en el primer pantallazo del
teléfono**, que es el que decide. Se conservó el `5rem 0 3rem` que la página venía
mostrando: cambiar el ritmo vertical del móvil es otra decisión y no era la de este
arreglo.

Verificado en el navegador, antes y después: `font-weight` de 800 a 400, `font-size` de
80px a 67,6px (el `clamp` de siempre), y a 390px reales —con iframe— peso 400, botones
apilados y sin desbordes. `css:pisadas` pasó de 84 bloques a 82 y `.hero-h1` ya no sale en
la lista.

### 16. ✅ `src/index.css` era un solo archivo de 17.850 líneas — resuelto

Ahora son dos: **`index.css` con 6.981 líneas** (la tienda y lo compartido) y
**`panel.css` con 7.922** (el panel), y por el camino se fueron 2.910 líneas muertas.

**Lo que gana la clienta.** El CSS que descarga quien abre la portada pasó de **50,3 kB a
19,2 kB comprimidos**. Menos de la mitad. Dos pasos:

| | CSS público (gzip) |
|---|---|
| Antes | 50,3 kB |
| Tras podar 340 clases muertas | 42,7 kB |
| Tras separar el panel | **19,2 kB** |

**Paso 1 — fuera 340 clases que no usa nadie.** Se cruzaron las 1.622 clases del CSS contra
los 83 archivos del repositorio que pueden emitir HTML. 502 reglas y 2.910 líneas menos.

> ⚠️ **La trampa:** 46 clases parecían muertas y se construyen al vuelo —
> `chat-bubble--${msg.role}` genera `chat-bubble--user`, que no está escrita en ninguna
> parte—. Borrarlas habría dejado los mensajes del chat sin estilo. El script descarta
> toda clase cuyo prefijo aparezca pegado a una interpolación.

**Paso 2 — el panel a su propio archivo**, importado por `Dashboard.jsx` y `ChatPanel.jsx`,
que ya van en trozos aparte. La tienda no lo pide nunca.

> ⚠️ **Y la trampa gorda, que costó dos intentos:** decidir qué es "del panel" **por el
> nombre de la clase no funciona**. Con una lista de prefijos, `.joyero` —que es la ficha
> de producto— se fue al panel y la ficha se rompió: la sección creció de 1.263 a 7.349 px
> y perdió su relleno. Se midió y se revirtió. El criterio bueno sale de cruzar cada clase
> contra **dónde se usa de verdad**: sólo se mueve la que aparece en `src/pages/admin/` y en
> ningún otro sitio. Diez reglas mixtas (`.chat-contact-item.active`, `.pm-riel-datos
> .punzon`) se quedan donde estaban a propósito.

**Cómo se verificó, que es la parte que importa.** Mover reglas cambia el orden de la
cascada, y ante igual especificidad ahora gana `panel.css`. Se capturaron **24 propiedades
calculadas de cada uno de 3.691 elementos, en once pantallas** —las ocho del panel más
portada, catálogo y ficha—, antes y después: **cero diferencias**.

Hizo falta un intento fallido para llegar ahí: la primera medición daba 486 diferencias
falsas porque las fuentes no habían terminado de cargar cuando se medía. El control
—medir dos veces el mismo CSS— lo destapó. La huella ahora espera a `document.fonts.ready`.

**Lo que queda de este hallazgo:** unificar las tres capas de la ficha (`.ficha-*`,
`.product-page-*` y una reescritura al final), y los 82 bloques que `css:pisadas` reporta
con declaraciones pisadas. Eso **no es CSS muerto**: son clases vivas cuyas declaraciones
anula otra regla posterior, y se atacan leyendo, no borrando.

### 17. ✅ `Dashboard.jsx` era un archivo de 4.398 líneas — resuelto

**390 líneas.** Las siete secciones viven en `src/pages/admin/secciones/`:

| Archivo | Líneas | |
|---|---|---|
| `Portada.jsx` | 771 | El dashboard: qué hay que atender hoy |
| `Ajustes.jsx` | 771 | Precios del taller y el conocimiento de Valentina |
| `Reportes.jsx` | 739 | Analítica, canales y retorno de pauta |
| `Pedidos.jsx` | 656 | Estado, despacho y conversión |
| `Productos.jsx` | 383 | El catálogo |
| `Anotaciones.jsx` | 246 | Las notas del equipo |
| `Clientes.jsx` | 237 | Las clientas y lo que compraron |
| `comunes.js` | 208 | Formato, metadatos de estado y canal, despacho |
| `piezas.jsx` | 209 | Insignias y modales que comparten varias |

En `Dashboard.jsx` queda lo que de verdad es del contenedor: qué sección se ve, de dónde
salen los datos, cuándo se recargan y el riel lateral.

**El reparto no se hizo a ojo.** Se calculó el **cierre transitivo** de dependencias: qué
símbolos usa cada sección, incluidos los que usa a través de otro ayudante. Mirar sólo el
cuerpo de cada sección dejaba fuera nueve símbolos —`CARRIERS` dentro de `ShipModal`,
`EMPTY_NOTE` dentro de `NoteModal`, `NEXT_ACTION_PREPAID` dentro de `getNextAction`…— y
habría producido seis archivos que no compilan. Regla: **lo que usan dos secciones o más
va a común; lo que usa una sola se va con ella.**

**Por qué son dos archivos comunes y no uno.** `comunes.js` lleva datos y funciones;
`piezas.jsx`, componentes. No es gusto: la regla `react-refresh/only-export-components`
—que sí corre en el build— prohíbe que un archivo exporte las dos cosas, porque entonces
el recargado en caliente deja de funcionar.

**Verificado por partida doble.** Que se vea igual no basta en un refactor de JavaScript:

- **Estilos:** 24 propiedades calculadas de cada uno de **2.573 elementos en las ocho
  pantallas**, antes y después. Cero diferencias.
- **Comportamiento:** se recorrieron las siete secciones desde el riel, se abrió el modal
  de pedido y se cerró. **Cero errores de ejecución**, y el pie del modal sigue nombrando
  lo que falta.

El trozo de JavaScript del panel pesa lo mismo que antes (162 kB), así que no se duplicó
nada por el camino.

**`ChatPanel.jsx` sigue entero**, con 2.115 líneas. Es una sola pantalla, no siete metidas
en una, así que no tiene la misma costura por donde partirlo.

### 18. ✅ `ProtectedRoute` no reaccionaba a que expirara la sesión — resuelto

`getSession()` una sola vez al montar: preguntaba al entrar y no volvía a preguntar. Si el
token caducaba —o si cerrabas sesión en otra pestaña— el panel seguía montado, enseñando
los datos que ya tenía y fallando en cada consulta nueva sin decir por qué. Sólo se salía
recargando a mano.

**Hecho el 23 de agosto.** `ProtectedRoute` se suscribe a `onAuthStateChange` y se
desuscribe en el `return` del efecto. Cubre las tres cosas: la sesión que caduca, la que se
cierra en otra pestaña y la renovación silenciosa del token, que es lo que pasa casi
siempre.

Y se quitaron los dos `navigate('/admin/login')` redundantes de `Dashboard` y `ChatPanel`:
esos efectos siguen ahí sólo para tener los datos del usuario en el sidebar. El portero es
uno solo.

### 19. ✅ El contador de mensajes sin leer no se veía en el Dashboard — resuelto

`ChatPanel` pasaba `chatUnread` a `AdminSidebar`; el `Dashboard` lo montaba **sin la
prop**, así que el globo sólo aparecía estando ya en el chat — justo donde no hace falta.

**Hecho el 23 de agosto**, aunque no como decía el arreglo propuesto. Sugería reusar los
chats sin responder que el Dashboard ya consulta, y **son otra pregunta**: un chat puede
estar leído y sin responder. Usarlos habría puesto dos números distintos bajo el mismo
globo según la pantalla — el bug que ya costó caro con el dinero. Así que el Dashboard
cuenta los no leídos **igual que el chat** (`is_read = false` y `role = 'user'`).

De paso quedó desmentido un comentario del propio `Dashboard.jsx`: dice que `is_read` «no
se mantiene», y sí se mantiene — `ChatPanel` lo marca al abrir la conversación. Lo que no
sirve es para saber si algo está *respondido*, que es otra cosa.

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

### 21. ✅ El acordeón del FAQ no era accesible — resuelto

El `onToggle` estaba en un `<div>`: se abría con el ratón y con nada más. Sin foco de
teclado, sin `aria-expanded`, y un lector de pantalla leía seis titulares sueltos sin
manera de saber que se despliegan ni cuál está abierto.

**Hecho el 23 de agosto.** La anidación es `h3 > button` y no al revés, que es lo que
proponía el arreglo: el contenido de un `<button>` sólo admite texto y elementos de línea,
así que un `<h3>` dentro es marcado inválido. Así el titular sigue siendo titular para
quien navega por encabezados, y lo que se pulsa es un botón de verdad, con `aria-expanded`
y `aria-controls`.

El panel cerrado sigue en el DOM —la transición de altura necesita de dónde animar—, así
que lleva `aria-hidden` cuando está cerrado: sin eso, un lector de pantalla lee las seis
respuestas de corrido.

Verificado con el teclado en el navegador: Tab recorre las seis preguntas, el foco se ve
—`outline` de 2px en `--oro`, que antes no existía porque no había nada que enfocar— y
`aria-expanded` cambia al pulsar.

### 22. ✅ Cosas pequeñas — resueltas

Dos se habían arreglado solas por el camino y no lo sabíamos: el `Wallet` de Mercado Pago
que se importaba sin usarse **ya no está**, y `.claude/settings.local.json` **ya no tiene**
las rutas de Windows del equipo anterior.

De las otras tres, el 23 de agosto:

- **`scripts/prerender.mjs` borrado.** 201 líneas que no invocaba ningún script de
  `package.json`; su trabajo lo asumió `api/ficha.js`. Queda en el historial de git.
- **`ResetPassword` alineado con `Login`.** Se había quedado con el diseño anterior
  —"PORTAL EXCLUSIVO", el isotipo como `<img>`— mientras la puerta de entrada ya estaba en
  la dirección nueva: el enlace del correo te dejaba en una tienda distinta. Ahora comparte
  columna, isotipo y tipografía con `Login`, sin las cifras, que ahí no pintan nada.
  De paso se fueron el `onAuthStateChange` con el cuerpo vacío y los props de Framer Motion
  sobre `div` planos. **Dato de paso:** las seis clases que usaba el marcado viejo
  (`admin-login-brand-name`, `-brand-line`, `-brand-tagline`, `-logo-wrap`,
  `-portal-label`, `-header`) **no tienen una sola regla en `index.css`**. Llevaban tiempo
  sin estilo ninguno.
- **El contador de oferta se queda reiniciándose solo**, decidido explícitamente. Lo que
  anuncia no es una promoción con fecha —no hay campaña ni stock reservado—, así que la
  alternativa honesta no era ponerle un fin de verdad sino quitarlo. Queda escrito en
  `ProductPage.jsx` para que no vuelva a parecer un descuido: si algún día hay una oferta
  real con fecha, el plazo tiene que salir de la pieza y no de `localStorage`.

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

### 24. ✅ `npm run build` no corría en esta máquina — resuelto

```
sh: node_modules/.bin/tsc: /bin/sh: bad interpreter: Operation not permitted
```

Nunca fue un problema del código: era la **cuarentena de macOS** sobre los shims de
`node_modules/.bin`, no los permisos del directorio. El diagnóstico quedó cerrado el 23 de
agosto con tres comprobaciones: `xattr` mostraba `com.apple.quarantine`, un script propio
con los mismos permisos sí corría, y fallaban todos los shims por igual mientras invocarlos
por Node funcionaba.

**Arreglado el 23 de agosto** con el comando que ya estaba propuesto:

```bash
xattr -dr com.apple.quarantine node_modules/.bin
```

`npm run lint` y `npm run build` corren. Ojo con una cosa: **vuelve a pasar cada vez que se
reinstalen las dependencias**, porque los archivos llegan marcados otra vez. Si algún día
`npm run build` falla con "bad interpreter", es esto, y el comando es el mismo.

Nunca tumbó ningún despliegue: Vercel construye en su propia máquina.

---

## Y una recomendación de fondo — hecha

El panel ya es más grande que la tienda y era **la única parte del sistema sin ninguna
guía de diseño**. `DESIGN.md:214-219` lo decía él mismo: *"cuando el panel tenga sus
propias reglas, tendrá su propio documento"*.

**Escrito el 23 de agosto: [`DESIGN-PANEL.md`](../DESIGN-PANEL.md).** No es una lista de
deseos: la escala tipográfica, los radios, el espaciado y la deuda salen de contar lo que
hay en `src/panel.css`. Lo que documenta:

- **Por qué el panel puede romper la regla del cuerpo de 1rem** y la landing no. Es la
  divergencia de fondo: la lectora de la tienda está en un celular con medio segundo de
  atención; quien usa el panel está en un portátil y vuelve doce veces al día a la misma
  tabla. Bajar el cuerpo a 0,82rem es lo que permite ver quince pedidos sin desplazarse,
  y ver quince pedidos de una vez **es** el trabajo.
- **La regla del punto de estado**, que no se inventó: ya estaba implementada en el
  código, ganándole a una versión con cinco colores de tipo Tailwind. Un pedido se
  distingue por la intensidad de un punto —arena, oro al 45%, oro, cacao, hueco—, así que
  se lee en escala de grises y por quien no distingue colores.
- **La única excepción al radio de 2px**, razonada: las burbujas del chat llevan 16px,
  porque una burbuja con esquinas rectas no se lee como una conversación.
- **La deuda, medida:** 491 colores escritos a pelo, `#D4AF37` 19 veces y `#B8860B` 12
  —dos oros que no son el de la marca—, 23 usos de negro `#1A1A1A`, `--accent-red` en 3
  sitios y 16 tamaños de letra distintos donde deberían bastar 6.

Y un hallazgo que ordena todo el trabajo que queda: **el panel ya llegó a la regla buena
dos veces y se dejó la mala debajo** —los cinco `.badge--color` y el degradado casi negro
de las burbujas están anulados por reglas posteriores que sí cumplen la marca—. Así que
lo que falta casi nunca es decidir qué debería ser: es borrar la versión vieja.

