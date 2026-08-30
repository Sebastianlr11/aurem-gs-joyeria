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
| Los píxeles, después de pintar | `src/lib/pixeles.js` | 284,6 KiB de terceros fuera de la ruta crítica |
| Precargar la foto del hero | `index.html` | Deja de esperar a que React la descubra |
| `build.target: 'es2022'` | `vite.config.ts` | 22 KiB de transpilación para navegadores que esta tienda no recibe |

**`ProtectedRoute` sólo envuelve `/admin`, pero se importaba arriba del todo**, así que cada
visitante de la portada se bajaba auth, realtime y storage de Supabase para no usarlos. El
bundle de entrada pasó de **419 KB a 246 KB**. El `<Suspense>` de las rutas ya lo cubría.

**Los píxeles se cargan ahora tras el evento `load`**, con `requestIdleCallback` y un
respaldo por `setTimeout` porque Safari no lo trae. Lo delicado no era diferirlos sino **no
perder eventos por el camino**: `meta()` y `tiktok()` descartaban en silencio cualquier
evento disparado antes de que el píxel existiera, así que diferir habría tirado el `PageView`
de cada carga. Por eso `pixeles.js` guarda una cola —`pendientes`, tope de 50— y la vacía en
cuanto `window.fbq` o `window.ttq` aparecen. Se prueba en `src/lib/pixeles.test.js`.

**Y el navbar pinta antes que la ruta.** El `<Suspense>` envolvía el layout entero, así que
hasta que no llegaba el JS de la página no había ni navegación ni pie. Se movió dentro
(`ConNavbar`), y el marco aparece de inmediato. Se hizo con cuidado por el CLS: navbar y pie
tienen altura propia, así que el contenido no salta cuando la ruta entra.

**El elemento LCP es el logo del navbar, que es texto en Marcellus** — no la foto. Está
escrito arriba y con medición, y aun así se optimizó dos veces contra la foto del hero antes
de releerlo. La foto sí se precarga, pero por el FCP, no por el LCP.

Lo que **no** se tocó, a propósito: partir el CSS en crítico y diferido (el premio son
16 KiB y este proyecto tiene historial de regresiones de CSS — para eso existe
`css:pisadas`), y la región del servidor (el HTML se sirve desde Washington, pero antes de
mover nada hay que medir el TTFB real desde Colombia).

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
