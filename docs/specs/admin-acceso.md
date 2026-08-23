# Panel — acceso y administradores

> **Estado:** en producción · el dueño administra las cuentas
> **Última revisión:** 2026-08-22
> **Rutas:** `/admin/login`, `/admin/reset-password`

## Qué resuelve

Entrar al panel, recuperar la contraseña, y dar de alta o de baja a quien más puede entrar.

## Cómo funciona hoy

### Flujo

```
/admin/login
  ├── signInWithPassword → sesión de Supabase → /admin
  └── modo "recuperar" → resetPasswordForEmail(redirectTo: /admin/reset-password)
        ↓ correo de Supabase
      /admin/reset-password → updateUser({ password }) → /admin a los 3 s

Cualquier ruta protegida
  └── ProtectedRoute → getSession() una vez al montar
        ├── cargando → null
        ├── sin sesión → <Navigate to="/admin/login" replace />
        └── con sesión → renderiza

Alta/baja de administradores
  └── Ajustes → functions.invoke('create-admin', { action: 'list' | … })
        └── usa SUPABASE_SERVICE_ROLE_KEY
```

### Archivos clave

| Ruta | Qué |
|---|---|
| `src/components/ProtectedRoute.jsx:9-18` | La comprobación de sesión |
| `src/pages/admin/Login.jsx:40` | `mode: 'login' \| 'recover'` en el mismo componente |
| `src/pages/admin/Login.jsx:48-50` | Login con error **genérico** en español |
| `src/pages/admin/Login.jsx:62-64` | `resetPasswordForEmail` con `redirectTo` |
| `src/pages/admin/ResetPassword.jsx:28-38` | Mínimo 6 caracteres, confirma coincidencia |
| `src/pages/admin/Dashboard.jsx:3287-3300` | UI de administradores en Ajustes |
| `supabase/functions/create-admin/index.ts:30-42` | Verificación del llamante |

### Tablas

`auth.users` de Supabase. **No hay tabla de roles ni de perfiles**: el rol vive en
`app_metadata.rol` de cada cuenta y vale `dueño` o `equipo`. Lo lee
`public.es_del_equipo()`, la función de la que cuelgan todas las políticas RLS del panel
desde el 23 de agosto de 2026.

### Variables de entorno

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (navegador) ·
`SUPABASE_SERVICE_ROLE_KEY` (`create-admin`).

## Decisiones tomadas y por qué

**El error de login es genérico** (`Login.jsx:50`): no distingue "usuario no existe" de
"contraseña incorrecta". Es lo correcto — lo contrario permite enumerar cuentas.

**Login y recuperación viven en el mismo componente**, con un flag. Son la misma pantalla
con el mismo fondo; separarlas en dos rutas habría duplicado la vitrina.

**La autorización real la hace RLS, no el frontend.** `ProtectedRoute` decide qué se
*renderiza*; lo que se puede *leer y escribir* lo decide Supabase. Es la separación
correcta, y por eso el candado tiene que estar bien puesto ahí.

**Y tener sesión no es ser del equipo.** Hasta el 23 de agosto de 2026 sí lo era: las
veinte políticas del panel decían `to authenticated using (true)`, y el propio código lo
daba por sentado —«en este proyecto todo usuario de Supabase Auth es administrador»—. Esa
premisa dependía enteramente de que nadie más pudiera conseguir una sesión, **y el registro
público estaba abierto**. Ahora cada política llama a `public.es_del_equipo()`, que exige
el rol en `app_metadata`; el registro cerrado es una segunda barrera, no la única.

El orden en que se aplica importa y está escrito en la migración: **primero se sellan los
roles, después se comprueba que la sesión abierta ya los lleva, y sólo entonces se cambian
las políticas.** Un JWT lleva el `app_metadata` que existía cuando se emitió; al revés, el
cambio deja fuera del panel a todo el mundo hasta que renueve el token.

**Hay exactamente dos niveles: dueño y administrador.** El dueño se marca con
`app_metadata.rol = 'dueño'` —que sólo se escribe con la llave de servicio, a diferencia de
`user_metadata`, que el propio usuario puede cambiar desde el navegador—. Sólo el dueño
administra cuentas; todo lo demás del panel es igual para ambos.

**El arranque se resuelve solo** (`create-admin`): mientras no haya ningún dueño sellado,
manda la cuenta más antigua y se le graba el rol en ese momento. Exigir el rol sin que nadie
lo tenga habría dejado el panel sin administrador posible, obligando a acordarse de sellar
al dueño antes de desplegar. Nadie puede crear una cuenta anterior a la primera, y la
excepción se cierra sola en cuanto se usa.

**Al dueño no se le borra desde el panel**, ni siquiera otro dueño. Quitarle el negocio a
alguien es más serio que un botón en Ajustes.

Sigue sin haber permisos parciales: un administrador ve pedidos, clientes y conversaciones
completas. Para un equipo de dos o tres personas es defendible; deja de serlo en cuanto
entre alguien que sólo deba ver una parte (un contador, un asistente).

## Límites conocidos y pendientes

- **Sólo hay dos niveles**: dueño y administrador. No hay permisos parciales, así que
  cualquier administrador sigue viendo pedidos, clientes y conversaciones completas.
- **`ProtectedRoute` no escucha `onAuthStateChange`** (`:9-18`): llama a `getSession()` una
  sola vez al montar. Una sesión que expira, o un cierre de sesión en otra pestaña, no
  reaccionan hasta que algo remonte la ruta — [pendientes #18](../pendientes.md).
- **Comprobación duplicada:** `Dashboard.jsx:3688-3692` y `ChatPanel.jsx:297-301` vuelven a
  pedir la sesión y redirigen por su cuenta. Redundante con `ProtectedRoute`.
- **`ResetPassword` se quedó en el diseño anterior** ("PORTAL EXCLUSIVO", logo como `<img>`)
  mientras `Login` ya usa `<Isotipo />` y la dirección nueva. Además arrastra un
  `onAuthStateChange` con el cuerpo vacío (`:14-22`) y props de Framer Motion sobre un
  `div` plano (`:79`) — [pendientes #22](../pendientes.md).
- Las tres "stats" de la vitrina del login (`18k`, `24–48 h`, `925`) están hardcodeadas
  (`Login.jsx:28-32`).
- Contraseña mínima de 6 caracteres, sin más requisitos.

## Cómo probarlo

1. **Sin sesión**, entrar a `/admin` y a `/admin/chat` → debe redirigir a `/admin/login`.
2. Login con correo inexistente y con contraseña mala → **el mismo mensaje** en ambos casos.
3. **Recuperación completa:** pedir el correo, abrir el enlace, cambiar la contraseña,
   comprobar la redirección a `/admin` y que la nueva contraseña funciona.
4. **Expiración (hoy falla):** cierra la sesión desde otra pestaña y vuelve a la primera sin
   recargar. La ruta protegida **sigue montada** — es el hallazgo #18.
5. **Autorización real:** con la sesión cerrada, intenta leer una tabla protegida con la
   anon key. Debe negarse por RLS, no por el frontend.
