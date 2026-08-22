# Diseño y frontend

> **Estado:** en producción · **deuda técnica alta en CSS**
> **Última revisión:** 2026-08-22

## Qué resuelve

Cómo se ve el proyecto y de dónde salen esas decisiones. Y **cuál es la fuente de verdad**,
que es la pregunta que más se responde mal.

## La cadena de autoridad

```
DESIGN.md  (raíz, 595 líneas)          ← FUENTE DE VERDAD
    ↓ versión operativa, para construir
.claude/skills/designing-aurem-gs/     ← no versionada (pendientes #6)
    ↓ implementación
src/index.css  (17.562 líneas)         ← los tokens coinciden con DESIGN.md
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

> **Las fotos de producto no pasan por `Foto.jsx`**: `ProductCard.jsx:51` y la galería usan
> `<img>` crudo, sin `srcset` ni dimensiones. Se optimizan al subir, no al entregar —
> [pendientes #20](../pendientes.md).

## El CSS: 17.562 líneas en un archivo

Sin `@layer`, sin CSS modules, sin preprocesador. Un solo `@import './fuentes.css'`.

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
actual: 84 bloques con declaraciones muertas.** Sólo 2 son del sitio público
(`.hero-h1`, `.prod-card`); el resto es panel.

### Capas viejas confirmadas

1. **La ficha tiene tres capas conviviendo**: `.ficha-*` (`:2589`), `.product-page-*`
   (`:3090`) y una reescritura completa al final. Las `.product-page-*` sobreviven porque el
   esqueleto de carga y el "no encontrado" todavía las usan.
2. 🔴 **El HERO está duplicado** (`:7912-7950`, **fuera de toda media query**) y pisa al
   original de `:375`. `.hero-h1` pierde cuatro declaraciones, incluida
   `font-weight: 400 → 800` **sobre Marcellus, que sólo tiene 400** → negrita sintética en
   el titular de la portada — [pendientes #15](../pendientes.md).
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

## Límites conocidos y pendientes

- 🔴 **El titular de la portada sale en negrita sintética** — [pendientes #15](../pendientes.md).
- 🟠 **No hay guía de diseño del panel**, que es la mitad del código.
- 🟠 **La skill de diseño no está versionada** y contradice al código en el punto de las
  fuentes — [pendientes #6](../pendientes.md).
- 84 bloques con declaraciones muertas y tres capas para la ficha.
- `DESIGN.md` tiene su propia sección de **Pendientes**: falta el precio del hero y las nueve
  fotos son de relleno.

## Cómo probarlo

```bash
npm run css:pisadas     # hoy: 84 bloques con declaraciones muertas
npm run dev
```

1. **La negrita sintética:** abre la portada y mira el titular con el inspector. `.hero-h1`
   debería ser `font-weight: 400`; hoy gana el `800` de la línea 7912.
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
