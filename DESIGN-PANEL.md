---
version: alpha
name: Aurem Gs — Panel interno
description: >-
  Sistema de diseño del panel de administración de Aurem Gs Joyería (/admin):
  dashboard, catálogo, pedidos, clientes, conversaciones de WhatsApp, reportes,
  anotaciones y ajustes. Hereda los tokens de DESIGN.md y cambia las reglas que
  la landing impone para vender. Úsese siempre que se diseñe o modifique
  cualquier pantalla, componente o CSS dentro de /admin.
extends: DESIGN.md
scope: src/panel.css, src/pages/admin/**
colors:
  inherited: DESIGN.md
  estado-punto-neutro: "#F2EAE0"
  estado-punto-curso: "rgba(168,134,63,0.45)"
  estado-punto-activo: "#A8863F"
  estado-punto-cerrado: "#1C1714"
  error-ink: "#8C2F1E"
  error-ink-oscuro: "#5E2114"
  error-fondo: "#FBEDE9"
typography:
  antetitulo:
    fontFamily: Mulish
    fontSize: 0.68rem
    fontWeight: 700
    letterSpacing: 0.24em
    textTransform: uppercase
  dato:
    fontFamily: Mulish
    fontSize: 0.75rem
    fontWeight: 600
  cuerpo:
    fontFamily: Mulish
    fontSize: 0.82rem
    fontWeight: 400
    lineHeight: 1.5
  enfasis:
    fontFamily: Mulish
    fontSize: 0.95rem
    fontWeight: 700
  titulo-seccion:
    fontFamily: Marcellus
    fontSize: 1.85rem
    fontWeight: 400
  cifra:
    fontFamily: Mulish
    fontSize: 2.5rem
    fontWeight: 800
spacing:
  base: 4px
  escala: [4, 8, 12, 16, 24, 32, 48]
shape:
  radius: 2px
  radius-pildora: 100px
  radius-avatar: 50%
---

# Aurem Gs — Panel interno

## Para quién es esto

`DESIGN.md` diseña para una desconocida que llega de TikTok con medio segundo de
atención y una duda: *¿esta tienda es real?* Todo allí existe para fabricar
confianza.

**Aquí no hay nada que demostrar.** Quien usa el panel es el joyero o alguien
del equipo, en un portátil, muchas veces al día, haciendo trabajo repetitivo y
casi siempre con prisa: despachar lo de hoy, contestar a quien lleva veinte
minutos esperando, anotar lo que costó una pieza. Ya confía en la tienda: es
suya.

Eso cambia el objetivo por completo. La landing se juzga por si convence; el
panel, por **cuánto tarda alguien en ver lo que tiene que hacer y hacerlo sin
equivocarse**. Un panel bonito que obliga a leer tres veces una cifra es un
panel malo.

De ahí sale la única regla que manda sobre las demás:

> **La densidad es una función, no un descuido.** En el panel cabe más
> información por pantalla que en la tienda, a propósito, porque el trabajo es
> comparar y decidir. Lo que en la landing sería agobio, aquí es no tener que
> desplazarse.

## Qué hereda y qué descarta

**Hereda, sin excepciones, la identidad:** la paleta entera, las dos familias
tipográficas, Marcellus sólo en peso 400, nunca negro puro, el radio de 2px, y
separar con líneas de pelo antes que con sombras. El panel se abre desde la
misma marca; que parezca otro producto sería mentir sobre quién lo hizo.

**Descarta las reglas de conversión de la landing**, que aquí no significan nada:

| Regla de la landing | En el panel |
|---|---|
| Orden obligatorio de bandas | No hay bandas. Hay secciones conmutadas por el riel lateral. |
| Todo lo importante en el primer viewport móvil | El panel se usa en portátil. El móvil es para consultar, no para trabajar. |
| Presupuesto de oro: acento racionado | El oro marca **estado**, no decora. Puede aparecer más veces, siempre con significado. |
| Cuerpo nunca menor de 1rem | **Aquí sí**, y es deliberado. Ver abajo. |
| Dos acciones con jerarquía clara | Cada sección tiene su acción principal, pero conviven muchas secundarias. |

### El tamaño de letra, que es la divergencia de fondo

`DESIGN.md` prohíbe el cuerpo por debajo de 1rem porque su lectora está en un
celular, con una mano, y cualquier esfuerzo la pierde. **El panel usa 0,82rem de
cuerpo y no es una regresión**: se lee en un portátil, a 50 cm, por alguien que
vuelve doce veces al día a la misma tabla. Bajar el cuerpo es lo que permite ver
quince pedidos sin desplazarse, y ver quince pedidos de una vez es exactamente
el trabajo.

El límite: **0,68rem es el mínimo absoluto**, y sólo para antetítulos en
mayúsculas con tracking amplio, que se leen como etiqueta y no como texto. Nada
por debajo. Nada de texto corrido bajo 0,78rem.

## Tokens

**No hay paleta del panel.** Son los mismos tokens de `DESIGN.md`, usados como
variables y nunca escritos a pelo. Lo que sí es propio del panel son dos juegos
que la tienda no necesita:

### El estado de un pedido

Un pedido pasa por siete estados y hay que distinguirlos de un vistazo, en una
tabla, sin leer. La solución obvia —un color por estado— produce un arcoíris que
contradice la marca entera y que además nadie memoriza.

**La solución del panel: todas las insignias son iguales y el estado va en un
punto.** Fondo blanco, tinta cacao, y un círculo de 7px con línea de pelo delante:

| Punto | Significa | Color |
|---|---|---|
| Arena | Todavía no arranca (`pendiente`) | `--bg-arena` |
| Oro al 45% | Va en camino (`pagado`, `procesando`) | `rgba(168,134,63,.45)` |
| Oro pleno | Pide atención ahora (`enviado`) | `--oro` |
| Cacao | Cerrado y bien (`entregado`) | `--ink` |
| Hueco | Cerrado y mal (`cancelado`) | `--bg-color` con borde |

Se lee por **intensidad**, no por matiz: cuanto más oscuro el punto, más avanzado
el pedido. Funciona en escala de grises y para quien no distingue colores, que es
justo lo que un arcoíris no hace.

### El error

Los tonos de error de la marca, que no están en `DESIGN.md` porque la landing casi
no falla:

- Tinta del error: `#8C2F1E` · Tinta grave: `#5E2114` · Fondo: `#FBEDE9`

**Nunca `--accent-red` (`#ea4335`).** Sigue definido en `index.css` por herencia
del diseño anterior y `DESIGN.md` lo prohíbe: es rojo de producto tecnológico,
frío, y rompe la calidez de todo lo demás.

## Tipografía

Seis pasos, y con seis basta. La escala de la landing no sirve aquí: sus tamaños
arrancan donde los del panel terminan.

**Diez pasos, y ni uno más.** Seis de texto y cuatro de titular:

| Paso | Tamaño | Familia | Uso |
|---|---|---|---|
| Antetítulo | 0.68rem · 700 · tracking 0.24em · mayúsculas | Mulish | Rótulos de sección, cabeceras de tabla, etiquetas |
| Dato | 0.75rem · 600 | Mulish | Metadatos, fechas, contadores, pies de tarjeta |
| Cuerpo | 0.82rem · 400 · alto 1.5 | Mulish | Texto de tablas, formularios, listas |
| Énfasis | 0.95rem · 700 | Mulish | Nombre de una pieza, de una clienta, de un pedido |
| **Campo** | **1rem** | Mulish | **Los `input`. No bajar de aquí nunca** — ver abajo |
| Subtítulo | 1.15rem | Mulish | Encabezado dentro de una tarjeta |
| Título pequeño | 1.35rem | Mulish / Marcellus | Títulos de modal |
| Título | 1.6rem | Marcellus | |
| Título de sección | 1.85rem · 400 | **Marcellus** | El encabezado de cada pantalla |
| Cifra | 2.5rem · 800 | Mulish | Dinero y conteos en las tarjetas del dashboard |

Aparte quedan ocho `clamp()` para los titulares grandes, que son responsivos a propósito
y no entran en la escalera, y las **versalitas** en unidades relativas (`0.62em`), que
heredan del tamaño de su titular como manda `DESIGN.md`.

> ⚠️ **El paso de 1rem existe por una razón que no es estética: por debajo de 16px,
> Safari en iPhone hace zoom automático al enfocar un `input`.** Bajar `.admin-login-input`
> o `.ep-confirmar input` a 0.95rem le mueve la pantalla a la clienta cada vez que toca un
> campo. Si alguna vez parece que ese 1rem "rompe la escala", no lo toques: la escala se
> hizo alrededor de él.

**Marcellus sólo en los títulos de sección, y sólo en 400.** Es lo que ata el
panel a la marca; usarla para datos la convertiría en decoración y haría el panel
más lento de leer. Las cifras van en Mulish 800 a propósito: un número es un dato,
no un titular.

**Las versalitas espaciadas de la landing sí se usan**, en el mismo sitio que
allá: la segunda línea del título de sección. Es el gesto que hace que el panel se
reconozca como parte de la misma casa.

## Espaciado y forma

**La escala es de 4px, no de 8.** Es la consecuencia directa de la densidad: con
saltos de 8px, una tabla de quince filas gana 120px de aire que no aporta nada y
saca una fila de la pantalla. Escala: **4 · 8 · 12 · 16 · 24 · 32 · 48**.

Los 96 y 112px de la landing no existen aquí. El respiro entre secciones del panel
es 32px, no 112.

**En rem o en px, pero no en los dos.** Se usa `rem` para lo tipográfico
(padding de botones, campos, texto) y `px` para lo estructural (anchos de riel,
alturas de barra, grosores). Mezclarlos dentro del mismo componente es lo que
produjo la ensalada actual.

**Forma:** radio **2px** en todo —tarjetas, campos, tablas, modales—, **100px**
sólo en lo que se pulsa —botones, píldoras, filtros de riel— y **50%** en avatares.
Nada más. Los radios de 10, 12, 16 y 20px que hay hoy son del diseño anterior.

**Separar con línea de pelo, no con sombra.** La sombra se reserva para lo que
flota de verdad: modales (`0 14px 30px rgba(28,23,20,.18)`) y el anillo de foco
(`0 0 0 3px rgba(168,134,63,.12)`). Una tarjeta no flota.

## Componentes

El panel ya tiene su vocabulario. Esto lo nombra; no lo inventa.

**Riel lateral** (`.admin-sidebar-*`) — cacao a sangre, 260px, el logotipo arriba
y la sesión abajo. El ítem activo es una píldora clara, no una barra de color: la
misma forma que los botones, porque también se pulsa.

**Barra superior** (`.admin-topbar-*`) — clara, 64px, con el nombre de la sección
a la izquierda y las acciones globales a la derecha. Es la única franja que
sobrevive al desplazamiento.

**Tarjeta de sección** — blanco, borde de pelo, radio 2px. Cabecera con antetítulo
a la izquierda y una etiqueta a la derecha. Sin sombra.

**Banda de cifras** (`.inf-kpi-*`, `.jornada-dinero-*`) — sobre cacao, cifras en
Mulish 800 y rótulo en antetítulo. Es el único sitio del panel donde se usa fondo
oscuro, y por eso funciona: dice "esto es el resumen".

**Insignia de estado** (`.status-badge`) — ver arriba. Nunca un color de fondo por
estado.

**El punzón** (`.punzon`) — el mismo de la tienda, y con la misma regla: sólo donde
hay un dato **comprobable** (18K, 925, una referencia `AG-9089`, un número de guía).
Si no dice un dato verificable, no se pone.

**Tabla** — cabecera en antetítulo, filas separadas por línea de pelo, sin cebra.
El dinero alineado a la derecha y en tabular. La fila entera es pulsable si lleva a
un detalle; entonces el hover es `--bg-marfil`, no un borde.

**Modal** (`.pd-*`, `.pm-*`) — el trabajo de verdad pasa aquí. Cabecera fija con el
título, cuerpo con desplazamiento propio, pie fijo con el estado de lo que falta y
el botón principal. **El pie nombra lo que falta en vez de sólo apagar el botón**:
un botón gris sin explicación obliga a repasar catorce campos buscando cuál es.

**Chat** (`.chat-*`) — la burbuja de la clienta a la izquierda, blanca y con línea de
pelo; la nuestra a la derecha, en cacao. Lo que escribe una persona del equipo se
distingue de lo que escribe Valentina; esa diferencia es información operativa, no
estética.

> **La única excepción al radio de 2px, y es a propósito.** Las burbujas llevan 16px,
> con la esquina inferior del lado que habla cortada a 5px. Una burbuja de chat con
> esquinas rectas no se lee como una conversación: la forma redondeada es la convención
> que hace que un hilo parezca un hilo. Aplicar aquí la regla de la marca sería
> cumplirla contra su propio propósito.

## Movimiento

Menos que en la landing. El barrido de luz del hero no tiene equivalente aquí: en
una herramienta que se abre doce veces al día, una animación de entrada se vuelve
un peaje.

- Transiciones de 0.2s a 0.3s en hover y foco. Nada más lento.
- **Sin animaciones de entrada** en tablas ni listas. Los datos aparecen.
- El único movimiento con sentido es el que confirma una acción: el guardado, el
  cambio de estado, el mensaje que sale.
- `prefers-reduced-motion: reduce` anula todo y deja `opacity: 1`.
- Foco visible obligatorio: `outline: 2px solid var(--oro)` con `outline-offset: 3px`.

## Copy

Español de Colombia, igual que la tienda, pero **el panel habla de trabajo, no de
joyas**. Nombra lo que pasa y lo que falta:

- «Nada por confirmar, nada por despachar y ningún chat esperando» dice más que
  «Todo al día».
- Los avisos explican la consecuencia: «Hay pauta corriendo y pedidos sin costo
  anotado, así que la utilidad de abajo sale corta».
- Los estados vacíos son una invitación a actuar, no un encogimiento de hombros.
- **Nunca una cifra sin decir sobre qué está calculada.** Si un margen sale de tres
  de cinco pedidos, se dice: «sobre 3 de 5».

## Do's and Don'ts

**Sí**

- Usa las variables. Cualquier color escrito a pelo es deuda.
- Antes de añadir un tamaño de letra, comprueba si uno de los seis sirve.
- Un punto de estado antes que un color de fondo.
- Di sobre qué está calculada cada cifra.
- Comprueba el cambio midiendo, no mirando: 24 propiedades calculadas de cada
  elemento, antes y después. Ver `docs/pendientes.md` #16.

**No**

- Un color por estado. Ni el arcoíris de Tailwind (`#dc2626`, `#f59e0b`, `#1d4ed8`…).
- `#D4AF37` ni `#B8860B`: son oro brillante y el oro de esta casa es `#A8863F`.
- `#1A1A1A` ni ningún negro: la tinta es `#1C1714`.
- Grises fríos (`#888`, `#aaa`, `#666`): el gris de apoyo es `--text-secondary`.
- Marcellus para datos, cifras o botones.
- Sombras para separar. Para eso está la línea de pelo.
- Radios de 8, 10, 12, 16 o 20px.

## Lo que hoy no cumple este documento

Medido sobre `src/panel.css`. La primera columna es lo que había el 23 de agosto por la
mañana; la segunda, lo que queda después de la limpieza de esa tarde.

| Qué | Había | Queda | Nota |
|---|---|---|---|
| Colores escritos a pelo | 491 | **45** | 446 pasaron a `var()` |
| `#D4AF37` (oro brillante) | 19 + 21 en `rgba()` | **0** | Prohibido por `DESIGN.md` |
| `#B8860B` (otro oro) | 12 | **0** | Ídem |
| Degradados de oro | 5 | **0** | `DESIGN.md` los prohíbe; ahora es oro plano |
| `#1A1A1A` / `#1A1A1E` / `#111` | 23 | **0** | La tinta es `--ink` |
| `#0C1220` (azul del diseño viejo) | 4 | **0** | → `--ink` |
| Grises fríos (`#888`, `#aaa`, `#666`…) | ~44 | **0** | → `--text-secondary` / `--text-muted` |
| Rojos y ámbares de Tailwind | 30 | **0** | → `--error-ink` / `--oro` |
| `--accent-red` | 3 | **0** | El token queda definido pero ya no lo usa nadie |
| Tamaños de letra distintos | **65** | **10** | Eran 65, no 16: la cifra vieja contaba sólo los más usados |

**Y los tonos de error dejaron de ser hex sueltos:** `--error-ink` (`#8C2F1E`),
`--error-fuerte` (`#5E2114`) y `--error-fondo` (`#FBEDE9`) son tokens en `:root`. Estaban
escritos a mano en 42 sitios.

**Lo que se ganó no fue sólo coherencia, fue contraste.** Los grises fríos que había
—`#888` sobre `#fafafa`— daban **3,40:1, por debajo de AA**. El gris cálido de la marca da
**4,85:1** y pasa. El botón de borrar subió de 4,41 a 7,52.

**Y la escalera tipográfica quedó hecha.** 247 declaraciones se acercaron a su paso más
próximo. Verificado sobre **2.892 elementos en siete pantallas**: 1.120 cambiaron de
tamaño —era el objetivo— y **cero desbordes nuevos**. Los saltos mayores fueron **hacia
arriba**: había etiquetas a 9,6px y el suelo ahora es 10,88px.

**Los 45 que quedan no son deuda: son decisiones.** De los 202 que quedaban por la mañana
se mapearon 157, y los que siguen escritos a pelo están ahí a propósito, en tres grupos:

- **Colores que codifican un estado** (26 valores): el verde del «modo IA», el de «pagado»,
  el azul de «procesando», el ámbar del modo manual, los rosados de «va mal». Cambiarlos al
  token más cercano los vuelve grises y **les quita el significado**. Lo correcto no es
  cambiarles el color: es pasarlos al **punto de intensidad** que define este documento, y
  eso es tocar componentes, no colores.
- **El gris de los acuses de WhatsApp** (`#8696A0`, `#9CA3AF`), que imita los ticks de la
  aplicación real. Cambiarlo rompe el reconocimiento.
- **Los de terceros y los especificados**: el verde de WhatsApp (`#25D366`, `#1EBE5D`), el
  verde de «resuelto» (`#2E5D46`) y el degradado del punzón (`#241E1A`, que `DESIGN.md`
  fija).

**Cómo se decidió cada uno, que es lo que hace que esto no sea un reemplazo a ciegas.** El
mapeo mira tres cosas, no una:

1. **La distancia** al token, con pesos perceptuales — no aritmética RGB plana.
2. **El papel**: un separador va a `--hairline`, un fondo a los fondos, una tinta a las
   tintas. Sin esto, un gris neutro de separador acabó una vez en el rosa de error sólo
   porque el número decía que estaba cerca.
3. **El tono**: al oro sólo pueden llegar colores que ya eran cálidos (18°–62°). Sin esto,
   un gris **azulado** de texto aterrizaba en oro pálido y dejaba de leerse como texto de
   apoyo. Al final sólo dos ámbares del aviso de modo manual fueron a oro, que es
   exactamente donde este documento lo pone.

Verificado sobre **3.427 elementos en ocho pantallas**: 78 cambiaron de color —los
buscados—, **cero contrastes por debajo de AA** calculando la transparencia compuesta, y
**cero desbordes**.

## Cómo se probó lo que dice este documento

Nada de aquí sale de una opinión sobre cómo debería verse un panel. La escala
tipográfica, los radios, los espaciados y la lista de deudas salen de contar lo
que hay en `src/panel.css`. La regla del punto de estado no se inventó: ya estaba
implementada, ganándole a la versión de colores.

Cuando cambies algo de este archivo, mídelo igual.
