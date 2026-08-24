# El vigía

> **Estado:** en producción
> **Última revisión:** 2026-08-23
> **Dónde vive:** `supabase/functions/vigilancia/index.ts` (432 líneas)

## Qué resuelve

Enterarse de que algo se rompió **sin tener que mirar el panel**.

Existe por lo que pasó el **21 de agosto de 2026**: se rompieron dos cosas —las fotos por
WhatsApp y las fuentes del sitio— y **las dos las encontró una persona probando a mano**.
Nada avisaba. Con pauta encendida, un webhook caído o un bot mudo son ventas perdidas
durante horas sin que nadie lo sepa.

## Cómo funciona hoy

### Flujo

```
pg_cron cada hora en el minuto 30  ·  '30 * * * *'
      → POST /functions/v1/vigilancia   (header x-cron-secreto)
  ├── valida el secreto contra ajustes_internos.cron_secreto
  │     (comparación de largo constante, :29-34)
  ├── corre las comprobaciones → Hallazgo[] { que, detalle, grave }
  ├── guarda en vigilancia_ultima (id=1): hallazgos[] + corrida_en
  └── SÓLO si hay hallazgos → POST /api/correo → plantilla alerta-sistema
```

El Dashboard lee `vigilancia_ultima` y muestra las averías y el "Revisado hace X"
(`secciones/Portada.jsx`).

### Qué comprueba

| Comprobación | Línea |
|---|---|
| Mensajes de WhatsApp fallidos | `:78` |
| Mensajes esperando entrega | `:110` |
| Mensajes colgados | `:131` |
| **Pedidos parados por plazo** (tabla `PLAZOS`) | `:160-172` |
| Pedidos despachados **sin costo anotado**, habiendo pauta corriendo | `:229` |
| Endpoints que no responden o responden mal | `:255-259` |
| **El candado del panel**: políticas sin `es_del_equipo()`, tablas sin RLS, `SECURITY DEFINER` sin `search_path` | `:286` |
| **La configuración de acceso**: registro abierto, o proveedor de correo apagado | `:315` |

> **El webhook de Mercado Pago se espera en 401, no en 200.** Desde que la firma está
> activa, un POST vacío y sin firmar es justo lo que debe rechazar. Con 200 el vigía
> gritaba a diario por un webhook sano. Y esperar 401 avisa de lo contrario: si alguien
> borrara `MP_WEBHOOK_SECRET`, la función volvería a aceptar todo con 200 y esta prueba se
> encendería — es lo único del sistema que cazaría esa regresión.

Los plazos (`:160-172`) son concretos, no genéricos, y **miran el flujo de pago, no sólo el
estado**:

| Id | Plazo | Aplica a | Qué señala |
|---|---|---|---|
| `pendiente` | 24 h | todos | sin confirmar |
| `pagado` | 48 h | **sólo prepago** | pagados y sin empezar |
| `procesando` | 7 días | todos | en el taller |
| `enviado` | 8 días | todos | en camino sin llegar |
| `cobrar` | 48 h | **sólo contraentrega** | entregados sin marcar el cobro |

**Por qué la bifurcación:** `pagado` significa lo contrario en cada flujo. En prepago es un
pedido cobrado que todavía no arranca —justo lo que hay que perseguir—; en contraentrega es
la plata ya recogida, **el final del camino**. Sin la distinción, cada venta contraentrega
terminada se convertía en una alarma grave que no se apagaba nunca — y contraentrega es
como se vende casi todo.

El plazo `cobrar` es la única avería de la lista donde puede haber **plata recogida y sin
registrar**, y hasta ahora no la miraba nadie.

### Que el libro de caja cuadre con la regla

Dos comprobaciones, una encima de la otra, y la diferencia importa:

- **`regla_del_dinero_cuadra()`** comprueba que `recibido_de` de la base siga diciendo lo
  que dice la tabla de CLAUDE.md §8 — que la regla **diga lo que debe**.
- **`caja_cuadra_con_la_regla()`**, desde el 24 de agosto de 2026, comprueba que la suma de
  `pagos` de cada pedido sea lo que esa regla dice — que el libro **le haga caso**.

La segunda existe porque de `pagos` salen ahora las cifras de la portada y del retorno de la
pauta. La tabla y la regla son dos formas de responder «cuánto entró por este pedido», y
como toda pareja de este proyecto pueden separarse sin que nadie lo note: el número seguiría
saliendo redondo, con signo de pesos y perfectamente creíble.

El disparador que llena `pagos` está bien pensado —recalcula lo que debería haber anotado,
resta lo ya anotado y guarda sólo la diferencia, así que se autocorrige— pero corre en cada
`INSERT` y en cada `UPDATE` de cinco columnas, y cualquier cambio futuro en el circuito de
estados puede dejarlo desfasado.

**Comprobada rompiéndola:** se metió un peso de más en el libro de un pedido de prueba, el
guardián lo cazó, y se deshizo. Vacío es que cuadra, y así está hoy: 18 pedidos, cero
descuadres.

### Que los dos píxeles de Meta sean el mismo

La medición va por dos caminos: el navegador manda `PageView` y `Purchase` con
`VITE_META_PIXEL_ID`, y el servidor manda la venta por la API de Conversiones con
`META_PIXEL_ID`. **Si no son el mismo número la deduplicación no ocurre** — los eventos se
parten en dos píxeles y ninguno cuenta bien. Y en esta cuenta hay **dos píxeles con el mismo
nombre**, que es la trampa que más tiempo ha costado en este proyecto.

No se pueden comparar leyendo los dos secretos: Supabase no devuelve el valor de uno. Así
que se compara contra la verdad — **el bundle que el sitio está sirviendo ahora mismo**. Si
el identificador del servidor no aparece ahí, el navegador está usando otro.

