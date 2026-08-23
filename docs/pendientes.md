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
>
> **#11 y #20 se retiraron el 23 de agosto de 2026 por decisión del dueño**, no por estar
> resueltos: las reseñas se quedan como están hasta que él decida cambiarlas, y las fotos
> se van a resubir todas de una vez. Los números no se reutilizan tampoco.

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

**El pago real de prueba se hizo el 23 de agosto**, con $20.000 de abono por
contraentrega. Los siete eslabones funcionaron: pedido creado, firma validada, consulta a
la API de Mercado Pago, abono registrado como abono, libro de caja, correo de confirmación
y conversiones a Meta y TikTok — más la plantilla de WhatsApp de pago recibido, que no
estaba en la lista.

> **Y destapó una cosa que se daba por buena y no lo era, resuelta el mismo día.** Un pago
> llegaba por dos caminos y uno se rechazaba con 401 en cada intento — nueve en ese pago.
>
> **El culpable no era el panel de Mercado Pago sino nuestro código.**
> `create-preference` ponía `notification_url` en la preferencia, y eso **no configura un
> webhook: configura una notificación IPN**, el mecanismo viejo. La documentación de MP
> dice que las IPN van a descontinuarse y que **a pesar de traer `x-Signature` no se pueden
> validar con la clave secreta** — así que desde que la firma está activa, cada una se
> rechaza por diseño.
>
> Comprobado en el panel antes de tocar nada: la sección **IPN está vacía** y la de
> **Webhooks** tiene nuestra URL con la entrega `payment.created · 200`. Se quitó el campo
> de la preferencia; queda un solo camino y está firmado. Ver
> [checkout-y-pagos](specs/checkout-y-pagos.md).

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

### 10. ✅ Hero y Reviews prometían platino y certificación incluida — resuelto

**El Hero, el 23 de agosto:** dejó de anunciar collares, pulseras y platino, y la garantía
dice "en el metal" en los dos sitios donde aparece, no sólo en uno.

**Reviews, el 23 de agosto.** El testimonio de `Reviews.jsx` daba por hecho que el
certificado viene con la pieza —*"La certificación de autenticidad me dio total
confianza"*—, cuando lo emite un laboratorio gemológico, es opcional y cuesta $50.000
aparte. Ahora lo dice como lo que es: *"Pedí **aparte** el certificado del laboratorio y
llegó con su código para verificarlo en línea"*.

De paso se corrigieron otros dos del mismo tipo, que se habían quedado atrás cuando el
Hero se arregló: hablaban de **un collar y unas pulseras**, y el catálogo sólo tiene
anillos y dijes —comprobado contra la base: 4 anillos y 1 dije—. Ahora cada testimonio se
apoya en algo que la tienda sí cumple: el punzón de la ley, el estuche —que va incluido en
todas—, la guía de seguimiento y el plazo real de 3 a 4 días en Bogotá.

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

### 16. ✅ `src/index.css` era un solo archivo de 17.850 líneas — resuelto del todo

De 17.850 líneas en un archivo a **6.842 + 7.549 en dos**. Y lo que descarga quien abre la
portada, de **50,3 a 18,7 kB comprimidos**: un tercio de lo que era.

| | CSS público (gzip) |
|---|---|
| Antes | 50,3 kB |
| Podar 340 clases muertas | 42,7 kB |
| Separar el panel a `panel.css` | 19,2 kB |
| Quitar las declaraciones anuladas | **18,7 kB** |

**Primero hubo que arreglar el diagnóstico.** `css-pisadas.mjs` apilaba el contexto cuando
una línea *empezaba* por `@media` y lo desapilaba cuando una línea era exactamente `}`.
Una media query de una sola línea —`@media (min-width: 769px) { .admin-layout { … } }`, y
las hay a docenas— se apilaba y **no se desapilaba nunca**: el contexto quedaba
contaminado para todo lo que viniera detrás, y dos reglas que viven en medias distintas
parecían estar en el mismo sitio. El informe se usa para decidir qué borrar, así que con
el contexto mal, borrar lo que dice **sí** cambia la página.

Reescrito para recorrer carácter a carácter, y de paso mira los dos archivos. La cifra
real no eran 82 bloques: eran **143**, con 20 inertes enteros donde el informe decía 0.

**Después, la poda: 339 declaraciones que no hacían nada.** Sólo se tocó lo que el informe
marca —mismo selector, mismo contexto, redefinida más abajo—, que por construcción es un
no-op. Con una salvedad que el informe no contempla y el podador sí: **si la de arriba
lleva `!important` y la de abajo no, gana la de arriba**; esas se dejan en paz. Quedaron
20 reglas vacías, que también se fueron. Las pisadas bajaron de 143 a **4**.

