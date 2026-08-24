-- Lo que llegó a la cuenta, que no es lo que pagó la clienta.
--
-- 23 de agosto de 2026 (el nombre del archivo va en UTC).
--
-- `recibido_de` responde **cuánto entregó la clienta**. Los informes prometían
-- lo otro —«plata que ya entró, con las comisiones descontadas»— y enseñaban
-- lo primero. Con dos abonos de $20.000 cobrados por Mercado Pago, la tarjeta
-- decía $40.000 y debajo «Comisiones −$0». Habían quedado $35.764.
--
-- Y la portada ya decía $35.764, porque tira del libro de caja, que sí lo
-- descuenta: dos pantallas, la misma pregunta, dos respuestas distintas.
--
-- ── La sutileza que importa ─────────────────────────────────────────────────
--
-- **En contraentrega sólo el abono pasa por Mercado Pago.** El resto lo cobra
-- el mensajero en efectivo en la puerta, y de ese dinero la pasarela no ve un
-- peso. A un pedido entregado de $550.000 se le descuenta la comisión de los
-- $20.000 del abono, NO la de los $550.000: descontarla entera se inventaría
-- $26.000 de gasto que nunca ocurrió.
--
-- Y sólo si el abono llegó a pagarse por ahí — `abono_pagado_en` es la prueba.
-- Un pedido cargado a mano en el panel puede llevar `abono_monto` sin haber
-- pasado nunca por la pasarela.
--
-- Esto es el espejo en SQL de `costoDePasarelaDe` y `netoRecibidoDe` de
-- `src/lib/dinero.js`. **Si tocas una, toca la otra**, igual que con
-- `recibido_de` y `venta_viva`.

-- Las tarifas de Mercado Pago Colombia. Mismos números que `src/lib/dinero.js`.
create or replace function public.costo_de_mercado_pago(p_monto numeric)
returns numeric
language sql
immutable
as $$
  SELECT CASE
    WHEN COALESCE(p_monto, 0) <= 0 THEN 0
    ELSE ceil(
      (p_monto * 0.0329 + 800) * 1.19   -- comisión + IVA
      + p_monto * 0.015                 -- retención en la fuente
      + p_monto * 0.00414               -- retención de ICA
    )
  END;
$$;

comment on function public.costo_de_mercado_pago(numeric) is
  'Lo que Mercado Pago descuenta de un cobro. Espejo de costoDeMercadoPago() en src/lib/dinero.js.';

-- Lo que se llevó la pasarela de este pedido.
create or replace function public.costo_de_pasarela_de(
  p_status text, p_payment_method text, p_amount numeric,
  p_abono_monto numeric, p_abono_pagado_en timestamptz
) returns numeric
language sql
immutable
as $$
  SELECT CASE
    WHEN public.recibido_de(p_status, p_payment_method, p_amount, p_abono_monto) <= 0 THEN 0
    WHEN p_payment_method IS DISTINCT FROM 'contraentrega' THEN
      public.costo_de_mercado_pago(
        public.recibido_de(p_status, p_payment_method, p_amount, p_abono_monto))
    -- Contraentrega: sólo el abono pasó por la pasarela, y sólo si se pagó.
    WHEN p_abono_pagado_en IS NULL THEN 0
    ELSE public.costo_de_mercado_pago(
      least(COALESCE(p_abono_monto, 0),
            public.recibido_de(p_status, p_payment_method, p_amount, p_abono_monto)))
  END;
$$;

-- Lo que de verdad quedó, después de la pasarela.
create or replace function public.neto_recibido_de(
  p_status text, p_payment_method text, p_amount numeric,
  p_abono_monto numeric, p_abono_pagado_en timestamptz
) returns numeric
language sql
immutable
as $$
  SELECT public.recibido_de(p_status, p_payment_method, p_amount, p_abono_monto)
       - public.costo_de_pasarela_de(p_status, p_payment_method, p_amount, p_abono_monto, p_abono_pagado_en);
$$;

comment on function public.neto_recibido_de(text, text, numeric, numeric, timestamptz) is
  'Lo que quedó en la cuenta. Espejo de netoRecibidoDe() en src/lib/dinero.js.';

