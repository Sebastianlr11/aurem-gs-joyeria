# Diseño y frontend

> **Estado:** en producción · la deuda de CSS, de 143 bloques pisados a 4
> **Última revisión:** 2026-08-24

## Qué resuelve

Cómo se ve el proyecto y de dónde salen esas decisiones. Y **cuál es la fuente de verdad**,
que es la pregunta que más se responde mal.

## La cadena de autoridad

```
DESIGN.md  (raíz, 595 líneas)          ← FUENTE DE VERDAD
    ↓ versión operativa, para construir
.claude/skills/designing-aurem-gs/     ← no versionada (pendientes #6)
    ↓ implementación
src/index.css  (6.842) + src/panel.css (7.549)         ← los tokens coinciden con DESIGN.md
```

**`DESIGN.md` manda sobre cualquier color que aparezca en cualquier otro documento**,
`CLAUDE.md` incluido.

### Alcance, y el hueco que deja

`DESIGN.md:214-219` es explícito: **gobierna la landing**. El catálogo, la ficha y `/admin`
*reutilizan los tokens* pero *descartan las reglas de conversión*. Y dice literalmente:
*"cuando el panel tenga sus propias reglas, tendrá su propio documento"*.

> **Ese documento no existe.** El panel es hoy la mitad del código y **no tiene guía de
> diseño**. Es el hueco documental más grande del proyecto.

## La dirección: "Luz de vitrina"

Base marfil, tinta cacao, **un solo oro**, Marcellus + Mulish, escala de 8 px, radio de 2 px.

| Token | Valor |
|---|---|
| `--bg-marfil` | `#FBF7F2` |
| `--bg-arena` | `#F2EAE0` |
| `--ink` / `--text-primary` | `#1C1714` |
| `--text-secondary` | `#6B615A` |
| `--text-muted` | `#766D66` |
| `--oro` / `--accent-gold` | `#A8863F` |
| `--oro-ink` | `#7A5F26` |
| `--hairline` | `#E6DED3` |

`--text-muted` está documentado en el propio CSS (`index.css:20-26`): se aclaró desde
`#9C938B`, que daba **2,83:1** sobre marfil y se usa en 45 sitios, así que **cualquier texto
con ese token fallaba el mínimo AA de 4,5:1**. Ahora da 4,74:1. La jerarquía se conserva,
más comprimida — *"es lo que cuesta cumplir"*.

**`--accent-red: #ea4335` sigue definido pero está marcado como legado** de catálogo/admin.
`DESIGN.md` lo prohíbe como acento de marca. Para errores, los tonos de la marca:
`#8C2F1E`, `#5E2114`, `#FBEDE9`.

## Tipografía

`src/fuentes.css` (58 líneas) hace **una sola cosa**: cuatro `@font-face` autoalojados —
**Marcellus** (400) y **Mulish** (variable 300–800), en subconjuntos `latin` y `latin-ext`,
con `font-display: swap` y `unicode-range` explícito.

**Por qué se autoalojan** (documentado en `fuentes.css:1-23`, con medición): pasar de
`@import` a `<link>` bajó el bloqueo pero **empeoró el LCP de 3,9 s a 5,7 s**. El motivo es
que **el elemento LCP es el logo del navbar, que es texto en Marcellus** servido desde otro
dominio: DNS + TLS + hoja + archivo, en cadena. El self-hosting elimina esa cadena. Los
otros cinco subconjuntos de Google (cirílico, griego, vietnamita) se descartaron a propósito.

