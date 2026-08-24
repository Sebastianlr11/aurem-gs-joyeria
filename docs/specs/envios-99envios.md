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

## Lo primero que dijo, y que conviene mirar

Cotización real a Bogotá, pieza de $500.000, caja de 1 kg:

| | Total |
|---|---|
| Coordinadora | $11.972 |
| Servientrega | $14.050 |
| Envía | $14.251 |
| TCC | $28.959 |

**El abono de $20.000 cubre el envío en Bogotá con tres de las cinco, y con TCC se queda
corto.** Y Bogotá es el destino barato. Es exactamente el número que no se tenía.

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
