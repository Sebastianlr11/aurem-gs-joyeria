# Envíos — 99envios

> **Estado:** fase 1 en producción · fase 2 desplegada, **sin estrenar con un pedido real**
> **Última revisión:** 2026-08-24
> **Dónde vive:** `supabase/functions/cotizar-envio/index.ts` · `src/lib/envio.js` ·
> `public.ciudades_envio` y `public.codigo_dane()`

## Qué resuelve

Hoy el abono del envío son **$20.000 fijos**, vaya el paquete a Chapinero o a Leticia, y
`costo_envio` se escribe a mano después del despacho — por eso está casi siempre vacío y
Reportes avisa de que no puede decir qué pieza deja más. Esto trae el número real de las
cinco transportadoras **antes** de prometer nada.

## Lo que esta API NO puede hacer

**No hay rastreo.** Se revisó la especificación entera: cero menciones de rastreo,
tracking, estado de guía, entregado o webhook. Los seis endpoints son login, cotizar,
preenvío, PDF y las dos de novedades.

Así que **el objetivo original —que la transportadora confirme la entrega y el panel marque
`entregado` solo— no se puede con esto**, y probablemente esté bien: ese clic es el que
declara que entraron los $530.000 de un contraentrega. Ver
[admin-pedidos.md](admin-pedidos.md).

## Cómo funciona hoy

| Pieza | Qué hace |
|---|---|
| `cotizar-envio` | Pide sesión de admin, traduce la ciudad, arma la caja y cotiza |
| `ciudades_envio` | Los 1.273 municipios con su código DANE, más alias |
| `codigo_dane(ciudad, depto)` | Traduce lo que escribió la clienta. **Calla si duda** |
| `src/lib/envio.js` | Qué caja usa una pieza: la suya, o la de la casa |
| `crear-guia` | Pide la guía. **Crea algo real y se factura** |
| `src/lib/nombre.js` | Parte el nombre en nombre y apellidos, que la guía pide por separado |
| `ShipModal` | «Cuánto cuesta mandarlo», las cinco opciones y «Pedir la guía» |

### La ciudad

99envios trabaja con el código DANE —Bogotá es `11001000`— y el checkout guarda la ciudad
como texto libre. `codigo_dane()` traduce, con este orden: nombre + departamento; si no,
sólo el nombre y **sólo si es inequívoco en todo el país**; si no, nada.

Callar es deliberado: 80 nombres se repiten en departamentos distintos y una guía emitida al
municipio equivocado es un paquete perdido y un flete pagado.

**Hubo que añadir los nombres que la gente sí escribe.** La lista llama a la capital
«BOGOTA D.C.» y ninguno de los 18 pedidos decía eso: decían «Bogotá», «BOGOTA» o «bogota».
No resolvía ni uno, y lo destapó probar contra los pedidos reales, no contra casos
inventados.

### La caja

`cotizar` y `preenvio` piden peso en **kilogramos** y medidas en **centímetros**, y
`products` no tenía ninguna de las cuatro. Van en dos sitios: `taller_precios` guarda la
caja por defecto —casi toda la joyería viaja igual— y `products` la excepción, con las
columnas nulas cuando no la hay.

**Los valores iniciales son un punto de partida, no una medición**: 1 kg y 15×12×6 cm. El
kilo es el mínimo que facturan las transportadoras en Colombia. Hay que medir el empaque
real: quedarse corto se paga en el flete y pasarse infla la cotización por peso volumétrico.

`null` nunca viaja como cero. Un peso de cero no es un paquete ligero, es una cotización
rechazada o —peor— aceptada con un flete que no corresponde.

### El token

99envios da un JWT a cambio de correo y contraseña, que viven en los secretos de Supabase
(`ENVIOS99_EMAIL`, `ENVIOS99_PASSWORD`). Se guarda **en memoria del proceso, no en la base**:
es una credencial y la base la leen más manos que esta función. Se renueva a las 20 horas o
cuando la API contesta 401, y el reintento es uno solo — dos serían un bucle contra la API
de un tercero.

### Los frenos

- **Pide sesión de admin.** Son 300 cotizaciones por hora para toda la cuenta; dejarlo
  abierto es regalar ese cupo.
- **Se cotiza a mano**, con un botón, no al abrir el diálogo. Por lo mismo.
- **`AplicaContrapago` va en `false`.** Que la transportadora cobre por nosotros es una
  decisión de negocio sin tomar, y cambiaría cómo entra el dinero: cobran entre $2.500 y
  $3.500 por hacerlo.

