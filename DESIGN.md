---
version: alpha
name: Aurem Gs Joyería — Luz de vitrina
description: >-
  Sistema de diseño de Aurem Gs Joyería — joyería de oro 18k, plata 925 y
  platino que vende en Colombia a clientas que llegan desde TikTok, Instagram,
  Facebook y WhatsApp. Úsese siempre que se diseñen o escriban interfaces,
  secciones de landing, componentes, pantallas, mockups o CSS para este
  proyecto — incluso si el pedido es solo "una sección", "un botón" o "cómo
  debería verse esto".
colors:
  primary: "#1C1714"
  primary-soft: "#2A231E"
  secondary: "#FBF7F2"
  surface-sand: "#F2EAE0"
  neutral: "#FFFFFF"
  tertiary: "#A8863F"
  tertiary-ink: "#7A5F26"
  tertiary-light: "#E3C990"
  text-muted: "#6B615A"
  hairline: "#E6DED3"
typography:
  h1:
    fontFamily: "Marcellus"
    fontSize: 4.5rem
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: -0.015em
  h1-mobile:
    fontFamily: "Marcellus"
    fontSize: 3rem
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -0.01em
  h2:
    fontFamily: "Marcellus"
    fontSize: 3.5rem
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: -0.01em
  h2-mobile:
    fontFamily: "Marcellus"
    fontSize: 2.5rem
    fontWeight: 400
    lineHeight: 1.1
  h3:
    fontFamily: "Marcellus"
    fontSize: 1.85rem
    fontWeight: 400
    lineHeight: 1.15
  versalita:
    fontFamily: "Marcellus"
    fontSize: 2.79rem
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: 0.06em
  quote:
    fontFamily: "Marcellus"
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Mulish
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.65
  body-sm:
    fontFamily: Mulish
    fontSize: 0.9rem
    fontWeight: 400
    lineHeight: 1.7
  button:
    fontFamily: Mulish
    fontSize: 0.92rem
    fontWeight: 600
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Mulish
    fontSize: 0.68rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.24em
  punzon:
    fontFamily: Mulish
    fontSize: 0.63rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.16em
rounded:
  none: 0px
  sm: 2px
  pill: 100px
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 96px
  xxl: 112px
components:
  # El hover del primario además sube 2px y toma una sombra ancha y baja.
  # No van como sub-tokens porque el esquema sólo admite backgroundColor,
  # textColor, typography, rounded, padding, size, height y width — el linter
  # rechaza cualquier otra clave. Esos valores viven en la prosa, en
  # Components → Botones.
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 15px 32px
  button-primary-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.neutral}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 15px 32px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.tertiary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  button-secondary-hover:
    backgroundColor: "{colors.surface-sand}"
    textColor: "{colors.tertiary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  punzon:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.tertiary-ink}"
    typography: "{typography.punzon}"
    rounded: "{rounded.none}"
    padding: 0 13px
    height: 24px
  punzon-on-dark:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.tertiary-light}"
    typography: "{typography.punzon}"
    rounded: "{rounded.none}"
    padding: 0 13px
    height: 24px
  card-collection:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 24px 24px 28px
  card-meta:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 0px
  navbar-pill:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 8px 8px 8px 24px
  band-dark:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 112px 64px
  band-dark-accent:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.tertiary-light}"
    typography: "{typography.h2}"
    rounded: "{rounded.none}"
    padding: 0px
  input-dark:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.neutral}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 15px 16px
  submit-dark:
    backgroundColor: "{colors.tertiary-light}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 16px 24px
  divider:
    backgroundColor: "{colors.hairline}"
    height: 1px
    width: 100%
  metal-rule:
    backgroundColor: "{colors.tertiary}"
    height: 1px
    width: 32px
---

# Aurem Gs Joyería — Sistema de diseño

## Overview

Aurem Gs Joyería vende **oro 18k, plata 925 y platino** en Colombia, con envío a
todo el país y pago contra entrega. No tiene tienda física que respalde la
compra ni una marca que la clienta reconozca.

