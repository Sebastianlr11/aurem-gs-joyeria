# El vigía

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Dónde vive:** `supabase/functions/vigilancia/index.ts` (297 líneas)

## Qué resuelve

Enterarse de que algo se rompió **sin tener que mirar el panel**.

Existe por lo que pasó el **21 de agosto de 2026**: se rompieron dos cosas —las fotos por
WhatsApp y las fuentes del sitio— y **las dos las encontró una persona probando a mano**.
Nada avisaba. Con pauta encendida, un webhook caído o un bot mudo son ventas perdidas
durante horas sin que nadie lo sepa.

## Cómo funciona hoy

### Flujo

```
pg_cron → POST /functions/v1/vigilancia   (header x-cron-secreto)
  ├── valida el secreto contra ajustes_internos.cron_secreto
  │     (comparación de largo constante, :29-34)
  ├── corre las comprobaciones → Hallazgo[] { que, detalle, grave }
  ├── guarda en vigilancia_ultima (id=1): hallazgos[] + corrida_en
  └── SÓLO si hay hallazgos → POST /api/correo → plantilla alerta-sistema
```

El Dashboard lee `vigilancia_ultima` y muestra las averías y el "Revisado hace X"
(`Dashboard.jsx:517-519, 741-759`).

### Qué comprueba

| Comprobación | Línea |
|---|---|
| Mensajes de WhatsApp fallidos | `:78` |
| Mensajes esperando entrega | `:110` |
| Mensajes colgados | `:131` |
| **Pedidos parados por plazo** (tabla `PLAZOS`) | `:160-172` |
| Piezas con costo de relleno **habiendo pauta corriendo** | `:229` |
| Endpoints que no responden o responden mal | `:255-259` |

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

**Avisa si hay piezas con costo de relleno mientras corre pauta** (`:229`). Es una
comprobación de negocio, no técnica: si el costo es un supuesto, el retorno también, y con
pauta encendida se están tomando decisiones de inversión sobre un número inventado.

**El secreto vive en la base, no en variables de entorno** (`:38-45`), y se compara en
tiempo constante (`:29-34`). En la base se puede rotar sin redesplegar la función.

**El estado se guarda aunque no haya hallazgos**, para que el panel pueda decir "Revisado
hace X". Un panel que no dice cuándo se revisó por última vez no distingue "todo bien" de
"el vigía lleva tres días muerto".

**Si no hay secreto configurado, devuelve 500** (`:44-45`): falla cerrado.

## Límites conocidos y pendientes

- **La programación de `pg_cron` no está versionada.** Desde el repo no se sabe cada cuánto
  corre. Consultar con `SELECT * FROM cron.job;` — [pendientes #4](../pendientes.md).
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
