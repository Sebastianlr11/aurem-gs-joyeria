# Panel — ajustes

> **Estado:** en producción
> **Última revisión:** 2026-08-23
> **Ruta:** `/admin?tab=settings` · `src/pages/admin/secciones/Ajustes.jsx`

> **Sin números de línea.** Los llevaba, y el 23 de agosto de 2026 `Dashboard.jsx` pasó de
> 4.100 líneas a 248 al repartirse en `src/pages/admin/secciones/`. Todos apuntaban a
> sitios que ya no existen. Se nombran archivos y funciones, que sobreviven a un
> reordenamiento.

## Qué resuelve

Es la pantalla que **cambia lo que Valentina dice y lo que el negocio cobra, sin
desplegar nada**. Precio del oro, políticas, cifras de contraentrega, administradores.

## Cómo funciona hoy

### Qué contiene

| Bloque | Componente | Escribe en |
|---|---|---|
| Guía del circuito de un pedido | `GuiaDelCircuito` | — (sólo lee `src/lib/circuito.js`) |
| Precio del oro, recargo, gramos mínimos | `PrecioOroCard` | `taller_precios` |
| Base de conocimiento de Valentina | `ConocimientoCard` | `taller_conocimiento` |
| Administradores | `Ajustes.jsx` | `auth.users` vía `create-admin` |
| Webhook propio + prueba | `Ajustes.jsx` | `localStorage` |
| Respuestas rápidas del chat | `Ajustes.jsx` | `localStorage` |
| Sonido de notificación | `Ajustes.jsx` | `localStorage` |

### La guía del circuito

Va la primera de la pantalla y **no escribe nada**: explica qué botón se oprime en cada
caso y qué pasa al oprimirlo, para quien entre al panel sin conocer el negocio. Los dos
caminos no tienen texto propio — se arman llamando a `queFalta()` y `loQuePasa()` de
`src/lib/circuito.js` con un pedido de ejemplo, que son las mismas frases que se ven en
Pedidos y en el diálogo de confirmar. Ver [admin-pedidos.md](admin-pedidos.md).

**Y trae el despacho paso a paso**, que es lo único de la guía con texto propio y tiene
motivo: es el tramo con más manos fuera del panel —la transportadora, la plataforma de
99envios, el camión— y el que más veces deja un paquete quieto por algo que no está escrito
en ninguna pantalla. Los seis pasos incluyen los que ocurren **fuera** del panel: imprimir
el rótulo, conseguir que lo recojan y firmar el manifiesto. Están aquí porque quien despacha
tiene el panel abierto, no el repositorio. Ver
[envios-99envios.md](envios-99envios.md).

### Tablas

**`taller_precios`** — fila única, forzada con `id boolean primary key default true check (id)`.
Columnas: precio del gramo de oro, recargo, gramos mínimos, `abono_envio`,
`tope_contraentrega`, `iva_pauta`.

**`taller_conocimiento`** — `tema`, `contenido`. Es lo que Valentina puede afirmar sobre
envíos, garantía, plazos y estuche.

### Variables de entorno

`VITE_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` en `create-admin`.

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

- **Alta y baja de administradores es sólo del dueño** desde el 22 de agosto de 2026. Quien
  no lo sea ve una explicación en vez de la lista. Al dueño no se le puede borrar desde
  aquí. Ver [admin-acceso.md](admin-acceso.md).
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