Personalidad: **artesanal · luminosa · precisa.**

La metáfora rectora no es el escaparate nocturno de una marca de lujo: es **la
luz del mostrador**, el momento en que alguien saca una pieza de la vitrina y la
gira bajo la lámpara. Clara, cálida, con el producto arriba de todo.

**El problema que el diseño tiene que resolver.** La clienta llega desde un
video de TikTok o un anuncio de Instagram, en el celular, con medio segundo de
atención y una duda de fondo que casi nunca escribe: *¿esta tienda es real?* No
hay local, ni años de trayectoria, ni una marca conocida que responda por la
compra. El diseño no está para impresionar: está para que esa duda desaparezca
antes de que aparezca. Cada decisión de este documento —el fondo claro, el oro
racionado, la barra de confianza pegada al hero, el punzón— existe para fabricar
esa confianza.

**Alcance: este documento gobierna la LANDING.** El repositorio sirve además el
catálogo, la página de producto y un panel interno en `/admin`. Esas pantallas
**reusan los tokens** —colores, tipografía, radios, espaciado— y **descartan las
reglas de conversión**: el orden de bandas, el requisito del primer viewport y el
presupuesto de oro son de la landing.

**El panel ya tiene su propio documento: [`DESIGN-PANEL.md`](DESIGN-PANEL.md)**,
escrito el 23 de agosto de 2026. Hereda esta identidad entera y cambia lo que la
densidad de una herramienta interna obliga a cambiar — empezando por el tamaño de
cuerpo, que allí baja de 1rem a propósito. Para cualquier pantalla dentro de
`/admin`, manda aquél.

Tres consecuencias que mandan sobre todo lo demás:

1. **Móvil primero, no negociable.** Se diseña la versión de 375px y se expande.
   Si algo solo funciona en escritorio, no entra.
2. **Dos acciones, con jerarquía clara:** ver el catálogo (principal, cacao) y
   escribir por WhatsApp (conversación, contorno de oro). Nada más compite. Un
   tercer botón obliga a bajar uno de los dos a texto.
3. **Lo verificable antes que lo prometido.** Metal, ley, certificado, garantía,
   plazo de envío y forma de pago van arriba; los adjetivos, en ningún lado.

### Marca

La marca tiene dos piezas: el **isotipo AG** —monograma geométrico de cortes
angulares, con la A y la G trabadas— y el **logotipo completo**, que suma la
palabra `AUREM GS` debajo. Los dos llegaron el **2026-08-17** en la carpeta
`Identidad/`, vectorizados automáticamente desde PNG.

- **Lockup:** isotipo solo para favicon, barra de navegación, menú móvil, sello
  del hero y pantallas de administración. El logotipo completo, para empaque,
  documentos y piezas de redes.
- **El isotipo va en `tertiary` sobre fondo claro y en `tertiary-light` sobre
  cacao.** Nunca en negro ni en gris: el oro es lo único que lo ata al resto del
  sistema.
- **El archivo vive en `src/components/Isotipo.jsx`, con los trazados en
  `currentColor`** — no como imagen. Un `<img>` no se puede recolorear desde
  CSS, y este isotipo tiene que cambiar de color según el fondo. **Los `.svg` de
  `public/assets` son copias de respaldo, no la fuente.**
- **El recuadro del SVG está recortado a la caja real del dibujo**
  (`viewBox="140 126 240 171"`). El archivo original medía 512×495 con el dibujo
  ocupando 232×163 en el centro: más de la mitad era aire, y a cualquier tamaño
  la AG se veía diminuta sin que se entendiera por qué. **Si se reemplaza el
  archivo, hay que volver a medir la caja con `getBBox` y recortar**, no
  agrandar el contenedor.
- **El favicon es un cuadrado blanco de radio 12 sobre 64** (~19% del lado), con
  un filete de oro al 35% y la marca al **81% del ancho**. El fondo blanco es lo
  que lo hace visible en la pestaña; el isotipo suelto sobre transparente
  desaparecía.
