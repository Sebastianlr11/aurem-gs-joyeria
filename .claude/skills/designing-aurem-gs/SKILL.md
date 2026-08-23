---
name: designing-aurem-gs
description: Genera UI on-brand para Aurem Gs Joyería (landing, catálogo, componentes, correos, piezas para redes) aplicando la dirección "Luz de vitrina" — base marfil, tinta cacao, un solo oro, Marcellus + Mulish, escala de 8px y radio de 2px. Úsese siempre que se diseñe, escriba o modifique interfaz, copy de interfaz, CSS o mockups de este proyecto, incluso si el pedido es solo "una sección", "un botón" o "cambia este color". Contiene los hex exactos, las reglas de tipografía y espaciado, y las prohibiciones que evitan que la página se vea genérica.
---

# Diseñar para Aurem Gs Joyería

Joyería colombiana de oro 18k, plata 925 y platino. La clienta llega desde
TikTok, Instagram, Facebook o WhatsApp: viene de un video, está en el celular,
tiene medio segundo de atención y una duda de fondo — *¿esta tienda es real?*
Todo lo que diseñes responde esa duda antes de que aparezca.

La dirección se llama **Luz de vitrina**: luz de mostrador de joyería, no fondo
negro de escaparate nocturno. Personalidad: **artesanal, luminosa, precisa**.

La fuente de verdad completa es [`DESIGN.md`](../../../DESIGN.md) en la raíz del
proyecto. Este archivo es la versión operativa: úsalo para construir.

> **Si lo que estás tocando está dentro de `/admin`, esta guía no basta: manda
> [`DESIGN-PANEL.md`](../../../DESIGN-PANEL.md).** El panel hereda estos tokens
> pero cambia tres reglas que aquí son sagradas — el cuerpo baja de 1rem a
> propósito, la escala de espaciado es de 4px y no de 8, y el estado de un pedido
> se distingue por un punto y nunca por un color de fondo. Aplicar las reglas de
> la landing al panel produce una herramienta bonita y lenta de usar.

## Tokens

Ya existen como variables CSS en `src/index.css`. Nunca escribas un color
hexadecimal a pelo en un componente; usa la variable.

```css
--ink:            #1C1714;  /* cacao: texto y bandas oscuras. Nunca #000 */
--ink-soft:       #2A231E;  /* hover de superficies oscuras, inputs oscuros */
--bg-marfil:      #FBF7F2;  /* fondo base de secciones */
--bg-color:       #FFFFFF;  /* lo que contiene producto: tarjetas, fotos, navbar */
--bg-arena:       #F2EAE0;  /* bandas alternas, chips, hover secundario */
--oro:            #A8863F;  /* acento único, SOLO decorativo: filetes, bordes, sellos */
--oro-ink:        #7A5F26;  /* texto dorado sobre claro (cumple AA 5.7:1) */
--oro-luz:        #E3C990;  /* oro sobre cacao (11.3:1) */
--text-secondary: #6B615A;  /* gris cálido: descripciones, especificaciones */
--hairline:       #E6DED3;  /* todas las separaciones */
```

Un solo acento. No existe segundo color de marca.

## Tipografía

```css
/* Las fuentes se AUTOALOJAN. No importes nada de fonts.googleapis.com:
   se midió, y pasar de Google Fonts a self-hosting fue lo que arregló un
   LCP de 5,7 s — el elemento LCP es el logo del navbar, que es texto en
   Marcellus, y esperaba a una petición a otro dominio para pintarse.
   Los @font-face ya están en src/fuentes.css, con los .woff2 en
   public/assets/fuentes/. Aquí sólo se usan. */
--font-display: 'Marcellus', Georgia, serif;
--font-ui: 'Mulish', system-ui, sans-serif;
```

**Marcellus** — solo `h1`/`h2`/`h3` y citas. Romana inscripcional: letra grabada
en piedra o en metal, el mismo gesto del punzón. Tamaños grandes, `line-height`
1.02–1.15, `letter-spacing` -0.015em. Titulares de dos a cuatro palabras.

