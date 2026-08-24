# Landing — la portada

> **Estado:** en producción · las promesas, alineadas con lo que el taller hace de verdad
> **Última revisión:** 2026-08-23
> **Ruta:** `/`

## Qué resuelve

Una joyería de oro que vende por internet tiene un problema antes que el de vender:
**convencer de que existe**. Quien llega desde un anuncio no sabe si detrás hay un taller
o una estafa. La portada está construida alrededor de esa pregunta, no alrededor del
catálogo.

Por eso el objetivo no es "mostrar productos": es dar señales verificables (punzón, taller,
garantía escrita, quién responde) y llevar a WhatsApp, que es donde se cierra de verdad.

## Cómo funciona hoy

### Flujo

Portada → el visitante hace una de tres cosas: escribe por WhatsApp (botón flotante, hero,
reseñas, contacto, pie), entra al catálogo, o se va. No hay carrito ni cuenta de usuario.

### Archivos clave

| Archivo | Qué hace |
|---|---|
| `src/pages/Home.jsx` | Compone las secciones e inyecta el JSON-LD de `JewelryStore` (`:11-21`) |
| `src/components/Navbar.jsx` | Píldora de navegación, sensible al scroll |
| `src/components/Hero.jsx` | Titular, CTAs y foto principal; sistema de retardos propio (`--hero-delay`, `--line-delay`) |
| `src/components/TrustBar.jsx` | Señales de confianza (`:41-45` — el certificado cuesta $50.000 aparte) |
| `src/components/Collections.jsx` | Tres categorías con animación de aparición |
| `src/components/TiltedCarousel.jsx` + `.css` | Carrusel infinito, −2° de inclinación, 40 s de bucle |
| `src/components/WhyUs.jsx` | Por qué comprar aquí (`:38`) |
| `src/components/Reviews.jsx` | Testimonios — **hardcodeados** (`:4-29`, `:51-58`) |
| `src/components/Faq.jsx` | Acordeón de 6 preguntas (`:6-31`) |
| `src/components/Contact.jsx` | Formulario que **no envía nada a ningún backend** |
| `src/components/Footer.jsx` | Marca, enlaces, contacto |
| `src/components/WhatsAppButton.jsx` | Botón flotante |
| `src/components/Foto.jsx` | `<picture>` con WebP + fallback JPG |
| `src/components/Isotipo.jsx` | El monograma AG en SVG con `currentColor` |
| `src/lib/aparecer.js` | Animaciones de entrada al hacer scroll |

### Tablas y columnas

**Ninguna.** La portada es 100% estática — no consulta Supabase. Es la razón de que cargue
rápido y de que siga en pie aunque la base esté caída.

### Variables de entorno

Ninguna propia. Los píxeles se inicializan en `App.jsx`, no aquí.

## Decisiones tomadas y por qué

**El formulario de contacto no tiene backend.** `Contact.jsx:70` valida, arma un mensaje
formateado y hace `window.open(waUrl(lines))`. Un formulario que manda correo habría
necesitado un endpoint, una bandeja que alguien revise y una respuesta en horas. WhatsApp
ya está abierto y la respuesta es inmediata. El botón de correo sólo copia la dirección al
portapapeles.

**El botón flotante de WhatsApp aparece a los 800 ms** (`WhatsAppButton.jsx:10-13`) y **se
esconde en toda la rama `/catalogo` y en `/admin`** (`:19, :34`). En el catálogo y la ficha
estorba: ahí ya hay CTAs propios y el flotante tapaba la barra fija de compra.

**Cada enlace de WhatsApp lleva la atribución escrita en el propio mensaje**
(`src/lib/whatsapp.js:32-38`): se le añade `[ref: tiktok|meta|<utm_source>]`. Meta tiene
`ctwa_clid` para saber de qué anuncio viene un chat; **TikTok no manda nada equivalente**,
así que la única forma de saberlo es anotarlo en el texto.

**`waUrl()` acepta `{mobile, desktop}`** (`whatsapp.js:21-24`) porque WhatsApp Web no
renderiza bien los emojis pasados por URL: el mensaje se manda distinto según el
dispositivo.

**Las animaciones no usan Framer Motion.** Se eliminó (~41 KB) y se reemplazó por
`src/lib/aparecer.js`. El detalle que importa: **el estado oculto lo pone el hook en
`useLayoutEffect`, no el JSX** (`aparecer.js:44-47`). Si el JS no corre, el contenido queda
**visible** en vez de invisible para siempre. `noAnimar()` cubre tres casos: sin
`IntersectionObserver`, `prefers-reduced-motion`, y pestaña oculta — Chrome no dispara el
observer en pestañas de fondo, así que un clic con el botón central abría una página en
blanco.

**Las fotos estáticas pasan por `Foto.jsx`**, que sirve WebP con fallback JPG en dos
anchos. El hero lleva `fetchPriority="high"`.

## Límites conocidos y pendientes

- **Las reseñas de `Reviews.jsx` son inventadas**, igual que el "4,9/5", las "+500 piezas
  entregadas" y los "+100 clientes". **Se quedan así por decisión del dueño**, tomada el 23
  de agosto de 2026, hasta que él avise. No es un pendiente: es una decisión, y no hace
  falta volver a plantearla.

  Lo que sí se corrigió ese día es lo que *prometían*: un testimonio daba por incluido el
  certificado —cuesta $50.000 aparte— y otros dos hablaban de un collar y unas pulseras que
  el catálogo no tiene. Ahora se apoyan en el punzón, el estuche, la guía y el plazo real.
- ~~**El JSON-LD promete platino, collares y certificación incluida**~~ — corregido; el
  comentario de `Home.jsx` deja escrito qué decía y por qué se cambió.
- ~~`Hero.jsx` y `Reviews.jsx` prometen platino y certificación incluida~~ — retirado el 23
  de agosto de 2026. No hay ni una pieza de platino, y el certificado lo emite un
  laboratorio aparte y cuesta $50.000. Los comentarios de los dos archivos dejan escrito
  qué decían.
- ~~**El titular sale en negrita sintética**~~ — corregido; era un bloque `HERO SECTION` del
  diseño anterior, fuera de toda media query, metiéndole `font-weight: 800` a Marcellus.
  Ver [pendientes #15](../pendientes.md).
- ~~**El acordeón del FAQ no es accesible por teclado**~~ — la anidación es `h3 > button` y
  el `onToggle` va en el botón, no en el `<div>` de fuera.
- Hero, TrustBar, Reviews y TiltedCarousel **no usan `useAparecer`** — el Hero tiene su
  propio sistema de retardos inline.

## Cómo probarlo

```bash
npm run dev   # http://localhost:5173/
```

1. **Con JavaScript desactivado**, el contenido debe seguir visible (no en blanco).
2. Con `prefers-reduced-motion: reduce` activado en el SO, nada debe animarse.
3. Abrir la portada en una pestaña de fondo (clic con el botón central) y luego traerla al
   frente: el contenido debe estar visible, no oculto esperando un observer que no disparó.
4. Cada enlace de WhatsApp debe abrir el chat con el `[ref: …]` al final si llegaste con
   `?utm_source=…` o `?ttclid=…`.
5. El botón flotante **no** debe aparecer en `/catalogo` ni en `/catalogo/:id`.