- **Tamaño mínimo:** isotipo 24px de alto. Por debajo, los cortes angulares se
  cierran y la G se lee como O.
- **Prohibido:** rotarlo, deformarlo, ponerle contorno, sombra o degradado
  metálico, montarlo sobre foto sin caja sólida, o recolorearlo a cualquier
  valor fuera de los dos dorados.

⚠️ **La marca y la tipografía de la interfaz hablan idiomas distintos, y está
sin resolver.** El isotipo es un sans geométrico pesado —moderno, rotundo—; los
titulares van en Marcellus, una romana inscripcional; y el logotipo que trae la
carpeta `Identidad/` usa una serif de transición que no es ninguna de las dos.
Son tres voces. Hoy el choque es tolerable porque el isotipo se usa pequeño y se
lee como sello, no como tipografía. **Deja de serlo en cuanto el logotipo
completo aparezca grande.** La salida recomendada es rehacer la palabra `AUREM
GS` del logotipo en Marcellus; las alternativas —mover los titulares hacia el
mark, o aceptar dos sistemas— están abiertas. *(Registrado el 2026-08-17.)*

### Voz

Español de Colombia, voz activa, sentence case, sin relleno.

**El botón nombra lo que pasa al tocarlo, y ese nombre no cambia después.** "Ver
el catálogo" lleva al catálogo; "Enviar mensaje" produce "Enviado". La misma
acción se llama igual en toda la página: el CTA principal es siempre *Ver el
catálogo*, nunca *Explorar*, *Descubrir* ni *Conocer más*.

**Se habla de lo verificable.** Metal, ley, certificado, garantía, tiempo de
envío, pago contra entrega. Los vacíos de escaparate no dicen nada y restan: la
landing arrastraba *"diseño de joyas de clase mundial"*, *"suscripciones de
diseño"* y *"ellos alcanzaron sus metas"* —texto de plantilla de agencia— y se
borraron enteros el 2026-08-17.

**Los errores explican qué pasó y cómo arreglarlo**, en la voz de la interfaz,
sin disculparse. Una pantalla vacía es una invitación a actuar, no un aviso.

Los valores de color se fijaron desde las referencias del proyecto y desde el
oro del monograma, y se ajustaron para cumplir AA.

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Cacao | `primary` | `#1C1714` | Texto de lectura y bandas oscuras. Es un marrón muy oscuro, **nunca negro puro** |
| Cacao suave | `primary-soft` | `#2A231E` | Hover de superficies oscuras y campos del formulario de contacto |
| Marfil | `secondary` | `#FBF7F2` | Fondo base de secciones. Cálido pero casi imperceptible |
| Arena | `surface-sand` | `#F2EAE0` | Bandas alternas, chips y hover de botones secundarios |
| Blanco | `neutral` | `#FFFFFF` | Lo que contiene producto: tarjetas, fotos, píldora de navegación |
| Oro viejo | `tertiary` | `#A8863F` | Acento decorativo: filetes de 1px, bordes de sello, isotipo, anillos de icono |
| Oro tinta | `tertiary-ink` | `#7A5F26` | **Todo texto dorado sobre fondo claro** |
| Oro luz | `tertiary-light` | `#E3C990` | Oro sobre cacao: titulares de contacto, puntaje de reseñas, botón de envío |
| Humo | `text-muted` | `#6B615A` | Texto secundario. Es un gris **cálido**; uno frío junto al marfil se ve sucio |
| Pelo | `hairline` | `#E6DED3` | Todas las separaciones del sistema |

