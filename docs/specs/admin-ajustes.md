# Panel — ajustes

> **Estado:** en producción
> **Última revisión:** 2026-08-22
> **Ruta:** `/admin?tab=settings` · `src/pages/admin/Dashboard.jsx:3266`

## Qué resuelve

Es la pantalla que **cambia lo que Valentina dice y lo que el negocio cobra, sin
desplegar nada**. Precio del oro, políticas, cifras de contraentrega, administradores.

## Cómo funciona hoy

### Qué contiene

| Bloque | Componente | Escribe en |
|---|---|---|
| Precio del oro, recargo, gramos mínimos | `PrecioOroCard` (`:2931`) | `taller_precios` |
| Base de conocimiento de Valentina | `ConocimientoCard` (`:3132`) | `taller_conocimiento` |
| Administradores | `:3287-3300` | `auth.users` vía `create-admin` |
| Webhook propio + prueba | `:3266+` | `localStorage` |
| Respuestas rápidas del chat | `:3266+` | `localStorage` |
| Sonido de notificación | `:3266+` | `localStorage` |

### Tablas

**`taller_precios`** — fila única, forzada con `id boolean primary key default true check (id)`.
Columnas: precio del gramo de oro, recargo, gramos mínimos, `abono_envio`,
`tope_contraentrega`, `iva_pauta`.

**`taller_conocimiento`** — `tema`, `contenido`. Es lo que Valentina puede afirmar sobre
envíos, garantía, plazos y estuche.

### Variables de entorno

`VITE_SUPABASE_URL` (`:3289`) · `SUPABASE_SERVICE_ROLE_KEY` en `create-admin`.

## Decisiones tomadas y por qué

**`taller_precios` es una fila única forzada por el esquema** (`id boolean primary key
default true check (id)`). Un truco deliberado: hace **imposible** que existan dos filas de
precios. Con dos, la mitad del sistema leería una y la otra mitad la otra.

**`taller_precios` no tiene lectura pública.** El **recargo es el margen del negocio**. Lo
que el sitio necesita —`abono_envio` y `tope_contraentrega`— se expone por la vista
`envio_publico`, y sólo eso.

**El conocimiento de Valentina se edita desde aquí, no en el código.** El prompt se compone
en caliente en cada respuesta, así que corregir una política cambia lo que dice el bot
**inmediatamente**, sin desplegar. Es la decisión que hace mantenible al chatbot: quien
sabe la respuesta correcta es el joyero, no quien despliega.

**El precio del oro tiene dos umbrales, no uno** (`bot.ts:22-23`): a los **3 días** avisa
de que está viejo, a los **10** Valentina **se niega a cotizar**. El joyero lo consulta a
diario pero no cambia la cotización por movimientos chicos —*"si mañana baja 5000 o sube
3000 no importa"*— así que el dato se usa tal cual; lo que se vigila es que no esté
**abandonado**.

**Las respuestas rápidas y el webhook viven en `localStorage`**, no en la base. Es una
decisión de conveniencia con un coste real: **son por navegador, no por equipo**. Quien
entre desde otro computador no las tiene.

## Límites conocidos y pendientes

- 🔴 **Alta y baja de administradores sin control de rol.** `create-admin` verifica que hay
  sesión, no quién la tiene: cualquier usuario autenticado puede borrar al dueño desde esta
  pantalla — [pendientes #2](../pendientes.md).
- **Verificar `taller_conocimiento`**: el seed dejó las 6 filas marcadas *"SIN CONFIRMAR"* y
  Valentina las lee en caliente. Los claims ya se verificaron con el joyero, pero conviene
  confirmar que la base está al día — [pendientes #12](../pendientes.md).
- No hay historial de cambios: si alguien cambia el precio del oro, no queda rastro de quién
  ni cuándo.
- Las respuestas rápidas no se comparten entre miembros del equipo.
- `taller_precios` **no tiene validación de rangos**: un cero o un valor absurdo se guarda.
  Las defensas están aguas abajo (`create-preference:115-118`, `bot.ts`), no aquí.

## Cómo probarlo

1. **Efecto inmediato en Valentina:** cambia una fila de `taller_conocimiento` y pregúntale
   por eso en el mismo chat. Debe responder con lo nuevo **sin redesplegar nada**.
2. **Umbrales del oro:** atrasa la fecha del precio 4 días → debe avisar. 11 días → debe
   negarse a cotizar.
3. **Abono:** cambia `abono_envio` y comprueba que la cifra cambia en tres sitios a la vez:
   lo que dice Valentina, lo que muestra el checkout y lo que cobra Mercado Pago.
4. **Fila única:** intenta insertar una segunda fila en `taller_precios` — el `check` debe
   rechazarla.
5. **Fuga de margen:** consulta `taller_precios` con la anon key. **No debe devolver nada.**
   Consulta `envio_publico` — debe devolver sólo dos columnas.
6. **Administradores:** hoy cualquier sesión puede listar y borrar. Confírmalo, y trátalo
   como el fallo que es.