El identificador de un píxel no es secreto —viaja en el JavaScript público de cualquier
tienda— pero el vigía sólo dice si coinciden, nunca cuál es.

### El candado del panel

Las dos últimas comprobaciones son de otra clase que el resto: no vigilan que algo esté
funcionando, vigilan que **algo siga cerrado**. Existen por lo que se descubrió el 23 de
agosto de 2026 — la premisa de seguridad del panel llevaba seis meses rota, con todas las
políticas en `using (true)` y el registro público abierto, y **no lo dijo nadie**.
Arreglarlo no bastaba: hacía falta que la próxima vez lo dijera alguien sin preguntar.

La de la base pregunta a `public.politicas_flojas()`, una función `SECURITY DEFINER`
reservada a la llave de servicio —enumerar los agujeros de RLS es justo lo que no se le
enseña a nadie más—. Trae tres cosas: políticas del panel que no exigen `es_del_equipo()`,
tablas que se quedaron sin RLS, y funciones `SECURITY DEFINER` sin `search_path` fijo. Las
dos únicas excepciones son deliberadas y públicas: el catálogo y las fotos de las piezas.
Cualquier otra cosa es un hallazgo aunque sea legítima — **el vigía informa, no decide.**

La de la configuración lee `/auth/v1/settings`, que es público y no necesita secreto.
Mira dos banderas, y cada una corresponde a un problema real de ese mismo día:

- `disable_signup === false` → el registro está abierto, que era el agujero.
- `external.email === false` → **nadie puede entrar al panel.** Es el susto de después:
  al cerrar el registro es facilísimo apagar «Enable email provider» en vez de «Allow new
  users to sign up», y el primero apaga también la *entrada*. No se nota, porque la sesión
  abierta se sigue renovando sola con el token de refresco; el fallo aparece días más tarde,
  cuando alguien cierre sesión o entre desde otro aparato. Sin esta comprobación, la tienda
  se queda sin panel y nadie se entera hasta que es urgente.

### Tablas

`vigilancia_ultima` (fila id=1), `ajustes_internos` (`cron_secreto`),
`whatsapp_conversaciones`, `orders`, `products`, `gasto_pauta`.

### Variables de entorno

`CORREO_SECRETO`, `APP_URL`.

## Decisiones tomadas y por qué

**Sólo manda correo cuando algo está mal** (`:11-14`). Un resumen diario de "todo bien" se
convierte en un correo que nadie abre — *"y el día que diga otra cosa tampoco lo van a
abrir"*. El silencio es la señal de que todo va bien.

**Las comprobaciones no son genéricas** (`:9-10`): **cada una corresponde a algo que ya
falló, o que si falla cuesta plata directamente**. No es un healthcheck de manual; es una
lista de cicatrices. Por eso vigila las fotos de WhatsApp (que fallan con un 200 engañoso) y
no, por ejemplo, el uso de CPU.

**El plazo "entregados sin marcar el cobro"** es puro contraentrega: un pedido entregado
cuyo cobro nadie registró es plata que se puede perder de vista, no un detalle
administrativo.

**Avisa si hay pedidos despachados sin costo anotado mientras corre pauta** (`:229`). Es
una comprobación de negocio, no técnica: sin ese número el panel puede decir cuánto se
vendió pero no cuánto quedó, y con pauta encendida se estarían tomando decisiones de
inversión a ciegas.

Hasta el 23 de agosto de 2026 la pregunta era otra —"¿hay piezas con costo de relleno en el
catálogo?"— porque el costo vivía en `products`. Al mudarse al pedido, la comprobación se
mudó con él: mira los pedidos `enviado` o `entregado` de los últimos 60 días, sin
`costo_taller` y que no sean prueba. **Sólo los despachados**: pedirle el costo a un pedido
que el taller aún no entregó sería pedir algo que nadie sabe.

**El secreto vive en la base, no en variables de entorno** (`:38-45`), y se compara en
tiempo constante (`:29-34`). En la base se puede rotar sin redesplegar la función.

**El estado se guarda aunque no haya hallazgos**, para que el panel pueda decir "Revisado
hace X". Un panel que no dice cuándo se revisó por última vez no distingue "todo bien" de
"el vigía lleva tres días muerto".

**Si no hay secreto configurado, devuelve 500** (`:44-45`): falla cerrado.

## Límites conocidos y pendientes

- **Nadie vigila al vigía.** Si la función deja de correr, lo único que lo delata es que el
  "Revisado hace X" del panel envejece — y hay que mirarlo.
- Los umbrales están hardcodeados, no configurables desde Ajustes.
- No hay escalado: todos los hallazgos van al mismo correo, graves o no.

## Cómo probarlo

```bash
# Con el secreto correcto
curl -X POST "$SUPABASE_URL/functions/v1/vigilancia" \
     -H "x-cron-secreto: <valor de ajustes_internos.cron_secreto>"

npx supabase functions logs vigilancia --tail
```

1. **Sin secreto y con secreto equivocado:** ambos deben rechazarse.
2. **Todo bien:** con nada roto, debe actualizar `vigilancia_ultima` y **no mandar correo**.
3. **Provoca un hallazgo:** deja un pedido en `pendiente` con más de 24 h de antigüedad
   (`es_prueba`). Debe aparecer en el panel y llegar el correo `alerta-sistema` con franja
   roja.
4. **El panel:** comprueba que las averías salen en el Dashboard y que el "Revisado hace X"
   se corresponde con `corrida_en`.
5. **Programación:** `SELECT jobname, schedule FROM cron.job;` para confirmar que sigue
   agendado.