**El oro está partido en dos tokens y no son intercambiables.** `tertiary` da
**3,3:1** sobre marfil: no llega al 4,5:1 de WCAG 1.4.3 y por eso **no lleva
texto nunca** — es metal decorativo, y como filete de 1px ni siquiera es un
control, así que 1.4.11 tampoco lo alcanza. `tertiary-ink` es el mismo oro
llevado a **5,7:1**, y es el que usan antetítulos, etiquetas de punzón, enlaces
de acción y rótulos del pie. Sobre cacao el que rinde es `tertiary-light`, con
**11,3:1**. Confundirlos es el error más fácil de cometer en este sistema y el
más difícil de ver.

**Regla del acento: un solo metal.** No existe un segundo color de marca. El
rojo `#ea4335` que la landing usaba en botones, círculos y badges se eliminó el
2026-08-17: es rojo de producto tecnológico, frío, y peleaba con todo lo demás.
Sigue definido en `:root` únicamente porque el catálogo y el panel lo heredan;
**en la landing no aparece**.

**Contraste verificado:** cacao sobre marfil 15,4:1 · humo sobre marfil 5,8:1 ·
oro tinta sobre marfil 5,7:1 · blanco sobre cacao 15,5:1 · oro luz sobre cacao
11,3:1. Ningún texto de la interfaz baja de 4,5:1. Si un valor nuevo no llega,
no se usa para texto.

## Typography

Dos familias, una voz cada una.

- **Titulares y citas:** Marcellus. Un solo peso, 400.
- **Todo lo funcional:** Mulish, de 300 a 800. Cuerpo, precios, botones,
  formularios, navegación, especificaciones y punzones.

**Nunca la serif en algo que se toca.** La clienta debe distinguir al instante
lo que se lee de lo que se pulsa, y esa distinción la hace la familia, no el
tamaño.

**La display era Cormorant Garamond hasta el 2026-08-17, y el motivo del cambio
no fue el gusto: se veía frágil.** Cormorant es una Garamond de alto contraste, y
sus trazos finos se deshilachan en pantalla de celular — que es donde ocurre casi
todo el tráfico de esta marca. **La fragilidad trabaja en contra de "confiable"**,
que es uno de los tres adjetivos del encargo. Marcellus es una romana
inscripcional: letra grabada en piedra o golpeada en metal, el mismo gesto que el
punzón. Mismo aire clásico, el doble de cuerpo.

Se descartaron dos alternativas en la misma revisión, montadas sobre el hero
real y no evaluadas de memoria:

| | Parentesco con la marca | Peso en pantalla | Temperatura |
|---|---|---|---|
| Bodoni Moda + Jost | alto — es casi el trazo del monograma viejo | **el más fino de los tres** | frío |
| Fraunces + DM Sans | medio | bueno | **el más cálido** |
| **Marcellus + Mulish** | medio-alto | **el mejor** | cálido |

Bodoni resolvía el parentesco pero empeoraba exactamente el defecto que
motivaba el cambio. Fraunces ganaba en calidez y perdía en permanencia: está de
moda, y lo que está de moda se fecha. Marcellus gana por peso sin costar
calidez.

**El cuerpo era Inter antes del rediseño.** Se cambió porque su neutralidad deja
la página sin temperatura: es la tipografía de una herramienta, no de un taller.

Escala: `h1` 4,5rem con piso de 3rem en móvil · `h2` 3,5rem con piso de 2,5rem ·
`h3` 1,85rem · cuerpo 1rem/1,65 **que nunca baja de 1rem** · antetítulo 0,68rem
en mayúsculas con tracking 0,24em · punzón 0,63rem con tracking 0,16em. El salto
entre el titular y el microtexto es lo que se lee como caro.

### Las versalitas del segundo tiempo

**Marcellus no tiene cursiva ni pesos alternativos, y las dos ausencias son
restricciones del sistema, no descuidos.** Nunca se pide un peso que la fuente no
tiene ni se deja que el navegador incline la redonda por su cuenta: la cursiva
sintética se nota a 72px y delata el descuido.

