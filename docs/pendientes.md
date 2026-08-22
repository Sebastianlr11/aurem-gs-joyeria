# Pendientes

Hallazgos encontrados al documentar el proyecto el **22 de agosto de 2026**.
Cada uno lleva dónde está, por qué importa y el arreglo propuesto.

> **Nada de este documento está aplicado.** Son propuestas para revisar y ejecutar en
> ramas aparte.

**Índice**
- [🔴 Crítico — seguridad](#-crítico--seguridad)
- [🟠 Alto — gobernanza](#-alto--gobernanza)
- [🟡 Medio — lo que le prometemos al cliente](#-medio--lo-que-le-prometemos-al-cliente)
- [🔵 Deuda técnica](#-deuda-técnica)

---

## 🔴 Crítico — seguridad

### 1. Cualquiera puede leer todos los pedidos

**Dónde:** `supabase/migrations/20260311_orders_rls.sql:24-28`

```sql
CREATE POLICY "orders_anon_read_own"
  ON public.orders
  FOR SELECT
  TO anon
  USING (true);   -- ← sin filtro
```

**Por qué importa.** El comentario de encima dice *"customer can only see order if they
know the ID"*, pero la política no impone nada de eso: `USING (true)` autoriza **toda la
tabla**. Y la anon key va dentro del bundle público del sitio, así que no hace falta
credencial alguna. Con una sola petición se obtienen nombre, teléfono, correo, dirección
de entrega e importe de todos los pedidos.

Hoy el daño es acotado porque los ~17 pedidos son pruebas del equipo. **Deja de serlo con
el primer cliente real**, y en Colombia esto es tratamiento indebido de datos personales
bajo la Ley 1581.

**Por qué está así.** `/confirmacion` necesita leer un pedido con la anon key para mostrar
el resumen tras volver de Mercado Pago. La política se escribió para habilitar ese caso;
lo que falta es acotarla.

> **Ya hay precedente.** El 22 de agosto, el commit `b427f66`
> (`20260822_cerrar_conversaciones_a_anon.sql`) cerró **exactamente este mismo patrón** en
> las cinco tablas de conversaciones, que estaban con `[public ALL] using=true`. Ese
> trabajo dejó `orders` sin tocar: es la última tabla con datos personales todavía abierta
> a la llave pública.

**Arreglo propuesto.** RLS no puede expresar "sólo si conoces el id" — si puedes
seleccionar por id, puedes seleccionar todo. La forma correcta es quitarle a `anon` el
acceso a la tabla y darle una función que devuelva **sólo los campos que la pantalla
necesita**, de un solo pedido:

```sql
-- 1. Quitar el acceso abierto
DROP POLICY IF EXISTS "orders_anon_read_own" ON public.orders;

-- 2. Dar exactamente lo que /confirmacion necesita, y nada más.
--    Sin datos personales: ni nombre, ni teléfono, ni correo, ni dirección.
CREATE OR REPLACE FUNCTION public.pedido_publico(p_id uuid)
RETURNS TABLE (
  amount          numeric,
  abono_monto     numeric,
  payment_method  text,
  product_id      uuid,
  product_name    text,
  status          text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.amount, o.abono_monto, o.payment_method,
         o.product_id, o.product_name, o.status
  FROM public.orders o
  WHERE o.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.pedido_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedido_publico(uuid) TO anon, authenticated;
```

Y en `src/pages/Confirmacion.jsx:38-43`, cambiar el `.from('orders').select(...)` por
`supabase.rpc('pedido_publico', { p_id: externalRef })`.

El id del pedido es un uuid v4: no se adivina, y quien vuelve de Mercado Pago lo trae en
la URL. La `INSERT` pública para `anon` se queda como está — el checkout la necesita.

**Verificación después de aplicar:**

```bash
curl "$VITE_SUPABASE_URL/rest/v1/orders?select=customer_name,customer_phone" \
     -H "apikey: $VITE_SUPABASE_ANON_KEY"
# debe devolver []
```

---

### 2. Cualquier usuario autenticado puede crear y borrar administradores

**Dónde:** `supabase/functions/create-admin/index.ts:30-42`

La función comprueba que **hay** un usuario autenticado, pero no comprueba **quién es**.
Después usa `SUPABASE_SERVICE_ROLE_KEY` para listar, crear y eliminar usuarios.

**Por qué importa.** No existe el concepto de rol en el proyecto: todo usuario de Supabase
Auth es administrador con plenos poderes. Cualquiera con una sesión válida puede darse de
alta a sí mismo otra cuenta, o **borrar al dueño**. Combinado con el hallazgo #1, un
correo filtrado basta para escalar.

**Arreglo propuesto.** Marcar al dueño en `app_metadata` (que el usuario **no** puede
modificar desde el cliente, a diferencia de `user_metadata`) y exigirlo:

```ts
// Justo después de resolver `caller`:
const rol = (caller.app_metadata as Record<string, unknown> | null)?.rol
if (rol !== 'dueño') {
  return new Response(JSON.stringify({ error: 'No autorizado' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

Y sellar la cuenta del dueño una sola vez, desde el SQL editor:

```sql
UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"rol":"dueño"}'::jsonb
 WHERE email = '<correo del dueño>';
```

Ojo con el orden: **primero** sellar al dueño, **después** desplegar la función. Al revés
te quedas sin poder administrar a nadie.

---

## 🟠 Alto — gobernanza

### 3. `mp-webhook` no valida la firma de Mercado Pago

**Dónde:** `supabase/functions/mp-webhook/index.ts` — no hay `x-signature` ni
`MP_WEBHOOK_SECRET` en ninguna parte del repositorio.

**Cuál es el riesgo real, con precisión.** La función **no se cree lo que le mandan**:
toma el id del aviso y consulta el pago contra la API de Mercado Pago con
`MP_ACCESS_TOKEN` antes de tocar nada. Eso significa que **no se puede falsificar un pago
aprobado** invocando el endpoint — que sería lo grave.

Lo que sí queda abierto: cualquiera puede invocar el endpoint con ids arbitrarios y
provocar consultas a la API de MP (posible agotamiento de cuota) y reprocesos. El candado
`conversion_enviada_en` evita que se dupliquen conversiones y correos, así que el daño es
ruido y consumo, no dinero ni datos.

**Arreglo propuesto.** Validar el `x-signature` que ya manda Mercado Pago, siguiendo su
esquema `ts` + `v1` (HMAC SHA-256 sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`)
con un `MP_WEBHOOK_SECRET` nuevo. Importante: **fallar cerrado sólo si el secreto está
configurado**, para no tumbar los pagos el día del despliegue —el mismo patrón que ya usa
`wa-webhook` con `WA_APP_SECRET`.

---

### 4. El repositorio no puede reconstruir su propia base de datos

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
tres respaldos manuales (`respaldo_*_20260822`) con 104 filas de conversaciones reales que
estaban con RLS apagado. Un volcado del esquema las habría hecho visibles antes.

**Arreglo propuesto:**

```bash
npx supabase link --project-ref <ref>
npx supabase db pull --schema public   # vuelca el esquema real a una migración
```

Revisar el resultado a mano (el volcado trae ruido), commitearlo como
`20260822_esquema_existente.sql`, y a partir de ahí **prohibir cambios de esquema desde el
dashboard**. Aprovechar el mismo paso para volcar las 8 RPC.

---

### 5. Migraciones de la rama actual sin commitear

`20260822_chats_sin_responder.sql` y `20260822_cerrar_conversaciones_a_anon.sql` **ya están
commiteadas** (`2d140cc` y `b427f66`). Siguen sin commitear, en la rama
`fix/dashboard-decia-lo-que-no-sabia`:

- `20260822_borrar_chat_media.sql` — política DELETE en `chat-media`
- `20260822_conversaciones_purgables.sql` — función de retención

**Por qué importa.** Si la política de `chat-media` no está aplicada, `EliminarChat` falla
en el paso de fotos y —por diseño, para no dejar archivos huérfanos— **no borra nada**.

**Arreglo:** confirmar en Supabase antes de dar la rama por terminada.

```sql
SELECT * FROM public.chats_sin_responder() LIMIT 1;
SELECT * FROM public.conversaciones_purgables(12) LIMIT 1;
SELECT policyname FROM pg_policies
 WHERE tablename = 'objects' AND schemaname = 'storage';
```

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

### 8. La política de devoluciones se contradice con el FAQ

- `src/components/Faq.jsx:21` — *"Tienes **30 días** desde la recepción, con la pieza en su
  estado y embalaje original."*
- `src/pages/ReturnsPolicy.jsx:21` — *"derecho a retractarte […] dentro de los **5 días
  hábiles** siguientes a la recepción"*, y `:36` — *"Han transcurrido más de 5 días hábiles"*
  como causal de rechazo.

Dos pantallas del mismo sitio prometen plazos distintos por escrito, y el FAQ es el más
generoso. **Probablemente el FAQ confunde dos cosas distintas** que la política sí separa:
el **retracto** (5 días hábiles, Ley 1480) y la **garantía contra defectos de fabricación**
(`ReturnsPolicy.jsx:60`, 30 días). No son lo mismo: una permite devolver sin justificación,
la otra cubre que la pieza salga defectuosa.

**Decidir cuál es el real** —5 días hábiles es el mínimo legal; 30 días para devolver sin
causa sería una promesa comercial voluntaria y vinculante— y redactar el FAQ distinguiendo
retracto de garantía.

**Además:** la política está fechada en **febrero de 2025** mientras privacidad y términos
dicen **agosto de 2026**. Y hay un tercer plazo en circulación: la migración
`20260822_conversaciones_purgables.sql` afirma que **la garantía del metal es de por vida**,
lo que no aparece en ninguna de las dos pantallas. Conviene alinear los tres.

### 9. El JSON-LD de la portada promete lo que el sitio ya retiró

**Dónde:** `src/pages/Home.jsx:11-21`

Inyecta un `JewelryStore` que anuncia **platino**, **collares, pulseras y aretes** y
**certificación de autenticidad** — las cuatro promesas que el resto del sitio ya corrigió
(`index.html:31-40` documenta haberlas quitado; `TrustBar.jsx:41-45` y `WhyUs.jsx:38` ya
dicen que el certificado cuesta $50.000 aparte).

Es lo que Google lee. Además usa URLs **sin `www`**, incoherentes con la canónica.

**Arreglo:** alinear el JSON-LD con lo que realmente se vende y poner `www`.

### 10. Hero y Reviews siguen prometiendo platino y certificación incluida

`src/components/Hero.jsx:56-57` y `src/components/Reviews.jsx:18`. Mismo problema que #9,
en texto visible.

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

### 12. Verificar que Valentina no siga diciendo "SIN CONFIRMAR"

`supabase/migrations/20260818_taller_conocimiento.sql:27-29` sembró las 6 filas marcadas
*"SIN CONFIRMAR"*, y Valentina lee esa tabla en caliente para componer su prompt.

Los claims de envío, estuche, certificado y garantía **ya se verificaron con el joyero**,
así que lo más probable es que la base esté actualizada y sólo el seed haya quedado
atrás. **Confirmarlo** (`SELECT * FROM taller_conocimiento;`) y, si es así, actualizar el
seed para que un entorno nuevo no nazca mintiendo.

### 13. No hay ruta 404

`src/App.jsx` no define `path="*"`. Cualquier URL inválida cae en el rewrite de
`vercel.json` y renderiza **una página en blanco** con el botón de WhatsApp flotando.

**Arreglo:** una `<Route path="*">` con Navbar + Footer, mensaje corto y salidas al
catálogo y a WhatsApp. Reutilizar el patrón de estado vacío de `Catalog.jsx:185-242`.

### 14. Las páginas legales no ponen sus meta tags

Ninguna de las cuatro llama a `ponerMeta`, así que heredan título, descripción y
**canónica de la portada** — aunque las cuatro están en el sitemap. Cuatro URLs
declarándose como si fueran la home.

**Arreglo:** una llamada a `ponerMeta` en cada una, con el `return` de limpieza que la
función ya devuelve (`src/lib/meta.js:57-84`).

---

## 🔵 Deuda técnica

### 15. El titular de la portada sale en negrita sintética

**Dónde:** `src/index.css:7912-7950`

Hay un bloque `HERO SECTION` duplicado **fuera de toda media query** que pisa al original
de la línea 375. `.hero-h1` pierde sus cuatro declaraciones, incluido
`font-weight: 400 → 800`. Marcellus **sólo tiene peso 400** (`src/fuentes.css`), así que
el navegador engorda los trazos por su cuenta: el titular de la portada se ve emborronado
y contradice `DESIGN.md`.

El bloque además define `.hero-right-col` y `.hero-social-proof`, que no existen en
`Hero.jsx` — es un resto del diseño anterior.

**Arreglo:** borrar el bloque duplicado y confirmar con `npm run css:pisadas`.

### 16. `src/index.css` son 17.562 líneas

84 bloques con declaraciones muertas. Tres capas conviviendo sólo para la ficha de
producto (`.ficha-*`, `.product-page-*` y una tercera reescritura al final). CSS muerto
confirmado: `.admin-table` (12 referencias en CSS, 0 en JSX), `.dash-table` (11/0),
`.ficha-tecnica-lista` (5/0), `.product-page-grid`, `.product-page-btn`.

Reparto: ~8.300 líneas de tienda pública, ~9.250 de panel.

**Arreglo propuesto, por orden de riesgo:** primero borrar lo que `css:pisadas` marca como
muerto y no aparece en ningún JSX (riesgo cero, ganancia inmediata); después separar en
`index.css` + `admin.css`; y sólo entonces plantear unificar las tres capas de la ficha.
No hacerlo todo de una vez.

### 17. `Dashboard.jsx` son 3.989 líneas

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

### 20. Las fotos de producto no están optimizadas en la entrega

`src/components/catalog/ProductCard.jsx:51` y la galería de `ProductPage.jsx:771` usan
`<img src={product.image_url}>` crudo: **sin `srcset` y sin `width`/`height`**. La tarjeta
del catálogo sí lleva `loading="lazy"`; la galería de la ficha no. El trabajo de `Foto.jsx`
sólo cubre las imágenes estáticas del sitio.

Consecuencia: reflow al cargar el catálogo y se descarga la imagen de 1600px en un móvil.

**Arreglo:** usar el transformador de imágenes de Supabase Storage (`?width=`) para generar
un `srcset`, y fijar `width`/`height` para reservar el espacio.

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

### 23. Nada impide que entre código roto

No hay tests, y `npm run lint` no forma parte del build. **Arreglo mínimo:** añadir el
lint al build o a un hook de pre-commit.

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

**Arreglo a probar, en orden:**

```bash
xattr -d com.apple.quarantine node_modules/.bin/tsc   # si tiene el atributo
rm -rf node_modules package-lock.json && npm install  # lo más probable que lo resuelva
```

Mientras tanto el proyecto **sí compila**; sólo hay que invocar `tsc` por Node. Vale la
pena resolverlo antes de que tumbe un despliegue.

---

## Y una recomendación de fondo

El panel ya es más grande que la tienda (~9.250 líneas de CSS frente a ~8.300) y es la
única parte del sistema **sin ninguna guía de diseño**. `DESIGN.md:214-219` lo dice él
mismo: *"cuando el panel tenga sus propias reglas, tendrá su propio documento"*.

Ese documento —`DESIGN-PANEL.md`— es probablemente el trabajo que más rinde después de
cerrar los hallazgos críticos.