> **No importes nada de `fonts.googleapis.com`.** La skill de diseño todavía lo dice y **está
> desactualizada en ese punto** — [pendientes #6](../pendientes.md).

**Marcellus sólo tiene peso 400.** Cualquier `font-weight` mayor produce negrita sintética.

## Animaciones — `src/lib/aparecer.js`

Reemplazo explícito de framer-motion (~41 KB, `:38-42`). Expone `useAparecer(direccion)` y
`useAparecerGrupo(paso)`.

Tres decisiones que importan:

1. **El estado oculto lo pone el hook en `useLayoutEffect`, no el JSX** (`:44-47`). Si el JS
   no corre, el contenido queda **visible** en vez de invisible para siempre.
2. **`noAnimar()` cubre tres casos** (`:17-20`): sin `IntersectionObserver`,
   `prefers-reduced-motion`, y **`document.visibilityState === 'hidden'`** — Chrome no
   dispara el observer en pestañas ocultas, así que un clic con el botón central abría una
   página en blanco.
3. **El escalonado usa `--i` y `--paso` por hijo** (`:80-84`), no `nth-child`.

`prefers-reduced-motion` aparece en **13 media queries** distintas del CSS.

## Imágenes

Dos mecanismos, para dos problemas:

| Mecanismo | Para | Dónde |
|---|---|---|
| `src/components/Foto.jsx` | Fotos **estáticas** del sitio: `<picture>` + WebP + fallback JPG | Hero, Collections, TiltedCarousel |
| `src/lib/optimizarFoto.js` | Fotos de **producto**, al **subirlas** desde el panel | ProductModal |
| `src/lib/fotoProducto.js` | Fotos de **producto**, al **entregarlas**: arma el `srcset` | ProductCard, ProductPage |

> **Las fotos de producto no pasan por `Foto.jsx`**, que sirve archivos estáticos de
> `/assets`. Tienen su propia pareja: `optimizarFoto.js` genera los tamaños al subir
> —400, 800 y la grande— y `fotoProducto.js` los arma en un `srcset` al pintar.
>
> El transformador de Supabase Storage habría hecho esto al vuelo, pero **es de plan Pro**
> (403 `FeatureNotEnabled` en este proyecto). Por eso los tamaños se generan una sola vez,
> al subir, y **qué tamaños existen lo dice el nombre del archivo**: la marca
> `-<ancho>x<alto>.webp` al final. **Sin marca, no hay `srcset`**, y las fotos subidas
> antes del 23 de agosto no la tienen: se sirven enteras hasta que se resuban.

## Dos documentos de diseño, no uno

`DESIGN.md` gobierna la landing. **`DESIGN-PANEL.md` gobierna `/admin`** desde el 23 de
agosto de 2026: hereda los tokens y cambia lo que la densidad obliga —cuerpo por debajo de
1rem, escala de 4px, estado por punto y no por color—. Se corresponden con los dos archivos
de CSS: `src/index.css` y `src/panel.css`.

## El CSS: 6.842 + 7.549 líneas en dos archivos

Sin `@layer`, sin CSS modules, sin preprocesador. Un solo `@import './fuentes.css'`.

**Quién importa cada uno.** `index.css` lo importa `main.tsx`, así que va en todas partes.
`panel.css` no: lo importa **cada pantalla del panel que lo necesita** — `Dashboard.jsx`,
`ChatPanel.jsx`, `Login.jsx` y `ResetPassword.jsx`.

Las dos últimas se añadieron el 24 de agosto de 2026, después de un mes pintándose crudas.
Sus 69 reglas `.admin-login*` viven en `panel.css` y ninguna de las dos lo importaba, así
que **quien abría `/admin/login` escribiendo la dirección veía la página sin estilos**:
enlaces azules del navegador, el isotipo a tamaño natural, cursivas donde el sistema pide
versalitas. Desde dentro del panel se veía perfecta, porque la hoja ya estaba cargada — y
ese es el único camino que recorre quien programa. Lo encontró el joyero, en su celular, la
primera vez que intentó entrar.

La regla que queda: **si a una pantalla del panel se puede llegar por la URL sin pasar por
otra, importa su CSS ella misma.**

| Rango | Contenido | Ámbito |
|---|---|---|
| 1-373 | `:root` con tokens + reset | global |
| 375-3794 | Hero, confianza, colecciones, reseñas, FAQ, contacto, pie, navegación, catálogo, ficha | **público** |
| 3795-6926 | Admin: acceso, layout, rediseño | admin |
| 6927-8683 | Modales, Mercado Pago, confirmación, legales, WhatsApp, responsive, guía de tallas | **público** |
| 8684-13558 | Chat, panel, informes, pedidos | admin |
| 13559-16320 | Catálogo móvil, modal de pago, ficha a sangre, galería, `.aparece`/`.monta` | **público** |
| 16323-17562 | Pauta, dashboard, ProductModal, eliminar pieza, chat | admin |

**Reparto: ~8.300 líneas de tienda, ~9.250 de panel.** El panel pesa más que la tienda.

### El repo trae su propia herramienta

`npm run css:pisadas` (`scripts/css-pisadas.mjs`) detecta reglas sobrescritas. **Salida
actual: 84 bloques con declaraciones muertas** —la cifra de la primera línea de su salida;
el listado sólo enseña los 25 peores—. Sólo 2 de esos 25 son del sitio público
(`.hero-h1`, `.prod-card`); el resto es panel.

### Capas viejas confirmadas

1. **La ficha tiene tres capas conviviendo**: `.ficha-*` (`:2589`), `.product-page-*`
   (`:3090`) y una reescritura completa al final. Las `.product-page-*` sobreviven porque el
   esqueleto de carga y el "no encontrado" todavía las usan.
2. ~~**El HERO está duplicado**~~ — resuelto el 23 de agosto de 2026. Había un segundo
   bloque al final del archivo, fuera de toda media query, que pisaba al original: `.hero-h1`
   perdía cuatro declaraciones, entre ellas `font-weight: 400 → 800` **sobre Marcellus, que
   sólo tiene el 400** → negrita sintética en el titular de la portada. Hoy `.hero-h1` está
   una sola vez — [pendientes #15](../pendientes.md).
3. `RING SIZE GUIDE` (`:8039`) y `GUÍA DE TALLAS` (`:8042`) son dos cabeceras consecutivas
   para lo mismo; la primera quedó vacía.
4. Bloques "(redesigned)" conviviendo con sus originales en la zona de chat.
5. CSS muerto: `.admin-table` (12 refs / 0 en JSX), `.dash-table` (11/0),
   `.ficha-tecnica-lista` (5/0), `.product-page-grid`, `.product-page-btn`.

Hay un segundo `:root` en `:1719` (`--navbar-espacio`), acoplado a la navegación: no es un
conflicto, pero rompe el "todos los tokens en un sitio".

## Marca

- **La fuente de uso del isotipo es `src/components/Isotipo.jsx`**, con trazados en
  `currentColor` y `viewBox` recortado. Los SVG de `Identidad/` y `public/assets/` son
  copias de respaldo, **no** la fuente.
- `DESIGN.md` documenta un ⚠️ registrado de choque tipográfico entre isotipo, Marcellus y
  logotipo.
- **Voz**: español de Colombia, botones que nombran la acción, sólo lo verificable.

## Que cargue rápido en un celular

Medido el 24 de agosto de 2026 con PageSpeed, en móvil: **68 de rendimiento, FCP 3,7 s,
LCP 5,7 s** — los dos en rojo. Importa porque **la clienta llega desde TikTok o Instagram,
en un celular y con datos**: cinco segundos y medio de pantalla en blanco antes de ver la
primera joya es media venta perdida, y se paga por cada clic de pauta.

Cinco cambios, cada uno aislado y reversible por separado:

| Cambio | Dónde | Qué quita |
|---|---|---|
| Caché de los assets | `vercel.json` | 160 KiB revalidados en cada visita — abajo |
| `ProtectedRoute` a `lazy()` | `src/App.jsx` | ~120 KiB: el cliente de Supabase entero |
| Los píxeles, al primer gesto | `src/lib/pixeles.js` | 284,6 KiB de terceros fuera de la ruta crítica **y del bloqueo** |
| Precargar la foto del hero | `index.html` | Deja de esperar a que React la descubra |
| `build.target: 'es2022'` | `vite.config.ts` | 22 KiB de transpilación para navegadores que esta tienda no recibe |

**`ProtectedRoute` sólo envuelve `/admin`, pero se importaba arriba del todo**, así que cada
visitante de la portada se bajaba auth, realtime y storage de Supabase para no usarlos. El
bundle de entrada pasó de **419 KB a 246 KB**. El `<Suspense>` de las rutas ya lo cubría.

**Los píxeles se cargaron primero tras el evento `load`**, con `requestIdleCallback`, y desde
el 30 de agosto de 2026 **esperan al primer gesto de la persona**: `load` llegaba a los
435 ms y los 284 KiB seguían ejecutándose dentro de la ventana que mide el bloqueo — eran los
153 ms de los 137 de TBT de la portada, o sea todo. Lo delicado nunca fue diferirlos sino **no
perder eventos por el camino**: `meta()` y `tiktok()` descartaban en silencio cualquier
evento disparado antes de que el píxel existiera, así que diferir habría tirado el `PageView`
de cada carga. Por eso `pixeles.js` guarda una cola —`pendientes`, tope de 50—, la vacía en
cuanto `window.fbq` o `window.ttq` aparecen, fuerza la carga en los eventos que valen plata y
manda una baliza si la visita se va sin tocar nada. El detalle, con lo que cuesta, está en
[`atribucion-y-pixeles.md`](atribucion-y-pixeles.md). Se prueba en `src/lib/pixeles.test.js`.

**Y el navbar pinta antes que la ruta.** El `<Suspense>` envolvía el layout entero, así que
hasta que no llegaba el JS de la página no había ni navegación ni pie. Se movió dentro
(`ConNavbar`), y el marco aparece de inmediato. Se hizo con cuidado por el CLS: navbar y pie
tienen altura propia, así que el contenido no salta cuando la ruta entra.

**El elemento LCP era el logo del navbar, que es texto en Marcellus** — no la foto. Lo fue
mientras las fuentes venían de Google: lo que la gente esperaba era un archivo de otro
dominio al final de una cadena de cuatro pasos. Con las fuentes propias y la foto precargada
**el LCP pasó a ser el `<img>` del hero**, medido contra producción el 30 de agosto de 2026.
Lo que no cambia es la costumbre: mirar `largest-contentful-paint-element` antes de tocar
nada, porque este sitio ya se optimizó dos veces contra el elemento equivocado.

Lo que **no** se tocó entonces: partir el CSS en crítico y diferido (se resolvió después de
otra forma — ver abajo), y la región del servidor (el HTML se sirve desde Washington, pero
antes de mover nada hay que medir el TTFB real desde Colombia).

## La portada se pinta en el build, no en el celular

Medido con Lighthouse móvil sobre producción el 30 de agosto de 2026, con el sitio **ya**
optimizado —fuentes propias, foto precargada, píxeles diferidos, CSS partido en ocho hojas—:
**95 de rendimiento, LCP 2,6 s**. El desglose del LCP dice dónde estaba:

| Fase | Tiempo | % |
|---|---|---|
| TTFB | 680 ms | 11 % |
| Load Delay | 0 ms | 0 % |
| Load Time | 337 ms | 6 % |
| **Render Delay** | **4.936 ms** | **83 %** |

La foto del hero estaba entera en el primer segundo —el `preload` de `index.html` funciona— y
se pintaba dos segundos después. No esperaba a la red: **esperaba a que React montara.**
`#root` venía vacío, así que hasta bajar, parsear y ejecutar el bundle no había nada que
pintar. `observedFirstPaint` y `observedLargestContentfulPaint` caían en el mismo
milisegundo: la portada aparecía entera, de golpe, tarde.

Y no se arreglaba adelgazando el bundle. Atribuyendo sus 275 KB por sourcemap:

```
176,4 KB  66,2 %  react-dom
 37,3 KB  14,0 %  react-router
  8,0 KB   3,0 %  react
  3,6 KB   1,4 %  scheduler
  ~40 KB    ~15 %  TODO el código de la portada
```

El 83 % es el framework. Así que la portada dejó de necesitarlo para pintarse: la pinta
`scripts/prerenderizar.mjs` en el build, con `react-dom/server`, y el navegador la recibe
hecha. Medido en local con la misma máquina, el mismo bundle y el mismo estrangulamiento
(4× de CPU, 1,6 Mbps, 150 ms de ida y vuelta):

| | FCP | LCP |
|---|---|---|
| Cascarón vacío | 2.332 ms | 2.332 ms |
| Prerenderizada | **1.184 ms** | **1.184 ms** |

### Los dos HTML

`vercel.json` reescribe todas las rutas al mismo archivo, así que meter la portada en
`index.html` habría hecho que quien abre el enlace de Valentina y cae en `/catalogo/<uuid>`
**viera la portada** antes de que React lo corrigiera. Por eso el build deja dos:

- `dist/index.html` — la portada pintada dentro de `#root`. Sólo la sirve `/`.
- `dist/app.html` — el mismo archivo con el `#root` vacío. Lo sirve el comodín.

Vercel mira el sistema de archivos antes que las reescrituras, y el `source` del comodín
termina en `.+` para que la raíz no pueda caer ahí ni por accidente.

`src/main.tsx` decide por lo que hay en el contenedor y no por la ruta: `hydrateRoot` si
`#root` trae algo, `createRoot` si no. Así, si el prerenderizado fallara, el sitio se monta
en el navegador como antes en vez de quedarse en blanco.

### Y con la portada pintada, el CSS pasó a ser lo que sobraba

Quitado el JavaScript de en medio, **la hoja de estilos quedó como la única petición entre
el HTML y la primera joya**: un viaje de red entero, en serie. Lighthouse lo marcó las dos
veces —antes y después de prerenderizar— como «solicitud de bloqueo de renderización,
ahorro estimado de 300 ms», etiquetado a la vez para FCP y para LCP.

Así que `index.html` la lleva **adentro**, en un `<style>`. Sólo `index.html`: `app.html`
conserva el `<link>`, porque en las demás rutas el HTML no pinta nada por sí mismo y ahí
vale más tenerla cacheada aparte.

**Se mete la hoja completa, en el sitio exacto donde estaba el `<link>`** — no un "CSS
crítico" recortado. Los mismos bytes en el mismo orden es lo único que garantiza que la
cascada no cambie, y en este proyecto una regla que cambia de sitio cambia quién gana sin
que lo vea ninguna prueba. Comprobado con `huella-estilos.mjs --estados`: **ni una
diferencia** en 12.568 elementos de 48 pantallas.

El precio son ~9 KB comprimidos que la portada ya no cachea entre visitas —`index.html` pasa
de 12 a 20 KB—; el viaje de red que ahorra vale más. Medido en el navegador, con 4× de CPU:
**FCP de 1.208 a 416 ms.**

El script se niega a hacerlo si la hoja trae una `url()` relativa: colgando del `<link>` se
resolvían contra `/assets/` y en línea lo harían contra `/`. Hoy las cuatro que hay son las
fuentes, absolutas.

### Y la foto del hero dejó de decir `decoding="async"`

Esa palabra le dice al navegador que puede pintar sin esperar a descodificar la foto, y
descodificarla cuando le quede un hueco. En el elemento LCP eso es exactamente lo contrario
de lo que se quiere: el hueco, en un celular lento, se lo come la hidratación de React. Se
vio en cinco corridas de PageSpeed el 30 de agosto de 2026, con la foto bajada desde el
primer momento y el LCP saltando entre 1,7 s y 2,7 s — con el Speed Index bailando con él,
que es la pista de que era una sola causa y no dos.

### Lo único delicado: que los dos renders coincidan

Si el HTML del build y el primer render del navegador no dicen lo mismo, React tira lo
pintado y reconstruye el árbol entero — deshace exactamente lo que se vino a ganar, y **sin
que se vea**. Lo que hubo que arreglar:

| Qué | Por qué | Cómo |
|---|---|---|
| El enlace de WhatsApp | `isMobile()` mira `navigator` y la marca `[ref:]` sale de `localStorage`; en Node no hay ninguno de los dos | `useWaUrl()` pinta el mensaje de escritorio sin marca —lo mismo que el build— y lo cambia por el bueno al montar |
| Las animaciones | `useLayoutEffect` avisa por consola en cada build | `useEfectoDeDiseno`, que es `useEffect` en Node |
| El año del pie | El build lo escribe una vez y el 1 de enero deja de coincidir | `suppressHydrationWarning` |

**La regla, para lo que venga: nada que se pinte puede depender de `navigator`,
`localStorage`, la fecha o el azar en el primer render.**

### Dónde quedó

**De 95 a 99–100 en PageSpeed móvil**, el 30 de agosto de 2026. El primer pintado real de la
portada, medido en el navegador con 4× de CPU y 4G lenta, bajó de **2.332 a 416 ms**.

Los tres cambios no se hicieron de una: se hicieron en dos despliegues, y el intermedio es
la parte que vale la pena recordar. Con la portada ya prerenderizada y los píxeles fuera,
cinco corridas de PageSpeed dieron esto:

| LCP | Speed Index | Puntaje |
|---|---|---|
| 1,7 s | 1,4 s | 100 |
| 2,5 s | 2,1 s | 97 |
| 2,7 s | 4,2 s | 94 |

El TBT ya estaba en cero y el FCP clavado en 1,4 s en todas, así que **lo único que bailaba
era cuándo aparecía la foto** — con el Speed Index moviéndose en bloque con el LCP, que es
lo que delata una sola causa y no dos. La cadena crítica terminaba a los 299 ms: la foto
llevaba rato en el disco del celular. Lo que faltaba era descodificarla, y `decoding="async"`
decía explícitamente que eso podía esperar a que hubiera un hueco. El hueco se lo comía la
hidratación.

**Lo que se aprende de ahí, para la próxima:** cuando el LCP salta entre dos valores de
corrida a corrida con el FCP quieto, no es la red. Y si el Speed Index salta con él, es una
sola cosa. Mirar la fase antes de tocar nada — está en las trampas de `CLAUDE.md`, y en este
proyecto ya se optimizó dos veces contra el elemento equivocado.

**Lo que no hay que perseguir es un 100 estable.** No hay datos de usuarios reales en CrUX,
así que esto es puro laboratorio y PageSpeed trae varianza propia: en la tanda de arriba hay
un Speed Index de 4,3 s que no se explica por nada del sitio. Lo que se persigue es la
mediana. Y **PageSpeed cachea su resultado**: dos corridas seguidas devuelven los mismos
cinco números y parecen dos mediciones. Dejar pasar un minuto entre una y otra.

**Y lo que sí hay que vigilar no es la velocidad, es la medición.** El precio de haber sacado
los píxeles del bloqueo es que una visita sin un solo gesto ya no le llega a TikTok. Está en
[`atribucion-y-pixeles.md`](atribucion-y-pixeles.md#los-píxeles-esperan-al-primer-gesto-de-la-persona),
con lo que lo cubre y lo que no.

## La caché de los assets

`vercel.json` sirve `/assets/*` con `max-age=31536000, immutable` — un año. Se puede porque
el bundle y las hojas llevan **el hash del contenido en el nombre**: si el contenido cambia,
cambia la URL, así que no hay forma de servir algo viejo. `index.html` se queda sin caché,
para que un despliegue se vea al instante.

Antes de eso, Vercel servía **todo** con `max-age=0, must-revalidate`, incluidos el bundle y
las fuentes. Cada visita revalidaba 160 KiB que ya estaban en el disco del visitante.

**Y hasta el 30 de agosto de 2026 esa regla no llegaba a las fuentes ni a las fotos.** La
segunda regla del archivo —`/(.*)\.(svg|png|jpg|jpeg|webp|ico|woff2)`, siete días— también
hacía match sobre `/assets/`, y **en Vercel gana la última que coincide**. Medido con `curl`:
`/assets/fuentes/mulish-latin.woff2` y `/assets/pen-hero-768.webp` salían con
`max-age=604800`, mientras el bundle —que no es de esas extensiones— sí tenía su año. O sea
que la regla del año sólo se aplicaba donde no hacía falta discutirla.

Ahora la segunda regla lleva `(?!assets/)` delante y se queda con lo que vive en la raíz de
`public/`, que hoy es sólo `favicon.svg`. La misma sintaxis de lookahead que ya usaba el
rewrite de abajo.

El precio de la mudanza: los archivos de `public/assets/` **no llevan hash**, llevan nombre
propio (`pen-hero-768.webp`, `marcellus-latin.woff2`). Con un año e `immutable`, cambiar una
de esas fotos dejando el mismo nombre significa que quien ya la tenga verá la vieja hasta un
año. **Al cambiar una foto de `public/assets/`, se cambia también su nombre** — el nombre ya
lleva el ancho, añadirle una versión no rompe nada porque quien las referencia son
`index.html` y los componentes, no la base.

### Las fotos del catálogo, que no están en Vercel

Las de `product-images` las sirve Supabase, y su `Cache-Control` sale de los metadatos que
se le ponen **al subir el archivo**. Nadie se los puso nunca, así que los 344 archivos del
bucket decían `max-age=3600`: una hora. En la portada eso son 110 KiB que se vuelven a bajar
al día siguiente.

Desde el 30 de agosto de 2026 `ProductModal.jsx` sube con `cacheControl: '31536000'` en las
tres subidas —las copias del `srcset`, la grande y la gemela JPEG de WhatsApp—. Se puede
poner un año sin miedo porque la ruta de una foto lleva fecha e identificador al azar
(`${Date.now()}-${random}`) y **nunca se reescribe**: cambiar la foto de una pieza sube una
ruta nueva.

Para las que ya estaban hay `scripts/refrescar-cache-fotos.mjs`, que se corre a mano una vez.
La API de Storage no tiene un «actualizar cabeceras», sólo un PUT con el archivo entero, así
que el script se baja cada foto y la vuelve a poner **en la misma ruta** — nunca renombra ni
mueve, porque el nombre es lo que sostiene el `srcset` y la gemela de WhatsApp. Pide
`SUPABASE_SERVICE_ROLE_KEY` en la línea de comandos, y sin `--de-verdad` sólo cuenta.

**`vercel.json` no admite comentarios ni claves inventadas.** El primer intento llevaba una
clave `_comentario` con la explicación de arriba, y Vercel **rechazó el despliegue entero
antes de compilar** — sin logs de build, porque nunca llegó a haber build. Es JSON estricto
con un esquema cerrado: lo que haya que explicar, se explica aquí.

## La segunda mudanza del CSS

**Aplicada el 30 de agosto de 2026.**

`index.css` eran 4.299 líneas y **bloqueaban el primer pintado en todas las rutas**. De
ellas, 1.290 pertenecían en exclusiva a tres pantallas que ya cargan su propia hoja: la ficha
(1.108), el catálogo (116) y confirmación (66). No las había encontrado `css-de-quien-es.mjs`
porque son estados que no existen hasta que alguien hace clic — el visor de fotos, el modal
de compra, el panel de filtros, la cuenta del abono.

Quedó en 2.900 líneas. Medido antes y después, recompilando:

| Hoja | Antes | Después |
|---|---|---|
| `index.css` — bloqueante, en todas las rutas | 12,94 KB gz | **8,87 KB gz** |
| `ProductPage.css` | 4,23 | 7,72 |
| `Catalog.css` | 2,45 | 2,87 |
| `Confirmacion.css` | 0,69 | 0,99 |

Los bytes no desaparecen: cambian de archivo. Lo que se gana es que la portada y el catálogo
dejen de bajar el CSS de la ficha para no usarlo.

### Cómo se decide de quién es una regla

No por el nombre de la clase — ya se intentó con prefijos y `.joyero`, que es la ficha, acabó
clasificada como panel y rompió la ficha. `scripts/css-mudanza.mjs` lo decide por **quién
nombra la clase en el código**, y resuelve qué pantalla carga a cada archivo **siguiendo las
importaciones** desde cada página, no adivinando por la ruta: `src/components/Foto.jsx` lo
usan la ficha y el catálogo, y eso sólo lo sabe el grafo. Un bloque se mueve sólo si *todas*
sus clases las nombra código de una única pantalla.

Cortar y pegar líneas no vale: 129 de esos bloques viven dentro de un `@media` y sacar sus
renglones descuadra las llaves — probado, postcss tumba el build. El script parsea de verdad
y, si de un `@media` se va la mitad, escribe un `@media` nuevo en el destino con esa mitad.

### Lo que ya cazó, antes de aplicarse

El primer intento **rompió el panel de filtros** y nadie lo habría visto: `.catalogo-panel`
aterrizó en `Catalog.css` después del `@media` que ya lo ajustaba allí, así que la regla base
pasó a ganarle al ajuste de escritorio y el panel se ensanchó de 510 a 1.326 px a partir de
1024. No sale en ninguna prueba, no sale en el build y no sale en la página cargada: el panel
sólo existe tras un clic.

Lo cazó `huella-estilos.mjs --estados`, que se añadió para esto: abre el visor, el modal de
compra y el panel de filtros antes de medir, y **se niega a medir un estado que no se abrió**
en vez de anotar la página cerrada y decir que no cambió nada. El script veta ahora ese caso
solo —cuatro selectores se quedan en `index.css` por precaución— y la comparación de las
48 pantallas resultantes, 12.560 elementos y 54 propiedades cada uno, dice «ni una
diferencia».

### Cuando se aplique

1. `node scripts/huella-estilos.mjs tomar antes.json --estados` con el árbol limpio y
   compilado.
2. `node scripts/css-mudanza.mjs` para ver el reparto, y `--de-verdad` para moverlo.
3. Recompilar, `tomar despues.json --estados`, `comparar`.
4. `npm run css:pisadas`, que sigue mirando dentro de cada archivo.

Se esperó a que aterrizara el refactor del catálogo y de la ficha antes de aplicarla, y el
reparto **se volvió a correr entonces**: se apoya en qué clase nombra cada componente, y con
las clases moviéndose una regla puede quedarse sin dueño y dejar de aplicarse en silencio. El
reparto de la víspera daba 1.268 líneas; el de después, 1.290. Por eso no se reutiliza un
reparto viejo.

La comparación final, sobre el repositorio de verdad: 48 pantallas, 12.568 elementos,
«ni una diferencia». `css:pisadas` sigue en los mismos tres bloques de siempre.

## Accesibilidad

Lighthouse daba 91 en la portada el 30 de agosto de 2026, con tres fallos. Los tres eran de
marcado, no de diseño, y los tres estaban en la portada — la pantalla que recibe el tráfico:

- **No había `<main>`.** Es el atajo con el que un lector de pantalla se salta la navegación y
  empieza a leer. Las demás pantallas públicas ya lo tenían; la portada y la ficha no, así que
  quien entra con NVDA o VoiceOver se oía el menú entero en cada carga. La ficha pasó de
  `<div className="ficha">` a `<main className="ficha">`: la clase no cambia, así que no cambia
  nada de lo que se ve, y **ninguna regla de CSS dice `div.ficha`** — se comprobó antes.
- **`aria-label` en un `<div>` sin rol**, en las cinco estrellas de la nota. Es un atributo
  prohibido: un `<div>` no tiene nada que etiquetar. Se resolvió con `aria-hidden` y no con
  `role="img"` porque la nota **ya está escrita en texto** justo encima (`4.9/5`): las
  estrellas son la misma frase dibujada, y etiquetarlas la haría sonar dos veces.
- **El enlace del pie sólo se distinguía por el color.** El crédito de autoría llevaba
  `border-bottom: 1px solid transparent` y sólo se pintaba al pasar el ratón — que en un
  celular no pasa nunca. Ahora el filete va puesto, al 45% de opacidad: se ve que hay un
  enlace sin que el crédito compita con la marca.

**La huella de estilos no sirve para verificar esto** y es el caso que su propio comentario
anticipa: su clave es el camino de índices desde `<body>`, así que meter un `<main>` corre
todos los índices y la comparación marca la página entera. Se comprobó midiendo el DOM y los
estilos calculados en la página servida: un solo `<main>`, con las ocho secciones dentro.

## Límites conocidos y pendientes

- ~~**El titular de la portada sale en negrita sintética**~~ — corregido el 23 de agosto de
  2026 — [pendientes #15](../pendientes.md).
- ~~**No hay guía de diseño del panel**~~ — `DESIGN-PANEL.md`, que hereda la identidad
  entera y cambia lo que la densidad obliga: el cuerpo baja de 1rem, la escala es de 4px y
  el estado de un pedido se distingue por un punto y no por un color de fondo.
- ~~**La skill de diseño no está versionada**~~ — vive en
  `.claude/skills/designing-aurem-gs/`, dentro del repositorio, y ya no contradice al
  código en las fuentes — [pendientes #6](../pendientes.md).
- 4 bloques con declaraciones pisadas, desde 143. Las «tres capas» de la ficha resultaron
  ser tres espacios de nombres con tres trabajos distintos — ver pendientes #16.
- `DESIGN.md` tiene su propia sección de **Pendientes**: falta el precio del hero y las nueve
  fotos son de relleno.

## Cómo probarlo

```bash
npm run css:pisadas     # hoy: 4 bloques · acepta una ruta y un filtro
npm run dev
```

1. **La negrita sintética:** abre la portada y mira el titular con el inspector. `.hero-h1`
   tiene que salir en `font-weight: 400`. Si alguna vez sale en 800, es que volvió a aparecer
   una segunda definición al final del archivo.
2. **Contraste:** pasa la portada por un verificador de contraste. Todo texto con
   `--text-muted` debe dar ≥ 4,5:1.
3. **Movimiento reducido:** activa `prefers-reduced-motion` en el SO. Nada debe animarse.
4. **Sin JavaScript:** el contenido debe verse, no quedar oculto.
5. **Fuentes:** en la pestaña de red **no debe haber ninguna petición a
   `fonts.googleapis.com` ni a `fonts.gstatic.com`**.
6. **Móvil de verdad:** 390 px en el simulador no basta. Usa el iframe para medir anchos
   reales.
7. **CSS muerto:** antes de borrar una regla, comprueba con `grep -r "clase" src/` que de
   verdad no la usa ningún JSX.
8. **El prerenderizado, en la consola:** abre la portada del build con la consola abierta.
   **No puede haber ni un aviso de hidratación.** Si React se queja, tiró el HTML pintado y
   volvió a construir la página entera: se ve idéntica y no sirvió de nada.
9. **Que la portada llegue pintada:** `curl -s <url>/ | grep -c hero-frame` tiene que dar 1.
   Y `curl -s <url>/catalogo/<uuid> | grep -c hero-frame` tiene que dar 0 — si da 1, el
   comodín de `vercel.json` volvió a apuntar a `index.html` y las fichas parpadean con la
   portada.

**Ojo con `npm run preview` para lo segundo:** `vite preview` manda cualquier ruta a
`index.html`, así que ahí `/catalogo` sí enseña la portada. No es un fallo del sitio, es que
Vercel sirve `app.html` y `vite preview` no sabe de esa regla. Para probar el enrutado de
verdad hace falta el despliegue de vista previa de Vercel.
