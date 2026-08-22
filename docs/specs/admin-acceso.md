# Panel — acceso y administradores

> **Estado:** en producción · **sin roles**
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

`auth.users` de Supabase. **No hay tabla de roles ni de perfiles.**

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
correcta — y por eso el fallo de RLS en `orders` es tan grave: el candado real está ahí.

**Todo usuario autenticado es administrador.** No hay niveles. Para un equipo de dos o tres
personas es una decisión defendible; deja de serlo en cuanto entre alguien con acceso
parcial (un contador, un asistente).

## Límites conocidos y pendientes

- 🔴 **`create-admin` no comprueba quién llama** (`:30-42`). Verifica que **hay** un usuario
  autenticado, pero no **cuál**, y luego usa la service role key para crear, listar y
  borrar usuarios. **Cualquier usuario con sesión puede borrar al dueño.**
  Arreglo propuesto en [pendientes #2](../pendientes.md).
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
