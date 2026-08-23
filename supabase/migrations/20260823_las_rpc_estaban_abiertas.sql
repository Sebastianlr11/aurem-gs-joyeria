-- 🔒 Las RPC estaban abiertas a la llave pública.
--
-- El 22 de agosto se cerró a `anon` el acceso directo a las tablas de
-- conversaciones. Quedó una puerta al lado que nadie miró: **las funciones**.
-- Catorce eran `SECURITY DEFINER` —o sea, se saltan RLS por diseño— y `anon`
-- podía ejecutarlas. La llave anónima viaja dentro del bundle público, así que
-- cualquiera con el sitio abierto podía llamarlas.
--
-- Comprobado el 23 de agosto de 2026 contra el endpoint real, con la anon key:
--
--   revenue_por_fuente    → los ingresos del negocio, por canal
--   top_ciudades_envio    → los ingresos por ciudad
--   buscar_conversaciones → teléfono y contenido de los mensajes con clientas
--
-- Las tres respondieron con datos. No es una posibilidad teórica.
--
-- ── Qué se hace ────────────────────────────────────────────────────
--
-- 1. Se BORRAN cuatro funciones que no llama nadie —comprobado sobre `src/`,
--    `supabase/functions/` y `api/`—, restos de la era n8n. Todas son
--    `SECURITY DEFINER` y dos ya estaban rotas porque leían `conversaciones`,
--    la tabla que se borró hoy. `crear_orden_whatsapp` era la peor: creaba
--    pedidos saltándose RLS, a petición de cualquiera.
--
--    Iban a ser cinco. `cancel_duplicate_pending_orders` no aparecía en el
--    código y parecía muerta, pero **la usa un trigger** —
--    `trg_cancel_duplicate_orders` sobre `orders`—, y eso no se ve grepeando
--    el repositorio. Se queda; sólo se le quita el permiso a `anon`.
--
-- 2. Se le QUITA a `anon` y a `PUBLIC` el permiso de ejecutar las de analítica
--    y las de trigger. Siguen disponibles para `authenticated`, que es el
--    panel. Se dejan como estaban las dos que ya estaban bien cerradas
--    (`chats_sin_responder`, `conversaciones_purgables`).
--
-- **`pedido_publico` NO se toca.** Es la excepción deliberada: la pantalla de
-- confirmación la necesita sin sesión, y por eso devuelve cinco columnas
-- contadas a mano —ni nombre, ni teléfono, ni correo, ni dirección—. Ver
-- `20260822_pedido_publico.sql`.

-- ── 1. Las que no usa nadie ─────────────────────────────────────────
drop function if exists public.guardar_mensajes(text, text, text);
drop function if exists public.obtener_conversacion(text);
drop function if exists public.crear_orden_whatsapp(text, text, text, uuid, text, numeric, text, text);
drop function if exists public.buscar_productos(text, integer);

-- ── 2. Las que sí se usan, pero sólo desde el panel ─────────────────
revoke execute on function public.analiticas_whatsapp(integer)            from public, anon;
revoke execute on function public.buscar_conversaciones(text)             from public, anon;
revoke execute on function public.clientes_nuevos_vs_recurrentes(integer) from public, anon;
revoke execute on function public.embudo_whatsapp(integer)                from public, anon;
revoke execute on function public.revenue_por_fuente(integer)             from public, anon;
revoke execute on function public.tendencia_comparativa()                 from public, anon;
revoke execute on function public.top_ciudades_envio(integer)             from public, anon;

-- Las de trigger no las llama nadie a mano —fuera de su tabla fallarían—,
-- pero no hay razón para que `anon` las tenga a tiro.
revoke execute on function public.marcar_cliente_de_prueba()  from public, anon;
revoke execute on function public.marcar_pedido_de_prueba()   from public, anon;
revoke execute on function public.registrar_pago()            from public, anon;
revoke execute on function public.sync_customer_from_order()  from public, anon;
revoke execute on function public.set_updated_at()            from public, anon;
revoke execute on function public.cancel_duplicate_pending_orders() from public, anon;
revoke execute on function public.recibido_de(text, text, numeric, numeric) from public, anon;

-- Que quede explícito quién sí puede: el panel.
grant execute on function public.analiticas_whatsapp(integer)            to authenticated;
grant execute on function public.buscar_conversaciones(text)             to authenticated;
grant execute on function public.clientes_nuevos_vs_recurrentes(integer) to authenticated;
grant execute on function public.embudo_whatsapp(integer)                to authenticated;
grant execute on function public.revenue_por_fuente(integer)             to authenticated;
grant execute on function public.tendencia_comparativa()                 to authenticated;
grant execute on function public.top_ciudades_envio(integer)             to authenticated;
grant execute on function public.recibido_de(text, text, numeric, numeric) to authenticated;
