-- ============================================================================
-- CONFIRMADO Y DEVUELTO
-- ============================================================================
-- 23 de agosto de 2026 (el nombre del archivo va en UTC). El circuito de un pedido gana dos estados, y la regla
-- del dinero aprende los dos.
--
--   confirmado  la clienta abonó el envío y el taller no ha empezado
--   devuelto    la pieza salió, no se recibió y volvió; el abono se queda
--
-- ── Por qué hacía falta `confirmado` ────────────────────────────────────────
--
-- `procesando` significa una sola cosa: el taller ya empezó. Pero al entrar el
-- abono el pedido saltaba solo a `procesando`, cuando el joyero todavía no se
-- había enterado — el estado mentía desde el primer minuto. `confirmado` dice
-- lo que de verdad pasó, y `mp-webhook` lo deja ahí.
--
-- No es un estado nuevo: existía del diseño viejo, sin usar y sin significado.
-- Se le da uno en vez de inventar otra palabra.
--
-- ── Por qué hacía falta `devuelto` ──────────────────────────────────────────
--
-- En contraentrega hay dos finales normales, no uno. Hasta hoy el segundo se
-- anotaba como `cancelado`, que significa «nunca pasó» — y eso borraba una
-- venta que sí costó un flete y que sí dejó un abono cobrado.
--
-- El abono SE QUEDA, que es exactamente para lo que existe: cubrir el envío de
-- una entrega que no se cerró. Y no se avisa a Meta ni a TikTok, porque decirle
-- a un anuncio que vendió cuando la pieza volvió le enseña a traer más clientas
-- que no reciben.
--
-- ── Y un guardián, porque la regla vive en dos idiomas ──────────────────────
--
-- `recibido_de` es el espejo en SQL de `recibidoDe` (src/lib/dinero.js). Son
-- dos copias por obligación: el panel calcula sobre filas que ya tiene en el
-- navegador y el disparador de `pagos` corre dentro de Postgres. Ninguna puede
-- llamar a la otra.
--
-- El mismo día que se escribió esto, una tabla de tallas duplicada resultó
-- discrepar en el 29 % de los casos sin que nadie lo supiera. Aquello eran
-- anillos; esto es la caja. Así que `regla_del_dinero_cuadra()` compara la
-- versión de la base contra la tabla de CLAUDE.md §8, y el vigía la consulta
-- cada hora.
--
-- Ojo: `orders.status` es texto SIN restricción. Acepta cualquier cosa, así que
-- el vocabulario lo sostienen el código y la documentación, no la base.
-- ============================================================================

create or replace function public.recibido_de(
  p_status text, p_payment_method text, p_amount numeric, p_abono_monto numeric
) returns numeric
language sql
immutable
as $$
  SELECT CASE
    WHEN p_status IN ('cancelado', 'pendiente') THEN 0
    WHEN p_payment_method IS DISTINCT FROM 'contraentrega' THEN
      CASE WHEN p_status IN ('pagado', 'procesando', 'enviado', 'entregado')
           THEN COALESCE(p_amount, 0) ELSE 0 END
    WHEN p_status IN ('entregado', 'pagado') THEN COALESCE(p_amount, 0)
    -- Con el abono pagado y nada más. `devuelto` también: el abono se queda.
    WHEN p_status IN ('confirmado', 'procesando', 'enviado', 'devuelto')
      THEN COALESCE(p_abono_monto, 0)
    ELSE 0
  END;
$$;

-- Las casillas donde la regla de la base NO dice lo que dice CLAUDE.md §8.
-- Vacío es que cuadra.
create or replace function public.regla_del_dinero_cuadra()
returns table (estado text, forma_de_pago text, dice numeric, deberia_decir numeric)
language sql
stable
set search_path = public, pg_catalog
as $$
  with esperado(estado, forma_de_pago, deberia) as (values
    ('pendiente',    'mercadopago',    0),
    ('pendiente',    'contraentrega',  0),
    ('confirmado',   'mercadopago',    0),
    ('confirmado',   'contraentrega',  20000),
    ('pagado',       'mercadopago',    550000),
    ('pagado',       'contraentrega',  550000),
    ('procesando',   'mercadopago',    550000),
    ('procesando',   'contraentrega',  20000),
    ('enviado',      'mercadopago',    550000),
    ('enviado',      'contraentrega',  20000),
    ('entregado',    'mercadopago',    550000),
    ('entregado',    'contraentrega',  550000),
    ('devuelto',     'mercadopago',    0),
    ('devuelto',     'contraentrega',  20000),
    ('cancelado',    'mercadopago',    0),
    ('cancelado',    'contraentrega',  0)
  )
  select e.estado, e.forma_de_pago,
         public.recibido_de(e.estado, e.forma_de_pago, 550000, 20000),
         e.deberia::numeric
    from esperado e
   where public.recibido_de(e.estado, e.forma_de_pago, 550000, 20000)
         is distinct from e.deberia::numeric;
$$;

revoke all on function public.regla_del_dinero_cuadra() from public, anon, authenticated;
grant execute on function public.regla_del_dinero_cuadra() to service_role;