El segundo tiempo de cada titular —lo que antes iba en cursiva— se resuelve con
**versalitas espaciadas**: mayúsculas al **62%** del tamaño del titular, tracking
**0,06em**, en línea aparte con 0,35em de separación. Así se leen *"no que se
reemplazan"*, *"hacemos"*, *"se siente"*, *"dicen"*, *"frecuentes"* y *"tu
pieza"*.

El contraste entre caja alta y caja baja hace el trabajo que hacía la
inclinación, y le va mejor a una letra lapidaria: una romana inscripcional en
cursiva es una contradicción histórica. **Las citas de clientas y la frase del
pie van en redonda con interlineado 1,55**, que es lo que compensa la falta de
inclinación sin pedirle a la fuente algo que no tiene.

⚠️ **A 375px, `NO QUE SE REEMPLAZAN.` parte en dos líneas.** Si molesta, se baja
el 62% a 55% **solo en móvil**; no se reduce el titular ni se reescribe el copy.

## Layout & Spacing

- Escala base **8px**: 8 / 16 / 24 / 48 / 96 / 112.
- **Aire vertical de sección: 112px en escritorio, 64px en móvil.** Ante la duda,
  más.
- **Márgenes laterales: 64px en escritorio, 24px por debajo de 768px**, con el
  contenido a 1320px centrado en lo que queda.
- **Imágenes de producto en 4:5** dentro de las grillas y a sangre en el hero.
  Las del carrusel son la excepción: 380×260, apaisadas.
- **Radio 2px en todo**, salvo lo que se toca. Ver *Shapes*.
- **Se separa con líneas de un pixel, se jerarquiza con aire.** Ver *Elevation &
  Depth*.
- **Una sola idea por banda.** La página alterna marfil, blanco y —una única
  vez— cacao.

**Orden de la página.** El scroll móvil es el recurso escaso; este es el orden en
que se gasta:

1. **Hero** — antetítulo, titular en dos tiempos, párrafo de tres líneas, los dos
   CTA, el precio desde, y la fila de punzones `18K · 925 · PT950` con su nota.
   A la derecha, la foto en 604×755 con el sello circular montado en el borde
   izquierdo. **En 375px debe verse, sin scroll: la marca, la categoría, el
   "desde $X" y el botón de WhatsApp.** Es un requisito del canal, no una
   recomendación: quien llega de un video decide en esa pantalla.
2. **Barra de confianza** — cuatro columnas sobre blanco separadas por líneas
   verticales: envío a toda Colombia · pago contra entrega · certificado de
   autenticidad · garantía de por vida. **Va pegada al hero, antes de cualquier
   producto**, porque es la respuesta a la duda que trae la visitante. En móvil
   se parte en dos por dos. **Ninguna de las cuatro promete: las cuatro
   informan.**
3. **Colecciones** — tres tarjetas: anillos, collares, pulseras. Imagen 4:5 con
   el punzón del metal montado abajo a la izquierda, título, una línea de
   descripción y el enlace de acción. **Sin numeración `01/02/03`**: tres
   categorías no son una secuencia, y donde iría el número va el metal, que sí
   informa. Cierra con el CTA principal repetido.
4. **Piezas seleccionadas** — banda arena, carrusel continuo inclinado −2°.
   Es la única sección puramente visual de la página y la única inclinación del
   sistema.
5. **Garantías** — tres columnas separadas por línea vertical, cada una con un
   icono de trazo fino dentro de un círculo de 58px con borde de oro. Envío
   seguro · certificación de autenticidad · garantía de por vida. Amplía lo que
   la barra de confianza ya prometió en una línea.
6. **Reseñas** — tarjeta de puntaje en cacao a la izquierda, cuatro citas sobre
   blanco a la derecha. La tarjeta oscura es el primer cacao de la página y
   anticipa la banda de contacto.
7. **Preguntas frecuentes** — acordeón de seis, con la primera abierta.
   Materiales, plazo, garantía, devolución, grabado y personalización: las seis
   objeciones que frenan la compra.
8. **Contacto** — **única banda cacao de la página**, a sangre completa.
   Llega al final, cuando la confianza ya está construida; abrir en oscuro es
   justamente lo que hace el resto del sector.