**Un solo peso (400) y sin cursiva.** Nunca pidas otro peso ni dejes que el
navegador incline la fuente: la cursiva sintética se nota a tamaño grande. El
énfasis de la segunda línea del titular se hace con **versalitas espaciadas** —
mayúsculas al 62% del tamaño, tracking 0.06em, `display: block`:

```css
.hero-h1 em, .collections-title em, .why-us-title em,
.reviews-title em, .faq-title em, .contact-title em {
  font-style: normal; font-weight: 400;
  text-transform: uppercase; letter-spacing: 0.06em;
  font-size: 0.62em; display: block; margin-top: 0.35em;
}
```

Las citas de clientas y la frase del pie van en Marcellus redonda con
interlineado 1.55.

**Mulish** — todo lo funcional: cuerpo, precios, botones, formularios,
navegación, especificaciones. Nunca la serif en algo que se toca; la clienta debe
distinguir al instante lo que se lee de lo que se pulsa.

Escala: `h1` clamp(3rem, 5.6vw, 4.5rem) · `h2` clamp(2.5rem, 4.6vw, 3.5rem) ·
`h3` 1.85rem · cuerpo 1rem/1.65 (nunca menos de 1rem) · antetítulo 0.68rem
mayúsculas 700 tracking 0.24em · punzón 0.63rem mayúsculas 700 tracking 0.16em.
El salto de escala grande/diminuto es lo que se lee como caro.

## Espaciado y forma

Escala de 8px: 8 / 16 / 24 / 48 / 96 / 112. Padding vertical de sección 112px en
desktop, 64px en móvil. Ancho máximo 1320px, márgenes laterales 64px → 24px en
móvil. Imágenes de producto en 4:5 dentro de grillas, a sangre en el hero.

Radio 2px en todo (tarjetas, imágenes, campos, punzones). 100px solo en lo que se
toca: botones y la píldora de navegación. La forma comunica la función.

Separaciones con línea de 1px en `--hairline`, nunca con sombras. Las tarjetas
llevan borde de pelo y solo al hover reciben `0 24px 50px rgba(28,23,20,0.09)`
más 4px de desplazamiento.

## El punzón: el elemento firma

El sello de ley que un orfebre golpea dentro de una pieza. Se usa donde hay algo
**comprobable** — 18K, 925, PT950, CERTIFICADO, GARANTÍA. Si no dice un dato
verificable, no se pone.

```css
.punzon {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.42rem 0.75rem;
  font-family: var(--font-ui); font-size: 0.63rem; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--oro-ink);
  background: linear-gradient(180deg, #fff 0%, var(--bg-marfil) 100%);
  border: 1px solid rgba(168, 134, 63, 0.32);
  clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
```

Sobre cacao: color `--oro-luz`, fondo `linear-gradient(180deg,#241E1A,#1C1714)`.

## Estructura de página

Bandas: una idea por banda, alternando marfil, blanco y —una sola vez, en
contacto— cacao. Orden obligatorio de la landing:

1. Hero
2. **Barra de confianza** inmediatamente después: envío a toda Colombia,
   garantía, devoluciones, pago contra entrega
3. Colecciones
4. Piezas seleccionadas
5. Garantías
6. Reseñas
7. Preguntas frecuentes
8. Contacto (única banda oscura, al final, cuando la confianza ya está hecha)

**Requisito de canal, no recomendación:** en el primer viewport móvil deben caber
nombre de marca, categoría, un "desde $X" y el botón de WhatsApp. Lo demás
espera al scroll.

## Componentes

**Botón principal** — cacao sobre claro, píldora, flecha dentro de círculo de
contorno. Siempre la acción principal: "Ver el catálogo". Hover: fondo
`--ink-soft`, sube 2px. Nada rota ni escala.

**Botón secundario** — fondo transparente, borde `rgba(168,134,63,.32)`, texto
cacao. Siempre la acción de conversación: "Escribir por WhatsApp". Hover: fondo
`--bg-arena`.

