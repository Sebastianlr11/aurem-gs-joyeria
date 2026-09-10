# Certificado de autenticidad

> Estado: implementado el 9 de septiembre de 2026. Falta aplicar la migración a la base.

## Qué resuelve

Una clienta pidió un certificado de su compra y no teníamos ninguno. Pero el valor grande
no está ahí: está **antes** de la venta. El obstáculo de este negocio no es el precio, es
que alguien le transfiera $800.000 a una joyería que encontró en un anuncio. Un documento
verificable contra el dominio del sitio es la prueba que falta, y Valentina puede ofrecerlo
mientras la clienta todavía duda.

De paso, un certificado bonito lo comparte quien recibe un anillo de compromiso.

## Qué certifica — y qué no

En joyería «certificado» son dos cosas, y confundirlas tiene consecuencias:

| | Quién lo emite | Qué dice |
|---|---|---|
| **Gemológico** | Un laboratorio (CDTEC, la Fundación Gemológica) | Quilates, origen, tratamiento de la piedra |
| **Del taller** ← *esto* | Nosotros | Que la pieza salió de aquí, cuándo, en qué metal, y qué respondemos |

Aquí el gemológico se saca sólo cuando la clienta paga el excedente. Este documento es el
segundo: **procedencia y garantía**.

La diferencia no es semántica. Una declaración del vendedor que parezca un dictamen de
laboratorio es publicidad engañosa ante la SIC, y frente a una clienta que sepa de joyas
queda peor que no tener nada. Por eso el documento lo dice por su nombre — `NOTA_LEGAL` en
`src/lib/certificado.js`— y esa frase viaja en la página **y** en la tarjeta.

**Lo que el QR no prueba, para que nadie lo prometa:** que la pieza que alguien tiene en la
mano sea ésa. Un QR se fotocopia. Prueba que el código existe, de qué pieza es y cuándo se
vendió. Como la página enseña la foto real, quien la tiene delante compara — y ésa es la
verificación de verdad.

## Cómo funciona hoy

### Las piezas

| Dónde | Qué |
|---|---|
| `src/lib/certificado.js` | Lógica pura: el código, el congelado, el formato, y los textos del documento. 23 pruebas |
| `supabase/migrations/20260910_cada_pieza_con_su_certificado.sql` | `products.peso_gramos`, la tabla `certificados`, la RPC pública |
| `src/pages/Certificado.jsx` · `.css` | `/certificado/:codigo` — la página del QR |
| `src/pages/admin/certificado/tarjeta.js` | La tarjeta, pintada en un `<canvas>` |
| `src/pages/admin/certificado/DialogoCertificado.jsx` | Emitir, previsualizar, mandar, anular |

### El circuito

1. El pedido llega a **`entregado`**. En Pedidos aparece el icono del certificado (está en
   todos los estados salvo `cancelado` y `devuelto`, pero el diálogo avisa si todavía no
   está entregado).
2. El joyero corrige **peso** y **talla** si hace falta, y emite.
3. Se sortea el código, se congelan los datos y se guarda la fila.
4. La tarjeta se pinta en el navegador. Se ve antes de mandarla.
5. **Mandar por WhatsApp**: sube el JPEG a `product-images/certificados/<codigo>.jpg` y
   llama a `wa-send` con la imagen y el mensaje.

### Por qué nace al entregar

Un contraentrega se puede caer en la puerta y la pieza vuelve al inventario. Un certificado
emitido de una compra que se devolvió queda suelto por ahí, con el nombre de alguien que no
tiene la joya. Y como las entregas de Bogotá las hace el taller, el joyero vuelve, marca
«entregado» y manda el certificado: cierre natural y excusa para escribir otra vez.

Si aun así se devuelve, el certificado se **anula** y la página pública lo dice.

## Decisiones tomadas

**Uno por pedido, no uno por pieza** — y ampara **todas** las piezas. Decisión del taller.
`order_id` queda único de hecho y el diálogo enseña el que ya existe en vez de dejar emitir
dos. La primera versión guardaba una sola pieza en la raíz de `datos` porque entonces un
pedido llevaba una; el mismo día el formulario aprendió a llevar varias y el primer
certificado de un pedido de dos amparó sólo el anillo. Desde el 9 de septiembre de 2026
`datos.piezas` es una lista.