**Y una segunda tanda de 28 clases muertas** que la poda anterior había perdonado por un
fallo mío: la guarda contra clases construidas al vuelo comparaba por subcadena, y
`pd-ficha${…}` de `PedidoModal` contenía `ficha${`, así que salvó todas las `.ficha-*`
muertas. El error iba hacia el lado seguro —dejar CSS de más—, pero se corrigió con
frontera de palabra.

**Verificado, y la verificación se equivocó primero.** La primera comparación daba 363
diferencias en la portada. No eran de la poda: midiendo el CSS **viejo** en ese momento
salían las mismas 363 —el entorno de medición había cambiado entre una pasada y otra, con
valores sub-píxel delatores (`1351,88px` → `1352px`, un borde de `0,625px` → `1px`)—.
Rehecha la referencia en las mismas condiciones: **12 pantallas, 4.007 elementos, 26
propiedades cada uno, cero diferencias.**

### Lo de "las tres capas de la ficha": no había tres capas

El hallazgo original decía que convivían `.ficha-*`, `.product-page-*` y una reescritura
al final, y proponía unificarlas. Al mirarlo de cerca, después de quitar lo muerto, **no
son tres capas compitiendo por lo mismo**: son tres espacios de nombres con tres trabajos,
y los tres los usa el mismo archivo (`ProductPage.jsx`).

| Espacio | Clases en uso | Qué es |
|---|---|---|
| `.ficha-*` | 51 | El contenido de la ficha |
| `.pg-*` | 19 | La galería y el visor a pantalla completa |
| `.product-page-*` | 10 | **Sólo estados de borde**: esqueleto de carga, 404, marcador de posición, botón de volver |

Unificarlas sería renombrar clases en el JSX y en el CSS sin que nadie note nada. Y el
riesgo no es simétrico: `.product-page-skeleton-line` y `.product-page-notfound` sólo se
ven **un segundo al cargar o cuando algo falla**, que es justo donde una errata no la caza
nadie. Se quedan como están, y queda dicho por qué para que no vuelva a proponerse.

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