## Quién cobra, y cuánto cuesta que cobren

Su plataforma avisa de algo que no está en la especificación y que cambia el diseño entero:

> «Si decides realizar la guía **sin contra pago**, se generará un **cobro directo a tu
> saldo**. La anulación y devolución puede tomar entre **7 y 15 días hábiles**.»

La primera versión salió con `AplicaContrapago: false` —el ajuste caro— porque se leyó el
contrapago como una decisión de negocio pendiente. No lo es: **es el modelo que ya hay**. En
un contraentrega el mensajero ya cobra el saldo en la puerta; encenderlo no cambia nada
salvo quién emite la guía.

Con contrapago encendido no hay cobro por adelantado: la transportadora cobra en la puerta y
gira lo recogido **menos** el flete y su comisión.

### `valorDeclarado` hace dos cosas a la vez

Es el valor asegurado **y**, con contrapago encendido, lo que el mensajero va a cobrar. Para
un contraentrega eso **no es el precio de la pieza**: la clienta ya pagó el abono en línea,
así que se manda el **saldo**. Poner el total le cobraría el envío dos veces.

Un pedido pagado en línea va sin contrapago —no hay nada que cobrar— y ahí el flete sí sale
del saldo, que es correcto: no hay quien lo pague en la puerta.

### Lo que cuesta de verdad

Cotización real a Bogotá, pieza de $500.000, mensajero cobrando $480.000:

| | Total | Flete | Cobrar en la puerta |
|---|---|---|---|
| Coordinadora | **$33.332** | $11.732 | $21.600 |
| Servientrega | $33.970 | $13.810 | $20.160 |
| Envía | $34.171 | $14.011 | $20.160 |
| TCC | $49.111 | $28.471 | $20.640 |

**La comisión por cobrar en la puerta es casi el doble que el flete.** Y el `total` la
omitía: se sumaban flete, sobreflete y comisión interna, pero no `valor_contrapago`. Un
total al que le falta un costo es exactamente el fallo que se estuvo persiguiendo tres días
en los informes — un número redondo, creíble y corto. Corregido, y la pantalla enseña el
desglose.

**Para el negocio:** despachar un contraentrega de $500.000 a Bogotá cuesta unos $33.000,
casi un 7 % de la venta, y el abono de $20.000 no lo cubre.

### Los seguros antidevolución

Sin ninguno, una entrega fallida cobra el flete **de ida y de vuelta**; con el básico, sólo
el valor del seguro. En un negocio de contraentrega la devolución es *el* riesgo, así que se
enciende desde los secretos sin desplegar (`ENVIOS99_SEGURO` = `basico` o `plus`), y viene
**apagado** porque encenderlo cuesta plata en cada envío y es decisión del negocio.

### Interrapidísimo, y por qué un $0 no es un envío gratis

Por la API, Interrapidísimo responde:

> «no cuenta con un codigo inter asociado para realizar esta cotización»

En el panel web de 99envios, la misma cuenta y el mismo destino la enseñan con **«Costo del
envío: $0»**. Es tentador leer eso como gratis. **No lo es**, y lo explica 99envios en uno
de sus propios videos: un $0 en Interrapidísimo significa que **el código de convenio
todavía no está generado**. Interrapidísimo tarda uno o dos días hábiles desde que se abre
la cuenta —es la única de las cinco que lo pide— y mientras tanto **no se pueden emitir
guías con ellos**.

O sea: el error de la API y el $0 del panel son **lo mismo**, dicho de dos formas. No hay
nada que pedirle a soporte salvo que pasados dos días hábiles siga igual, que ya sería un
error en los datos de la cuenta.

**Y por eso un flete en cero se trata como «no cotizó».** Si se colara como opción se
ordenaría la primera por ser la más barata, se elegiría, y la emisión fallaría después —
enseñando de paso un ahorro que no existe. Esta lectura equivocada llegó a escribirse en
esta misma spec antes de ver el video; queda como aviso de lo fácil que es.

Todo esto se supo porque se dejó de esconder. La primera versión filtraba en silencio las
que devolvían `exito: false`, así que la lista enseñaba cuatro transportadoras y **se veía
completa**. Una lista que se calla una opción no está incompleta: engaña. Ahora las que no
cotizan salen con su motivo.

**`efectividad` no viene por la API.** Su panel enseña el porcentaje de entregas logradas
por ciudad —88 %, 89 %, 81 %— y es de lo más útil que dan, pero la respuesta de la API no lo
trae. El campo se lee por si algún día aparece.