**Los certificados ya emitidos NO se migran.** Un documento con fecha no se reescribe hacia
atrás — es justo lo que congelar los datos viene a impedir. `piezasDe()` lee los dos
formatos, en un solo sitio, y el CHECK de la tabla acepta los dos.

**Los datos van congelados en un `jsonb`.** Mismo motivo que `order_items` congela los
precios. Si el certificado leyera `products` al vuelo, corregirle el metal a una pieza
reescribiría hacia atrás un documento que ya está impreso en la casa de alguien.

**El código es al azar, no consecutivo.** Un «N.º 003» le cuenta a la clienta que es la
tercera compra de la historia de la joyería. Y un consecutivo se adivina: bastaría cambiar
el último dígito para pasearse por los certificados de los demás. `AG-` + 8 caracteres de
un alfabeto **sin 0/O ni 1/I/L**, porque el código se lee en voz alta por WhatsApp y se
teclea desde una tarjeta impresa.

**Sólo el nombre de pila, y nunca el precio.** La página es pública para quien tenga el
enlace. Un apellido más una joya de varios millones es más de lo que hace falta contar a un
desconocido.

**Ningún campo vacío.** La referencia impresa que circula por ahí tiene doce renglones con
puntitos para llenar a mano. Éste se genera, así que lo que no se sabe no aparece: una
línea en blanco en un certificado lo desmiente. `campos()` decide.

**Una sola cara.** En WhatsApp la segunda imagen no la abre nadie. La tarjeta es la
invitación; el documento completo vive en la página del QR.

**La tarjeta se pinta en el navegador y no en una Edge Function.** El panel ya tiene las
fuentes de la marca, la sesión y un canvas. Una función en Deno necesitaría una librería de
imágenes, las fuentes empaquetadas aparte y un despliegue por cada coma del diseño — y no
dejaría ver el resultado antes de mandarlo, que es lo que uno quiere de un documento con el
nombre de una clienta encima.

**Las garantías se copian de la política, no se reescriben.** Ver §11 de `CLAUDE.md`.

**La página va con Navbar y Footer.** Quien escanea muchas veces no es la clienta sino a
quien le regalaron la pieza, y ése acaba de conocer la marca.

**`noindex` + `robots.txt`.** Lleva el nombre de pila de una clienta y la joya que compró.

## Límites conocidos

- **No hay pantalla para buscar un certificado por código.** Se llega por el enlace o
  escaneando. Quien tenga una tarjeta impresa y quiera teclear el código a mano tiene que
  escribir la URL entera. `normalizarCodigo()` ya acepta todas las formas en que alguien lo
  escribiría; falta el formulario.
- **Compartir el enlace por WhatsApp da la tarjeta genérica del sitio.** El desvío de
  `vercel.json` a `api/ficha.js` sólo cubre las fichas de producto. Un certificado
  compartido no enseña de qué pieza es.
- **La versión impresa no existe todavía.** El diseño ya está pensado a dos caras para
  cuando se imprima; hoy sólo hay una.
- **El peso lo llena el taller pieza por pieza.** Ahí está el costo real de esto, y no en
  el código. Sin peso la línea no sale.
- **Anular es de una sola dirección.** No hay «desanular» en el panel; se arregla con un
  `UPDATE`.

## Cómo probarlo

**Las cuentas y los formatos** — `npx vitest run src/lib/certificado.test.js` (23 pruebas).

**La tarjeta, mirándola.** Levanta `npm run dev` y monta un HTML en la raíz que importe
`/src/fuentes.css` y `pintarTarjeta()` de `/src/pages/admin/certificado/tarjeta.js` con un
certificado de mentira, y añade el canvas al `body`. Es lo único que responde «¿se ve como
un certificado?».

**El QR, decodificándolo.** Mirarlo no vale: un QR sin zona de silencio se ve impecable y
no se lee. Saca el `toDataURL('image/png')` del canvas y pásalo por `jsqr` — con la tarjeta
entera y también reducida a 320 px de ancho, que es lo que queda de ella en un celular. El
9 de septiembre de 2026 se leyó bien a 1080, 540, 400 y 320.