**`ChatPanel.jsx` se empezó a partir el mismo día** — ver
[#31](#31--chatpaneljsx-era-un-solo-componente-de-1926-líneas--empezado). No tiene la
costura de `Dashboard.jsx`, que eran siete pantallas metidas en una: aquí es **una sola
pantalla**, así que hay que ir por grupos de estado y comprobando cada paso.

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

~~**Lo que sigue faltando son los tests.**~~ — **hechos el 23 de agosto**, ver
[#28](#28--no-había-ni-una-prueba--resuelto-donde-importa).

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


**Cerrado el 23 de agosto, por la tarde.** Se borró la versión vieja y, de paso, el
sistema de estados dejó de ser un mapa de colores: las clases se llaman ahora por
intensidad —`badge--quieto`, `--tenue`, `--vivo`, `--pleno`, `--nulo`—, así que ya no se
puede volver a repartir mal. Estaba mal repartido: `pagado` llevaba el punto de «cerrado»
y `entregado` el de «empezando», porque el mapa se había hecho por nombre de color.

Buscando el resto aparecieron dos escondites que ninguna herramienta veía, porque
`css:pisadas` y el mapeo de colores sólo miraban los `.css`:

1. **`Dashboard.jsx` inyectaba 142 líneas de CSS en un `<style>`**, y por ir en el
   documento **le ganaba a `panel.css`**. De sus 25 clases, 14 estaban muertas; el resto
   eran pasteles de Tailwind. Por eso los distintivos de canal seguían pintándose azul,
   verde y rosa aunque `panel.css` dijera lo contrario desde agosto. Borrado entero.
2. **41 colores a mano en `style={{…}}`** dentro de las secciones, dos de ellos por debajo
   de AA (`#94a3b8` a 2,44:1 y `#999` a 2,85:1 sobre blanco).

Quedan tres hexadecimales en `src/panel.css`: el verde de WhatsApp sobre el icono de
WhatsApp, la definición de `--error-luz` y uno dentro de un comentario. `css:pisadas`
reporta **0 bloques** en el panel. Verificado en las ocho pantallas: cero contrastes por
debajo de AA y cero desbordes.

---

## 26. ✅ El horario del reloj sólo vivía en la base — resuelto

Dos cosas de este sistema pasan solas: el aviso de WhatsApp cuando un chat lleva rato
esperando (`plantillas-programadas`) y el vigía que comprueba cada media hora que todo
sigue en pie (`vigilancia`). Las dispara `pg_cron` **dentro** de la base.

Esa programación no estaba escrita en ninguna parte. Para saber a qué hora corría algo
había que entrar a la base y preguntar. Si el proyecto se perdía se perdía con él la
única copia del horario, y un entorno nuevo levantado desde este repositorio se quedaba
**mudo**: nadie avisaba de nada y nadie vigilaba nada, sin un solo error que lo delatara.

**Resuelto el 23 de agosto** con `20260823_el_reloj_de_la_base.sql`:

```
avisos-whatsapp   0 0,1,13-23 * * *   → 8:00 a 20:00 en Bogotá, cada hora en punto
vigilancia        30 * * * *          → cada hora en el minuto 30, a todas horas
```

Tres decisiones que vale la pena dejar escritas:

- **Los valores no están en la migración**, que se commitea. `url_funciones`, `clave_anon`
  y `cron_secreto` viven en `ajustes_internos`; el comando los lee **al ejecutarse**, así
  que el secreto se puede rotar sin volver a desplegar nada. Antes la llave pública iba
  pegada dentro del comando.
- **La migración se niega a aplicarse si falta alguno de los tres.** Sin eso, en un
  entorno nuevo quedarían dos trabajos programados fallando en silencio a las tres de la
  mañana, que es peor que no tenerlos.
- **No hay una función que envuelva la llamada**, aunque sería lo natural para no duplicar
  quince líneas. Sería otra `SECURITY DEFINER` en `public` — justo lo que se cerró esta
  misma mañana en [#25](#25--las-rpc-estaban-abiertas-a-la-llave-pública--resuelto) — y
  peor: cualquiera con la llave pública podría llamarla y disparar plantillas de WhatsApp
  de verdad a clientas de verdad. El texto del comando vive en `cron.job`, que PostgREST
  no expone.

Comprobado antes de tocar producción —la URL y la cabecera nuevas resuelven exactamente a
las viejas para los dos trabajos— y después: el vigía disparado con el comando nuevo
responde **200 `{"ok":true,"hallazgos":0}`**. Los dos trabajos siguen activos, con el
mismo `jobid` y el mismo horario, y ya ninguno lleva una llave pegada dentro.

---

## 27. ✅ Borrar una pieza dejaba sus fotos publicadas — resuelto

El diálogo de eliminar decía, literalmente: *«Se borran la ficha, las tres fotos y las
medidas»*. Borraba la fila y **dejaba los archivos en el bucket**, que es público. No era
sólo espacio desperdiciado: era una promesa de la interfaz que no se cumplía, y en una
tienda que vende joyas por foto, una foto que sigue viva en una URL pública después de
que le dijiste al panel que la borrara no es un descuido, es un problema.

Lo mismo al quitar una foto de una pieza que ya existe: desaparecía de la ficha y seguía
en el bucket.

**Resuelto el 23 de agosto** con `src/lib/fotosEnStorage.js`, enganchado en
`EliminarPieza.jsx` y en `ProductModal.jsx`. La parte que no es obvia: **una foto son
hasta cuatro archivos** y sólo uno está guardado en la base.

```
1755980000-abc-893x1600.webp   la que vive en products.images[]
1755980000-abc-893x1600.jpeg   la gemela para WhatsApp, que no acepta WebP
1755980000-abc-w400.webp       las copias chicas del srcset
1755980000-abc-w800.webp
```

Los otros tres **se deducen del nombre**, igual que `fotoProducto.js` deduce el `srcset`
para pintarlos. Borrar sólo el que está en la base dejaba tres huérfanos por foto. Ojo con
la marca `-893x1600`: la llevan la grande y la gemela, y no la llevan las copias chicas,
que cuelgan del nombre base pelado.

**La deducción se comprobó contra el bucket real antes de confiar en ella:** 15 fotos en
la base → 30 archivos deducidos → **los 30 existen**. Ni un falso positivo ni uno que se
escape. Los 38 que hay menos esos 30 son exactamente los 8 huérfanos que había.

Dos decisiones de orden, las dos por el mismo motivo —qué pasa si el paso falla a la
mitad—:

- **Las fotos se borran DESPUÉS de la fila**, no antes. Si el borrado de la fila falla
  —RLS, una clave foránea—, la pieza sigue viva y necesita sus fotos. Al revés quedaría
  una ficha sin imágenes.
- **Quitar una foto en el modal no borra nada hasta guardar.** Quien la quita y después
  cierra sin guardar espera encontrarla donde estaba; borrarla en el momento dejaría la
  ficha apuntando a un archivo que ya no existe.

Y si falla el borrado de los archivos no se avisa en pantalla: la pieza ya no existe, que
es lo que se pidió, y lo que queda es basura en un bucket. Queda dicho en consola.

**El tercer camino también quedó cerrado, esa misma tarde**: subir fotos en el modal y
cerrarlo sin guardar. Era el más escurridizo de los tres, porque los archivos ya estaban en
el bucket y no quedaba nada que los nombrara — ni una pieza, ni una fila.

Ahora el modal anota lo que subió **en esta sesión** y lo borra si se cierra sin guardar,
por las cuatro salidas: Escape, la ×, Cancelar y el clic fuera. Dos detalles que no son
obvios:

- **Una URL pegada a mano no se anota.** Si alguien copia ahí la dirección de una foto que
  ya usa otra pieza, anotarla haría que cancelar borrara una foto publicada. Sólo se limpia
  lo que subió este modal.
- **No se espera al borrado antes de cerrar.** La ventana se cierra al instante, como
  siempre, y la limpieza termina sola.

Comprobado de punta a punta en el navegador: se subió una foto en el modal —que produjo
sus cuatro archivos, `-900x1200.webp`, `-900x1200.jpeg`, `-w400` y `-w800`, y dejó el
bucket en 34—, se pulsó Cancelar, y el bucket volvió a 30 con **cero huérfanos** y las
cinco piezas intactas. El camino de guardar no puede borrar nada: `afterSave` desmonta el
modal directamente y no pasa por la limpieza — comprobado leyendo `Productos.jsx`, y no
creando una pieza de prueba, porque el catálogo es público y aparecería en la tienda
mientras durase.

Y la deducción de nombres, que es la que decide qué se borra, **quedó bajo prueba**: 15
casos en `src/lib/fotosEnStorage.test.js`. Son de otra clase que las del dinero, porque
aquí los dos fallos posibles no son simétricos —deducir de menos deja huérfanos, deducir de
más borra la foto de otra pieza y esa no vuelve—, así que la mayoría son casos de lo que
**no** debe tocarse. Rotas a propósito tres veces: pedir las copias chicas con la marca
pegada (3 fallos), olvidar la gemela `.jpeg` (4) y aceptar URLs de otro dominio (3).

Lo único que sigue dejando huérfanos es cerrar la pestaña del navegador a media subida, y
contra eso no hay nada que hacer desde el cliente. La consulta para encontrarlos está en
[`admin-catalogo.md`](specs/admin-catalogo.md).

**Y los 8 que ya había se limpiaron el mismo día**, después de mirarlos uno por uno. Los 8
archivos eran sólo 4 imágenes —tres estaban subidas dos y tres veces, mismo md5—, y de las
cuatro:

- **Tres eran renders de catálogo de OTRA joyería**, con su marca grabada en el aro y su
  código de referencia en la esquina. Del 28 de febrero, el día que se creó la base. No
  eran basura: eran fotos ajenas colgadas de un dominio de Aurem Gs y alcanzables por URL.
- **La cuarta era el original sin procesar de una foto que ya está publicada**: la tercera
  de «Anillo Trinidad». Se subieron con un milisegundo de diferencia (`…751997` la suelta,
  `…751998` las de la ficha), así que salieron de la misma tanda; el sistema se quedó con
  la versión reducida y el original crudo de 1,4 MB quedó suelto.

El bucket bajó de 38 archivos a 30, y **de 30 huérfanos posibles a cero**. El borrado se
hizo con la sesión del panel, contra la política `product_images_auth_delete`, no por
detrás con la llave de servicio: si el camino que usa la aplicación no sirviera para
borrar, había que saberlo.


---

## 28. ✅ No había ni una prueba — resuelto donde importa

Montar el andamiaje resultó ser media hora, no un proyecto: **Vitest lee la misma
`vite.config.ts`**, así que no hay una segunda configuración que mantener. Lo que sí
necesitaba pensarse era **por dónde empezar**, porque cubrir el repositorio entero sí es
otro proyecto.

Se empezó por las cuentas de plata, y el motivo es el que ordena todo lo demás: **es el
único sitio donde un error no se ve.** Un fallo de CSS se nota al abrir la pantalla y uno
de enrutado tumba la página. Una cuenta mal hecha enseña un número redondo, con signo de
pesos, perfectamente creíble — y ya pasó: el panel daba por cobrados $550.000 de un pedido
contraentrega que iba en camino, cuando lo único que había entrado eran los $20.000 del
abono. Con pauta encendida, eso es calcular el retorno contra ingresos imaginarios.

**43 pruebas** en `src/lib/dinero.test.js` y `src/lib/caja.test.js`, que corren en 170 ms:

- **La tabla de `recibidoDe` de la prueba ES la tabla de CLAUDE.md §8.** No son casos
  inventados: es la regla de negocio escrita de forma que la máquina la compruebe. Los
  seis estados por las dos formas de pago, más el error original escrito aparte, para que
  se lea como advertencia y no como una fila más de una lista.
- **De `caja.js` se prueban las tres decisiones que sólo se ven leyendo el código**: que
  un abono cuenta como Mercado Pago aunque el pedido sea contraentrega (son dos rieles
  dentro del mismo pedido), que la comisión se le descuenta sólo a lo que pasó por Mercado
  Pago —y no a Nequi ni al efectivo—, y que el día de un movimiento es el día en Bogotá
  y no en UTC.
- El cliente de Supabase se sustituye por uno de mentira. No por evitar la red: es que la
  prueba necesita un reverso, un pago por Nequi y un cobro de las diez de la noche, y la
  base de producción no tiene ninguna de las tres cosas.

**Y se comprobó que las pruebas sirven, que es el paso que casi nadie da.** Una batería
que pasa siempre no vale nada, así que se rompió el código a propósito tres veces:

| Lo que se rompió | Pruebas que lo cazaron |
|---|---|
| Un contraentrega `enviado` vuelve a contar entero (el error original) | **4** |
| El abono deja de contarse como Mercado Pago | **2** |
| El día se cuenta en UTC y no en Bogotá | **1** |

Las tres se cazaron. El código quedó restaurado y las 43 vuelven a pasar.

**Corren en el build**, después del lint y antes de todo lo demás, así que un despliegue
con las cuentas rotas no sale. Lo que queda sin cubrir es todo lo demás —componentes,
edge functions, el bot— y eso sigue siendo otro proyecto; pero ahora hay dónde escribir
la prueba siguiente en vez de dónde empezar.

---

## 29. ✅ Cualquiera podía registrarse y leerlo todo — resuelto

El hallazgo más grave de todos, y estuvo a la vista desde el principio: lo decía el propio
código, en `create-admin`.

> «en este proyecto todo usuario de Supabase Auth es administrador»

Era literal. **Las veinte políticas de las quince tablas del panel decían `to authenticated
using (true)`.** Y esa frase sólo es segura si nadie más puede conseguir una sesión.

**Podía. El registro público estaba abierto.** Comprobado el 23 de agosto sin crear ninguna
cuenta: una petición a `/auth/v1/signup` con un correo mal formado contestaba *«Unable to
validate email address»* —o sea, procesando altas— en lugar de `signup_disabled`. Con la
llave pública, que va dentro del bundle y cualquiera lee del navegador, el camino completo
era registrarse, confirmar en la propia bandeja y consultar PostgREST. Ni siquiera hacía
falta entrar al panel.

Lo que quedaba al alcance de cualquiera con un correo:

| Tabla | Qué podía hacer |
|---|---|
| `orders` | leer, modificar y **borrar** todos los pedidos |
| `whatsapp_conversaciones` | leer y **escribir** toda la correspondencia con las clientas |
| `customers`, `pagos` | los datos de contacto y el libro de caja entero |
| `taller_precios` | leer y cambiar el recargo, **que es el margen del negocio** |
| Storage | **borrar las fotos del catálogo entero** y las que mandan las clientas |

### Cómo se cerró

Dos cosas, y la segunda es la que importa a largo plazo:

1. **El registro, apagado** desde el panel de Supabase — con la bandera global, que cubre
   también cualquier proveedor externo que se encienda mañana.
2. **Las políticas dejaron de conformarse con «tiene sesión».** Ahora todas llaman a
   `public.es_del_equipo()`, que exige `app_metadata.rol` ∈ (`dueño`, `equipo`).
   `app_metadata` es el sitio correcto porque el usuario **no** puede escribirlo desde el
   navegador, a diferencia de `user_metadata`; y es el mismo mecanismo que `create-admin`
   ya usaba, así que no se inventó nada.

Quedan exactamente dos políticas sin exigir equipo, y las dos deben ser públicas: leer el
catálogo y ver las fotos de las piezas.

### El orden, que es la parte delicada

Un JWT lleva el `app_metadata` que existía cuando se emitió. Aplicar las políticas antes de
sellar los roles deja **a todo el mundo fuera del panel** hasta que renueve el token. Así
que: sellar los roles → comprobar en el navegador que la sesión abierta ya los lleva y que
`refreshSession()` funciona → y sólo entonces aplicar. Está escrito en la migración para
quien tenga que repetirlo.

### Comprobado en las dos direcciones

Simulando un JWT de cada clase contra la base:

| | Desconocido con sesión | El equipo |
|---|---|---|
| `orders` | **0** | 18 |
| `customers` | **0** | 5 |
| `whatsapp_conversaciones` | **0** | 2 |
| `pagos` | **0** | 2 |
| `taller_precios` | **0** | 1 |
| `products` | 5 | 5 |

Los 5 productos del desconocido son el catálogo, que es público a propósito.

Y después, con la sesión real en el navegador: las 15 tablas se leen, las **9 RPC
responden** —incluida `buscar_conversaciones`, que usa `unaccent` y era la que más podía
romperse al fijar el `search_path`—, se escribe en `taller_precios`, y se sube y se borra
un archivo de prueba en Storage. La tienda pública también: catálogo, `envio_publico` y
`pedido_publico` responden con la llave anónima, y `orders`, `customers`,
`whatsapp_conversaciones`, `pagos` y `taller_precios` le devuelven `[]`.

### De paso

- **`search_path` fijado en las 8 funciones `SECURITY DEFINER` que no lo tenían.** Sin él,
  los nombres se resuelven con el `search_path` de quien llama.
- **Un susto por el camino, que vale la pena dejar escrito:** al cerrar el registro es muy
  fácil apagar «Enable email provider» en vez de «Allow new users to sign up». Están en la
  misma pantalla y el primero **apaga también la entrada**. No se nota enseguida, porque la
  sesión abierta se sigue renovando sola con el token de refresco: se nota el día que
  cierres sesión o entres desde otro aparato. Se detectó con una petición de entrada y una
  clave incorrecta a propósito: `email_provider_disabled` en vez de `invalid_credentials`.
- **«Prevent use of leaked passwords» es de plan Pro**, así que no está disponible. Lo que
  sí: subir la longitud mínima de contraseña, que estaba en 6.
- El aviso `ERROR` de Supabase sobre la vista `envio_publico` **es un falso positivo aquí**:
  se comprobó su definición y expone dos columnas, `abono_envio` y `tope_contraentrega`.
  Es exactamente para lo que existe.

---

## 30. ✅ Nada avisaba de que el candado se aflojara — resuelto

El hallazgo de [#29](#29--cualquiera-podía-registrarse-y-leerlo-todo--resuelto) no fue sólo
que la seguridad del panel estuviera mal: fue que **llevaba seis meses mal y no lo dijo
nadie.** Arreglarlo no cierra eso. Lo que faltaba era que la próxima vez se entere alguien
sin tener que preguntar.

El vigía ya corre cada hora y ya manda correo cuando algo se cae, así que el sitio estaba
hecho. Se le añadieron dos comprobaciones, y las dos son de una clase distinta al resto:
no miran que algo funcione, miran que **algo siga cerrado**.

**1. El candado de la base** — `public.politicas_flojas()`. Devuelve políticas del panel
que no exigen `es_del_equipo()`, tablas que se quedaron sin RLS y funciones
`SECURITY DEFINER` sin `search_path` fijo. Las dos únicas excepciones son deliberadas y
públicas: el catálogo y las fotos. Cualquier otra cosa es un hallazgo aunque sea legítima —
el vigía informa, no decide.

La función es `SECURITY DEFINER` y está **revocada de `public`, `anon` y `authenticated`**,
con `execute` sólo para `service_role`. Enumerar los agujeros de RLS es exactamente lo que
no se le enseña a nadie más, y hoy era el día de acordarse.

**2. La configuración de acceso** — lee `/auth/v1/settings`, que es público. Habría cazado
**los dos** problemas del mismo día: `disable_signup === false` (el registro abierto, que
era el agujero) y `external.email === false` (el susto de después: apagar el proveedor de
correo creyendo cerrar el registro apaga también la entrada, y no se nota hasta que alguien
cierra sesión).

### Comprobado

- `politicas_flojas()` devuelve **cero** con la base como está.
- Se aflojó a propósito la política de `vigilancia_ultima` a `using (true)`: la reportó
  —*«la política no exige es_del_equipo()»*— y volvió a cero al restaurarla.
- El vigía desplegado con el CLI y disparado a mano: **200, cero hallazgos**, sin errores en
  los logs. Cero hallazgos aquí significa que las dos comprobaciones corrieron bien, porque
  un fallo de cualquiera de las dos se reporta como hallazgo.

Lo único que queda sin probar de punta a punta es que un hallazgo real acabe en un correo,
porque comprobarlo manda una alerta de verdad al equipo.

---

## 31. 🟡 `ChatPanel.jsx` era un solo componente de 1.926 líneas — empezado

`Dashboard.jsx` se pudo partir en una tarde porque eran **siete pantallas metidas en un
archivo** y ya eran independientes. Este no se parece en nada: de sus 2.123 líneas, 1.926
eran **un único componente con 55 estados y 103 hooks**. No hay costura evidente, y no hay
ni una prueba que avise si se rompe algo — así que se va por pasos verificables, no de un
tirón.

Los 55 estados sí forman grupos, y esa es la costura real: selector de imágenes del
catálogo (7), ficha del contacto (5), buscador de mensajes (4), visor de fotos (2),
selección y archivado en lote (4), borrado de fotos y purga (6), avisos (1), y el núcleo
—sesión, contactos, mensajes, envío, tiempo real, control manual—.

**Hecho el 23 de agosto: 2.123 → 1.923 líneas.**

- `chat/comunes.js` — los 13 formatos y constantes. Cero riesgo: no dependen de nada.
  De paso se devolvieron a su sitio dos comentarios que llevaban ochenta líneas separados
  de lo que explicaban.
- `chat/piezas.jsx` — `PieDeFoto`, `ImagenDelChat` y `ChatErrorBoundary`, las tres únicas
  cosas del archivo que ya recibían lo suyo por props. Aparte de `comunes.js` porque
  `react-refresh/only-export-components` no deja mezclar componentes y constantes.
- `chat/BuscadorDeMensajes.jsx` — el primer **grupo de estado** que sale, con tres de los
  55 y uno de los efectos.

Lo del buscador es el patrón que conviene repetir, porque **quitó código en vez de
moverlo**. El panel tenía que limpiar la consulta y los resultados a mano en cada salida
—Escape, elegir un resultado, volver a pulsar la lupa— y cualquiera de las tres se podía
olvidar. Ahora se monta y se desmonta con `showMsgSearch`, así que el estado nace y muere
solo. Y al sacarlo, el lint señaló un `setState` síncrono dentro del efecto que llevaba ahí
desde siempre: en vez de silenciarlo, lo que se pinta pasó a **deducirse** del campo en
lugar de guardarse, que además quita un estado que podía quedar desfasado.

Comprobado en el navegador, no razonado: el buscador se abre con el foco puesto, «anillo»
devuelve 2 resultados, borrar el texto los quita, Escape cierra, al reabrir el campo viene
limpio, y elegir un resultado cierra y lleva a ese chat. Y el resto del panel sigue
entero: contactos, burbujas, separadores de día, acuses, iniciales, hora y estado del
pedido — que son justamente los helpers que se mudaron.

**Segundo tramo, el mismo día: 1.923 → 1.905 líneas.** Salieron el visor de fotos y los
avisos, a `chat/ganchos.js`. Son ganchos y no componentes porque lo que estorbaba no era la
pintura —nueve y diez líneas de JSX— sino el estado, los relojes y la limpieza, repartidos
por **cuatro sitios distintos** del componente grande.

Y aquí el refactor **encontró dos fallos latentes**, los dos del mismo tipo: relojes mal
llevados.

- **El visor no cancelaba nunca el reloj del cierre.** Se cierra en dos tiempos —primero la
  clase que desvanece, 300 ms después se quita la imagen—, y si abrías una foto durante esos
  300 ms, el reloj viejo llegaba puntual y **te cerraba la que acababas de abrir**. Al salir
  de la pantalla con el visor abierto, además, el temporizador seguía vivo.
- **Los avisos usaban `toast-${Date.now()}` como identificador.** Dos mensajes en el mismo
  milisegundo —dos clientas a la vez, o un mensaje troceado— compartían id: React repetía la
  clave y el reloj del primero **se llevaba los dos por delante**.

### Y ahora el chat se puede probar

Estas dos piezas **no se pueden verificar a mano**, y eso es lo que las hacía peligrosas:
para ver el visor hace falta una foto en un hilo, y para ver un aviso hace falta que entre
un mensaje de WhatsApp de verdad — forzarlo insertando una fila haría que el cron le mandara
una plantilla real a un número real.

Sacarlas del archivo grande las volvió comprobables, así que se montó el entorno para ello
(`@testing-library/react` + `jsdom`, pedido por archivo con `// @vitest-environment jsdom`
para no cargarlo en las pruebas puras). **12 pruebas nuevas, 70 en total**, y los dos fallos
de arriba quedan escritos como prueba para que no vuelvan.

Rotas a propósito tres veces, para comprobar que sirven: quitar el `clearTimeout` al abrir
(1 fallo), volver al identificador por milisegundo (3) y olvidarse de apagar los relojes al
salir (4).

Eso desbloquea lo que queda: cada grupo que salga de `ChatPanel.jsx` a partir de ahora se
puede probar en vez de sólo mirarse.

**Lo que queda**, por orden: la ficha del contacto (5 estados), la selección en lote (4), la
purga (6) y el selector de imágenes del catálogo (7). El núcleo —tiempo real, envío, control
manual— es lo último y lo que menos conviene tocar.

**Tercer tramo: 1.905 → 1.721 líneas.** Sale la ficha del contacto, el bloque más grande
que quedaba: **168 líneas de JSX y cuatro estados**, a `chat/FichaDelContacto.jsx` con sus
datos en `useFichaDelContacto`. En el panel grande sólo se queda `showContactInfo`, que es
un interruptor y lo tocan tres sitios distintos —el botón de la cabecera, Escape y el ancho
de pantalla—.

Recibe once props, y es a propósito: la alternativa era un contexto, y un contexto para un
solo consumidor esconde de dónde viene cada cosa sin ahorrar nada. Esa lista **es** la
documentación de qué necesita la ficha.

Otros dos hallazgos por el camino, del mismo tipo que los del tramo anterior —cosas que
nadie podía ver porque no se pueden provocar a mano—:

- **«Cancelar» en las notas dejaba el borrador en el campo.** Cerraba el editor pero no
  devolvía lo guardado, así que al volver a entrar veías el texto que habías descartado con
  toda la pinta de estar guardado; y si pulsabas Guardar, se guardaba. Ahora cancelar
  restaura.
- **La ficha no descartaba las respuestas que llegaran tarde.** Al cambiar de conversación,
  una consulta lenta de la anterior podía pintar sus datos encima de la que acabas de abrir.
  Nunca se vio con dos conversaciones de prueba; con veinte y una red lenta, se vería.

Comprobado en el navegador pantalla contra pantalla —avatar, nombre, «cliente desde»,
correo, ciudad, las cuatro cifras, las cinco etiquetas, los diez pedidos con miniatura y
estado— y el ciclo entero de las notas: escribir, cancelar, reabrir vacío, escribir,
guardar, verlo en la base, y dejarla como estaba. Lo que **no** se puede ver a mano —la
carrera y el cancelar— queda en `chat/ficha.test.js`, 6 pruebas más, **76 en total**.
Rotas a propósito: quitar la salvaguarda de carrera (1 fallo) y devolver el cancelar a como
estaba (1 fallo).

**Cuarto tramo: 1.721 → 1.623 líneas.** Sale el selector de imágenes del catálogo —el
diálogo para mandarle a una clienta la foto de una pieza— con cuatro estados más y el
envío. Es el mismo patrón del buscador: se monta y se desmonta con `showImagePicker`, así
que **desaparecen tres limpiezas a mano** que había que acordarse de hacer en Escape, en el
botón que lo abre y en el clic fuera.

El envío se movió **tal cual**, sin tocar una línea, y es lo único de todo el refactor que
no se ha podido comprobar: pulsar «Enviar» manda una foto de verdad a una clienta de verdad
por WhatsApp, y eso no tiene deshacer. Sí se comprobó todo lo demás: abre en la rejilla con
las cinco piezas, buscar «trinidad» deja una, una búsqueda sin resultados da el mensaje
vacío, elegir una pieza pasa al segundo paso con el pie propuesto —«Anillo Majestuosa -
$500.000»—, «Volver» regresa, y Escape, el botón y el clic fuera lo cierran. Al reabrirlo
vuelve limpio al primer paso.

**Y la selección en lote no se saca**: no es un bloque, está entretejida con cada fila de la
lista de contactos. Sacarla sola dejaría el código peor que como está; lo suyo es que salga
el día que salga la lista entera.

**En total, en el día: 2.123 → 1.623 líneas, un 24 % menos**, siete archivos nuevos y cuatro
fallos latentes encontrados. Queda la purga (6 estados) y la lista de contactos con su
selección en lote (4).