### Un mínimo de Interrapidísimo

**Sin contrapago, Interrapidísimo exige un valor declarado de $60.000 o más.** Con las
piezas de hoy —la más barata son $500.000— no muerde, pero la cotización ya lo aguanta sin
romperse: una transportadora que no puede cotizar viene con `exito: false` y simplemente no
aparece en la lista.

## Fase 2: pedir la guía

`crear-guia` es distinta de todo lo demás del panel: **crea algo en el mundo real**, una
guía que se factura y que un mensajero va a ir a recoger. Por eso empieza por lo que se
niega a hacer:

| No emite si… | Por qué |
|---|---|
| el pedido es `es_prueba` | Probar el panel no puede costar un flete |
| el pedido ya tiene guía | Dos guías son dos fletes y un mensajero que llega dos veces |
| el nombre no trae apellido | El rótulo lo lee una persona; un apellido inventado no se entrega |
| falta dirección o teléfono | Ídem |
| la ciudad no se traduce | Una guía al municipio equivocado es un paquete perdido |
| la transportadora no es una de las cinco | — |

Los cuatro primeros se comprobaron contra producción: los cuatro devuelven su error y
**ninguno llega a pedir nada**.

**Anota antes de devolver.** La guía ya existe y se va a cobrar, así que transportadora,
número y flete se guardan en el pedido nada más tener respuesta: si el panel no lo anotara
porque alguien cerró el diálogo, quedaría pagada y perdida. Si el guardado falla, la
respuesta trae el número para copiarlo a mano.

**No despacha.** No toca el estado, no manda el correo ni el WhatsApp. Eso sigue siendo
«Marcar como enviado», que es un solo camino y ya está probado. Aquí sólo se consigue el
número —y, de paso, `costo_envio`, que hasta hoy se escribía a mano y por eso estaba vacío.

**El rótulo no dice «joya».** `diceContener` es «Accesorio», configurable en
`ENVIOS99_DICE_CONTENER`. Ese papel lo leen varias manos entre la bodega y la puerta, y
anunciar lo que va dentro es la forma más barata de que el paquete no llegue.

### El nombre

99envios pide `nombre` y `primerApellido` por separado, los dos obligatorios, y el checkout
guarda un solo campo. `partirNombre` usa la convención colombiana —los dos últimos trozos
son los apellidos— y pega las partículas al apellido que acompañan, para que «María de los
Ángeles Ruiz» no tenga por apellido «Ángeles».

**Con una sola palabra devuelve `null` y no se emite nada.** Está en dos sitios —`src/lib/nombre.js`
y dentro de `crear-guia`, que corre en Deno— por el motivo de siempre, y `src/lib/nombre.test.js`
fija el comportamiento.

## Límites conocidos y pendientes

- **Sólo cotiza.** La guía se sigue pidiendo por fuera; el botón sólo rellena la
  transportadora. Emitirla es la fase 2.
- **`integration1.99envios.app` e `integration.99envios.app` son la misma API**: sirven un
  `api-docs-json` **byte a byte idéntico** (md5 `74519ca8…`, el mismo del archivo original) y
  las dos validan el login. Lo que falta confirmar con soporte no es la URL, es otra cosa:
  **si emitir un preenvío por la API genera una guía real y facturable o hay modo de
  pruebas.** La URL vive en `ENVIOS99_URL` por si acaso.
- **La fase 2 no se ha estrenado con un pedido real.** No se puede: todos los pedidos de la
  base son `es_prueba` y la función se niega —correctamente— a emitirles guía.
- El nombre del campo del token no está fijado en la especificación; se prueban las
  variantes conocidas (`token`, `access_token`, `data.token`, `jwt`).
- La caja de un pedido multi-pieza es una aproximación: se suman los pesos y se toma la
  medida mayor. Se queda del lado seguro a propósito.

## Cómo probarlo

1. **La traducción:** `select public.codigo_dane('Bogotá','Bogotá D.C.')` debe dar
   `11001000`, y `codigo_dane('Santa Rosa')` debe dar `null`.
2. **Contra los pedidos reales**, no contra casos inventados: los 18 de la base deben
   resolver salvo el que no trae ciudad.
3. **El diálogo:** abre «Marcar enviado» en un pedido con ciudad y pulsa «Cuánto cuesta
   mandarlo». Deben salir las cinco, de barata a cara, y elegir una debe rellenar el
   selector de transportadora.
4. **Sin cupo:** pasadas 300 en una hora la API responde 429 y la pantalla debe decirlo con
   palabras, no con un error crudo.