9. **Pie** — marfil, frase de marca, tres columnas de enlaces y el nombre
   `AUREM GS JOYERÍA` a todo el ancho.

**El corte de temperatura queda: claro ×7 → cacao → claro.** Un solo corte en
toda la página. Cualquier sección nueva va sobre claro, salvo que se le quite el
cacao a contacto.

## Elevation & Depth

**Sombras: ninguna estructural.** La jerarquía viene del contraste de superficie
—marfil, blanco, arena— y de las líneas de un pixel en `hairline`. Tres planos
alcanzan.

La única excepción es el **hover de tarjeta**: `0 24px 50px rgba(28,23,20,.09)`
más 4px de desplazamiento hacia arriba, y el borde que pasa de `hairline` a oro
al 35%. Es una sombra ancha, muy baja y muy tenue: sugiere que la pieza se
levanta de la mesa, no que flota.

**No hay glassmorphism, ni sombras interiores decorativas, ni degradados de
fondo.** El único degradado del sistema es el del punzón —blanco a marfil, para
que el sello parezca troquelado— y el barrido de luz del hero.

### Movimiento

El movimiento existe para dar sensación de material, no para impresionar.

- Transiciones de estado (hover, foco): **300–400ms**, con
  `cubic-bezier(0.16, 1, 0.3, 1)`. Más lentas que en un producto digital normal,
  a propósito: la prisa abarata.
- Entradas al hacer scroll: un fade con 24px de desplazamiento, **una sola vez**.
- Los botones suben **2px** en hover. Nada rota, nada escala.
- Respetar `prefers-reduced-motion`: sin excepciones, y las animaciones de
  entrada quedan en `opacity: 1`, no ocultas.
- **Foco de teclado siempre visible:** `outline: 2px solid tertiary` con 3px de
  separación.

**Presupuesto de movimiento perpetuo: una pieza, y está asignada** — el carrusel
de piezas seleccionadas, 60s por vuelta, en pausa al pasar el cursor. Nada más
se mueve solo.

**El barrido de luz del hero es la única animación memorable y ocurre una vez.**
Una banda diagonal de blanco al 42% recorre la foto 0,9s después de cargar, en
2,4s. Es el gesto de girar una pieza de metal bajo la lámpara — la idea que le
da nombre a la dirección. Se repite en hover, más rápida. **No cuenta contra el
presupuesto perpetuo porque no es perpetua**; si algún día se pone en bucle, sí
lo hace, y entonces hay que discutir el carrusel.

## Shapes

**Radio 2px en todo**: tarjetas, imágenes, campos, punzones, bandas. Casi recto,
apenas suavizado. Los radios de 16 a 24px son el rastro más visible de la
plantilla de agencia que este sistema reemplazó, y no vuelven.

**Radio 100px solo en lo que se toca**: botones y la píldora de navegación. La
forma comunica la función, y esa es toda la lógica del sistema de formas.

**El punzón se recorta en octágono achatado** con `clip-path`, 6px de chaflán en
los cuatro extremos, para leerse como un sello golpeado en metal y no como una
etiqueta de descuento.

**La única inclinación del sistema es la del carrusel** (−2°). Ni las tarjetas,
ni las imágenes, ni las secciones se inclinan. Si todo se inclina, el carrusel
deja de significar algo.

## Components

**Botones.** `button-primary` es cacao sobre claro y lleva siempre la acción
principal. En hover cambia a `primary-soft`, sube 2px y toma
`0 14px 30px rgba(28,23,20,.18)`. `button-secondary` va con fondo transparente
—el token declara marfil porque es el color de sección sobre el que aparece, y
así el contraste queda verificable—, borde de oro y texto en `tertiary-ink`;
lleva siempre la conversación por WhatsApp, con el glifo de la aplicación a la
izquierda.