-- Nadie más que el panel.
revoke all on function public.costo_de_mercado_pago(numeric) from public, anon;
revoke all on function public.costo_de_pasarela_de(text, text, numeric, numeric, timestamptz) from public, anon;
revoke all on function public.neto_recibido_de(text, text, numeric, numeric, timestamptz) from public, anon;
grant execute on function public.costo_de_mercado_pago(numeric) to authenticated, service_role;
grant execute on function public.costo_de_pasarela_de(text, text, numeric, numeric, timestamptz) to authenticated, service_role;
grant execute on function public.neto_recibido_de(text, text, numeric, numeric, timestamptz) to authenticated, service_role;

-- ── Y las tres RPC que sumaban en bruto ────────────────────────────────────
-- Las tres se rotulan «ingresos» o «revenue», así que van netas.

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
        COALESCE(sum(public.neto_recibido_de(status, payment_method, amount, abono_monto, abono_pagado_en)), 0) AS revenue
      FROM orders
      WHERE created_at >= now() - (p_dias || ' days')::interval
      GROUP BY order_source
      HAVING count(*) FILTER (WHERE public.venta_viva(status)) > 0
      ORDER BY revenue DESC
    ) t
  );
END;
$function$;

create or replace function public.top_ciudades_envio(p_dias integer default 30)
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
        upper(unaccent(shipping_city)) AS ciudad,
        count(*) FILTER (WHERE public.venta_viva(status)) AS cantidad,
        COALESCE(sum(public.neto_recibido_de(status, payment_method, amount, abono_monto, abono_pagado_en)), 0) AS revenue
      FROM orders
      WHERE shipping_city IS NOT NULL
        AND created_at >= now() - (p_dias || ' days')::interval
      GROUP BY upper(unaccent(shipping_city))
      /* Una ciudad donde sólo hubo pedidos cancelados no es una ciudad donde
         se venda: sin esto salía en el top con cantidad 0. */
      HAVING count(*) FILTER (WHERE public.venta_viva(status)) > 0
      ORDER BY cantidad DESC
      LIMIT 10
    ) t
  );
END;
$function$;

create or replace function public.tendencia_comparativa()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
DECLARE
  v_inicio_mes_actual   date := date_trunc('month', now())::date;
  v_inicio_mes_anterior date := (date_trunc('month', now()) - interval '1 month')::date;
  v_fin_mes_anterior    date := (date_trunc('month', now()) - interval '1 day')::date;
  v_pedidos_actual int;   v_revenue_actual numeric;   v_conversaciones_actual int;
  v_pedidos_anterior int; v_revenue_anterior numeric; v_conversaciones_anterior int;
BEGIN
  /* `venta_viva` para contar y `neto_recibido_de` para sumar: las mismas de
     CLAUDE.md §8 que usa el resto del panel, ya netas de la pasarela. */
  SELECT count(*) FILTER (WHERE public.venta_viva(status)),
         COALESCE(sum(public.neto_recibido_de(status, payment_method, amount, abono_monto, abono_pagado_en)), 0)
    INTO v_pedidos_actual, v_revenue_actual
  FROM orders WHERE created_at >= v_inicio_mes_actual;

  SELECT count(DISTINCT phone_number) INTO v_conversaciones_actual
  FROM whatsapp_conversaciones WHERE created_at >= v_inicio_mes_actual;

  SELECT count(*) FILTER (WHERE public.venta_viva(status)),
         COALESCE(sum(public.neto_recibido_de(status, payment_method, amount, abono_monto, abono_pagado_en)), 0)
    INTO v_pedidos_anterior, v_revenue_anterior
  FROM orders
  WHERE created_at >= v_inicio_mes_anterior AND created_at <= v_fin_mes_anterior;

  SELECT count(DISTINCT phone_number) INTO v_conversaciones_anterior
  FROM whatsapp_conversaciones
  WHERE created_at >= v_inicio_mes_anterior AND created_at <= v_fin_mes_anterior;

  RETURN jsonb_build_object(
    'mes_actual', jsonb_build_object(
      'pedidos', COALESCE(v_pedidos_actual, 0),
      'revenue', COALESCE(v_revenue_actual, 0),
      'conversaciones', COALESCE(v_conversaciones_actual, 0)),
    'mes_anterior', jsonb_build_object(
      'pedidos', COALESCE(v_pedidos_anterior, 0),
      'revenue', COALESCE(v_revenue_anterior, 0),
      'conversaciones', COALESCE(v_conversaciones_anterior, 0))
  );
END;
$function$;
