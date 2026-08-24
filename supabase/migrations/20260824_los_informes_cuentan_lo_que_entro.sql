-- ============================================================================
-- LOS INFORMES CUENTAN LO QUE ENTRÓ
-- ============================================================================
-- 23 de agosto de 2026 (el nombre del archivo va en UTC). Tramo 2 de ordenar el circuito del pedido.
--
-- Al añadir `confirmado` y `devuelto` había que revisar quién más decide qué
-- es una venta. Aparecieron TRES copias más de la misma idea, y una mentía.
--
-- ── `revenue_por_fuente`, 331 veces inflado ─────────────────────────────────
--
-- Sumaba `amount` de TODOS los pedidos, sin mirar el estado. Con los datos de
-- ese día decía **$13.239.000 de 18 pedidos** cuando lo que había entrado eran
-- **$40.000 de 2**: contaba los cancelados —14 de los 18— y contaba los
-- contraentrega a precio completo aunque sólo hubiera entrado el abono.
--
-- Y lo peor no es el número: es que la portada del panel respondía la MISMA
-- pregunta bien, en JavaScript. Dos respuestas distintas a «de dónde vienen las
-- ventas» en la misma aplicación, y la de Reportes era la mentirosa. Es el
-- número con el que se decide dónde poner la pauta.
--
-- ── `embudo_whatsapp` ───────────────────────────────────────────────────────
--
-- Llevaba su propia lista de estados para contar los convertidos. Le faltaba
-- `confirmado` —un pedido con el abono pagado no contaba— y habría contado los
-- devueltos el día que existieran.
--
-- ── `VENTAS_VIVAS` (en el panel) ────────────────────────────────────────────
--
-- Una tercera copia, en JavaScript, con el mismo hueco. Se borró: quien la
-- usaba pregunta ahora por `estaVivo`, que es de donde nunca debió salir.
--
-- ── La forma de que no vuelva ───────────────────────────────────────────────
--
-- `venta_viva(status)` es el espejo en SQL de `estaVivo`, igual que
-- `recibido_de` lo es de `recibidoDe`. Y `regla_del_dinero_cuadra()` compara
-- las DOS contra la tabla de CLAUDE.md §8; el vigía la consulta cada hora.
-- Comprobado rompiendo las dos a propósito: caza cada casilla que se separa.
-- ============================================================================

create or replace function public.venta_viva(p_status text)
returns boolean
language sql
immutable
as $$
  SELECT COALESCE(p_status, '') NOT IN ('pendiente', 'cancelado', 'devuelto');
$$;

comment on function public.venta_viva(text) is
  'Si el pedido sigue siendo una venta viva. Espejo en SQL de estaVivo (src/lib/dinero.js). Fuera quedan el principio y los tres finales: pendiente, cancelado y devuelto.';

create or replace function public.revenue_por_fuente(p_dias integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        COALESCE(order_source, 'desconocido') AS fuente,
        count(*) FILTER (WHERE public.venta_viva(status)) AS cantidad,
        COALESCE(sum(public.recibido_de(status, payment_method, amount, abono_monto)), 0) AS revenue
      FROM orders
      WHERE created_at >= now() - (p_dias || ' days')::interval
      GROUP BY order_source
      HAVING count(*) FILTER (WHERE public.venta_viva(status)) > 0
      ORDER BY revenue DESC
    ) t
  );
END;
$function$;

create or replace function public.embudo_whatsapp(p_dias integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
DECLARE
  v_desde timestamptz := now() - (p_dias || ' days')::interval;
  v_conversaciones int;
  v_interesados int;
  v_pedidos int;
  v_pagados int;
BEGIN
  SELECT count(DISTINCT phone_number) INTO v_conversaciones
  FROM whatsapp_conversaciones
  WHERE role = 'user' AND created_at >= v_desde;

  -- Interesados: conversaciones donde Valentina llegó a decir un precio.
  SELECT count(DISTINCT wc.phone_number) INTO v_interesados
  FROM whatsapp_conversaciones wc
  WHERE wc.role = 'assistant' AND wc.created_at >= v_desde
    AND wc.content ~ '\$[0-9]{1,3}(\.[0-9]{3})*';

  SELECT count(DISTINCT customer_phone) INTO v_pedidos
  FROM orders
  WHERE order_source = 'whatsapp' AND created_at >= v_desde AND es_prueba = false;

  SELECT count(DISTINCT customer_phone) INTO v_pagados
  FROM orders
  WHERE order_source = 'whatsapp' AND created_at >= v_desde AND es_prueba = false
    AND public.venta_viva(status);

  RETURN jsonb_build_object(
    'conversaciones', COALESCE(v_conversaciones, 0),
    'interesados', COALESCE(v_interesados, 0),
    'pedidos', COALESCE(v_pedidos, 0),
    'pagados', COALESCE(v_pagados, 0)
  );
END;
$function$;

drop function if exists public.regla_del_dinero_cuadra();

create or replace function public.regla_del_dinero_cuadra()
returns table (regla text, caso text, dice text, deberia_decir text)
language sql
stable
set search_path = public, pg_catalog
as $$
  with dinero(estado, forma, deberia) as (values
    ('pendiente','mercadopago',0), ('pendiente','contraentrega',0),
    ('confirmado','mercadopago',0), ('confirmado','contraentrega',20000),
    ('pagado','mercadopago',550000), ('pagado','contraentrega',550000),
    ('procesando','mercadopago',550000), ('procesando','contraentrega',20000),
    ('enviado','mercadopago',550000), ('enviado','contraentrega',20000),
    ('entregado','mercadopago',550000), ('entregado','contraentrega',550000),
    ('devuelto','mercadopago',0), ('devuelto','contraentrega',20000),
    ('cancelado','mercadopago',0), ('cancelado','contraentrega',0)
  ), vivos(estado, deberia) as (values
    ('pendiente',false), ('confirmado',true), ('pagado',true), ('procesando',true),
    ('enviado',true), ('entregado',true), ('devuelto',false), ('cancelado',false)
  )
  select 'recibido_de', d.estado || ' · ' || d.forma,
         public.recibido_de(d.estado, d.forma, 550000, 20000)::text, d.deberia::text
    from dinero d
   where public.recibido_de(d.estado, d.forma, 550000, 20000) is distinct from d.deberia::numeric
  union all
  select 'venta_viva', v.estado,
         public.venta_viva(v.estado)::text, v.deberia::text
    from vivos v
   where public.venta_viva(v.estado) is distinct from v.deberia;
$$;

revoke all on function public.regla_del_dinero_cuadra() from public, anon, authenticated;
grant execute on function public.regla_del_dinero_cuadra() to service_role;