**El punzón** es el componente firma: el sello de ley que un orfebre golpea
dentro de una pieza. Vive en el hero (18K · 925 · PT950), sobre la foto de cada
tarjeta de colección indicando el metal, y en cualquier sitio donde haya un dato
comprobable. **Si un punzón no dice algo verificable, no se pone** — no es un
adorno ni una etiqueta de oferta.

**Antetítulo.** Filete de oro de 32px × 1px seguido de la etiqueta en mayúsculas
en `tertiary-ink`. Reemplazó a las insignias con `//` de la plantilla anterior.
Abre todas las secciones menos el hero, que abre con el suyo propio sin filete.

**Tarjeta de colección.** Blanco, borde de pelo, radio 2px, imagen 4:5 arriba,
cuerpo con título en `h3`, descripción en `card-meta` y pie separado por
`divider` con el enlace de acción.

**Píldora de navegación.** Blanco al 85% con desenfoque y borde de oro al 35%,
flotando sobre el contenido. En móvil colapsa a isotipo más hamburguesa.

**Banda oscura.** Cacao con texto blanco y titulares en `tertiary-light`. La usan
la sección de contacto y la tarjeta de puntaje de reseñas, esta última con un
marco interior de 12px en oro al 25%. `input-dark` y `submit-dark` son sus
campos y su botón.

**Sello circular.** 126px, fondo marfil, dos anillos de oro, el nombre de la
marca en círculo y el isotipo al centro. Se monta sobre el borde izquierdo de la
foto del hero. Es la versión circular del punzón, no un elemento nuevo.

## Do's and Don'ts

**Sí:**

- Un solo acento dorado, en dosis mínimas.
- Datos verificables en el primer pantallazo: metal, ley, certificado, garantía,
  envío, pago contra entrega.
- Fotografía con una sola luz y un solo fondo, coherente con el feed de
  Instagram de la marca.
- Precio visible, en Mulish, con la misma dignidad tipográfica que el resto.
- Líneas de un pixel para separar; aire para jerarquizar.
- Copy en voz activa que nombra lo que pasa al tocar.

**No:**

- Negro puro, oro brillante saturado y degradados de fondo. Es el default del
  sector y el que más desconfianza genera vendiendo por redes.
- Un segundo color de acento, y en particular el rojo `#ea4335` anterior.
- Texto en `tertiary` sobre fondo claro. Para eso existe `tertiary-ink`.
- Cursivas en la serif, o pesos distintos de 400: el navegador los falsifica y
  se nota.
- Radios de 16–24px, sombras difusas, glassmorphism, insignias con `//`,
  numeraciones `01/02/03` sin secuencia real.
- Playfair Display sobre crema `#F4F1EA` con acento terracota, o Inter como
  cuerpo.
- Una tercera familia tipográfica.
- Mezclar fotos de stock con producto real. Rompe la confianza de golpe.
- Descuentos en burbuja naranja o con emojis. El descuento se comunica en
  punzón.

## Pendientes

Dos cosas que el sistema da por buenas y todavía no lo son:

⚠️ **Falta el precio del hero.** El diseño contempla un "desde $X" bajo los CTA
y **el requisito del primer viewport lo da por presente**. La línea se quitó
antes de publicar el 2026-08-17, porque el número que traía el diseño
—`$380.000 COP`— lo había generado la herramienta y no el negocio. **Cuando
exista el precio real de entrada, vuelve al mismo sitio**, en Mulish 700 a
0,875rem, entre los botones y la línea de pelo. El componente `hero-price` sigue
definido en el CSS a la espera.

⚠️ **Las nueve fotos son de relleno.** Vienen del diseño y encajan con la
dirección —mármol cálido, luz de ventana, oro—, pero no muestran el inventario
real. Cuando existan las fotos de las piezas propias, se fotografían **con esta
misma luz y este mismo fondo** para que el reemplazo sea invisible. Si la clienta
compara la foto del anuncio con la de la web y no coinciden, se pierde
exactamente lo que este documento construye.