**Antetítulo** — filete de oro de 32px × 1px seguido de la etiqueta en
mayúsculas, color `--oro-ink`. Reemplaza cualquier insignia tipo badge.

**Tarjeta de colección** — blanco, borde de pelo, radio 2px, imagen 4:5, título
en `h3`, descripción en `--text-secondary`, pie separado por línea de pelo con el
punzón del metal y el enlace de acción. Sin numeración 01/02/03: tres categorías
no son una secuencia; donde iría el número va el metal, que sí informa.

**Banda oscura** — cacao con texto blanco y titulares en `--oro-luz`; marco
interior de 12px en `rgba(227,201,144,.16)`.

## Movimiento

Un solo gesto memorable: el barrido de luz que recorre la imagen del hero una
vez al cargar — girar una pieza de metal bajo la luz. Lo demás es discreto:
fade-up de 0.9s con `cubic-bezier(0.16, 1, 0.3, 1)`, zoom de 1.05 en imágenes al
hover, 2px de elevación en botones.

Siempre respeta `prefers-reduced-motion: reduce` anulando animaciones y dejando
`opacity: 1`. Foco visible obligatorio: `outline: 2px solid var(--oro)` con
`outline-offset: 3px`.

## Copy

Español de Colombia, voz activa, sentence case, sin relleno. El botón nombra lo
que pasa al tocarlo y ese nombre no cambia después ("Ver el catálogo" lleva al
catálogo; "Enviar" produce "Enviado").

Habla de lo verificable: metal, ley, certificado, garantía, tiempo de envío, pago
contra entrega. Los vacíos de escaparate ("clase mundial", "excelencia
artesanal") no dicen nada y restan confianza.

Los errores explican qué pasó y cómo arreglarlo, en la voz de la interfaz, sin
disculparse. Una pantalla vacía es una invitación a actuar.

## Prohibiciones

- **Negro puro `#000` y oro brillante saturado con degradados de fondo.** Es el
  default del sector (Luxora, Armonia y media galería de Behance) y el que más
  desconfianza genera vendiendo por redes. Cacao y oro viejo, siempre.
- **Un segundo acento**, y en particular el rojo `#ea4335` que la landing usaba
  antes: es rojo de producto tecnológico, frío, y arruina toda la calidez.
- **Texto en `--oro` sobre fondo claro** — 3.3:1, no cumple AA. Para eso existe
  `--oro-ink`.
- **Radios de 16–24px, sombras difusas, glassmorphism**, insignias con `//`,
  numeraciones 01/02/03 sin secuencia real. Son el rastro visible de la
  plantilla de agencia que este sistema reemplazó.
- **Playfair Display sobre crema `#F4F1EA` con acento terracota.** Hoy se lee
  como plantilla generada por IA.
- **Inter** como fuente de cuerpo: su neutralidad deja la página sin temperatura.
- **Mezclar fotos de stock con producto real**, o modelos genéricas junto a
  piezas propias. Rompe la confianza de golpe. Una sola luz, un solo fondo,
  coherente con el feed de Instagram.
- **Descuentos en burbuja naranja o con emojis.** El descuento se comunica en
  punzón, con la misma dignidad tipográfica que el resto.
- **Tercera familia tipográfica.** Dos, sin excepciones.

## Antes de dar por terminada una pieza

- Un solo acento dorado, en dosis mínimas.
- Serif solo en titulares y citas; todo lo funcional en Mulish.
- Cero cursivas y cero pesos distintos de 400 en la serif.
- Radio 2px, salvo píldoras en lo que se toca.
- Separado con líneas de pelo, jerarquizado con aire.
- Responsive real hasta 375px, con el dato de confianza visible sin scroll.
- Foco de teclado visible y `prefers-reduced-motion` respetado.
- Contraste AA verificado en cada par texto/fondo.
- Y la regla de Chanel: quítale un accesorio antes de salir.
