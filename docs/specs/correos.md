# Correos transaccionales

> **Estado:** en producción
> **Última revisión:** 2026-08-22

## Qué resuelve

Mandar los cuatro correos que el negocio necesita, con la marca puesta y sin duplicados
cuando un webhook reintenta.

## Cómo funciona hoy

### Flujo

```
Quien dispara (Deno / Edge Function)
  └── POST /api/correo   con header x-correo-secreto
        ├── comparación en tiempo constante del secreto
        ├── validación contra lista blanca de plantillas
        ├── renderiza desde api/_plantillas.mjs (artefacto generado)
        └── Resend, con idempotencyKey = "plantilla/referencia"
```

**`/api/correo` es la única salida de correo del sistema.** Existe porque las plantillas
son React y quien las dispara corre en Deno (`api/correo.js:4-7`).

### Las cuatro plantillas

| Plantilla | Para | La dispara |
|---|---|---|
| `pedido-confirmado` | cliente | `mp-webhook/index.ts:293` al aprobarse el pago |
| `pedido-despachado` | cliente | `correo-despacho/index.ts:115` desde el panel |
| `chat-escalado` | equipo | `bot.ts:922` al usar `escalar_a_humano` |
| `alerta-sistema` | equipo | `vigilancia/index.ts:283` **sólo si hay hallazgos** |

### Archivos clave

| Ruta | Qué |
|---|---|
| `api/correo.js:23-24` | `CORREO_SECRETO`, `RESEND_API_KEY` |
| `api/correo.js:34-35, 99-104` | Comparación en tiempo constante |
| `api/correo.js:41` | Lista blanca de plantillas |
| `api/correo.js:74, 86` | `idempotencyKey = plantilla/referencia` |
| `api/correo.js:107-110` | Enmascarado de correos en los logs |
| `emails/_render.ts:19-24` | Registro de plantillas |
| `emails/_render.ts:35-62` | **El asunto lo decide la plantilla** |
| `emails/_render.ts:72-75` | Renderiza HTML **y** texto plano |
| `emails/_marca.tsx` | Tokens de marca en línea (413 líneas) |
| `scripts/correos.mjs:14-19` | esbuild → `api/_plantillas.mjs` |

### Variables de entorno

`CORREO_SECRETO`, `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`.

## Decisiones tomadas y por qué

**Un solo endpoint de salida, con secreto compartido.** Las Edge Functions corren en Deno y
no pueden renderizar React. En vez de duplicar las plantillas en dos runtimes, se centraliza
el envío en Vercel y se protege con `x-correo-secreto`.

**El secreto se compara en tiempo constante** (`:99-104`). Una comparación normal filtra
información por el tiempo de respuesta.

**Idempotencia con `plantilla/referencia`** (`:74, 86`). Mercado Pago reintenta sus
webhooks; sin esta clave, un cliente recibía el mismo "pedido confirmado" tres veces.

**El asunto lo decide la plantilla, no quien la manda** (`_render.ts:35-62`). Así el asunto
y el cuerpo no se desincronizan nunca.

**Se renderiza HTML y texto plano** (`:72-75`): mejora la entregabilidad y sirve a quien
lee en texto.

**`_marca.tsx` duplica los tokens de `src/index.css` en línea** (`:4-8`) porque **Gmail
borra los `<style>` externos**. Y usa **Georgia en vez de Marcellus** (`:10-14`): una fuente
web no se puede garantizar en un cliente de correo, así que se elige una serif de sistema
que se le parezca.

**Las dos plantillas internas rompen la marca a propósito**: `alerta-sistema` lleva franja
roja para distinguirse de un vistazo en la bandeja. Un correo de avería que parece un correo
de marketing no se abre a tiempo.

**`api/_plantillas.mjs` es un artefacto de build** (`scripts/correos.mjs`), gitignorado.
React queda **fuera** del bundle (`packages: 'external'`) porque `react-dom/server` usa
`require()` y reventaba con *"Dynamic require of util is not supported"*.

**Los correos se enmascaran en los logs** (`:107-110`).

## Límites conocidos y pendientes

- **No hay webhooks de Resend**: no se registran rebotes, quejas ni aperturas. Si un correo
  no llega, nadie se entera.
- No hay reintentos propios: si Resend falla, el correo se pierde (aunque `mp-webhook` aísla
  el fallo para no tumbar el cobro).
- `api/correo.js` falla con "cannot find module" si no se ha corrido `npm run correos`.
- No hay correo de recuperación propio: el de contraseña lo manda Supabase con su plantilla.

## Cómo probarlo

```bash
npm run correos            # genera api/_plantillas.mjs
npm run email              # previsualizador en http://localhost:3010
```

1. **Previsualiza las cuatro** en el visor de React Email antes de tocar nada.
2. **Idempotencia:** llama a `/api/correo` dos veces con la misma `plantilla` y
   `referencia`. Debe llegar **un solo correo**.
3. **Secreto:** llama sin el header `x-correo-secreto` y con uno equivocado — ambos deben
   rechazarse.
4. **Lista blanca:** pide una plantilla inexistente. Debe rechazarla, no intentar renderizar.
5. **Gmail de verdad:** manda `pedido-confirmado` a una cuenta de Gmail y comprueba que
   conserva los colores de marca (es lo que rompen los `<style>` externos).
6. **Texto plano:** mira la versión de texto en el cliente de correo.
