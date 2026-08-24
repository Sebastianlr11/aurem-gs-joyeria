-- Las cinco RPC que sólo vivían en la base, y lo que decían.
--
-- 23 de agosto de 2026 (el nombre del archivo va en UTC).
--
-- QUÉ ES ESTO
-- Hasta hoy el repositorio tenía los PERMISOS de estas cinco funciones
-- —`20260823_las_rpc_estaban_abiertas.sql`— pero no sus cuerpos. Existían sólo
-- dentro de Postgres, escritas a mano en el panel de Supabase. Consecuencia:
-- un entorno nuevo levantaba el panel entero salvo cinco gráficas de Reportes,
-- y **nadie las había leído nunca en un diff**.
--
-- Al leerlas apareció lo que se temía: el mismo fallo de `revenue_por_fuente`,
-- que decía 331 veces más de lo que había entrado, estaba **en dos funciones
-- más**. Y una tercera decía justo lo contrario de lo que existe para medir.
--
-- ── Lo que decían, medido el 23 de agosto de 2026 ───────────────────────────
--
--   tendencia_comparativa   revenue del mes: $13.239.000   entró: $40.000
--   top_ciudades_envio      Bogotá: $13.239.000, 18         entró: $40.000, 2
--   clientes_nuevos_vs_...  3 nuevos, 0 recurrentes         es UNA persona
--
-- Las dos primeras sumaban `amount` de TODOS los pedidos: los cancelados, los
-- que nadie ha pagado y los contraentrega en camino, cuya plata todavía está
-- en el bolsillo del cliente. Es exactamente la tabla de CLAUDE.md §8 que el
-- panel respeta en JavaScript con `recibidoDe` y que la base respeta con
-- `recibido_de` desde ayer. Estas dos no llamaban a ninguna de las dos.
--
-- La tercera es peor por sutil: contaba clientes por `customer_phone` EN
-- CRUDO, y el mismo número entra de tres formas según el canal —`3143602930`
-- desde el panel, `+573143602930` desde el checkout, `573143602930` desde
-- WhatsApp—. Con 18 pedidos hay **3 cadenas distintas y una sola persona**.
-- Así que la gráfica de fidelidad decía «3 clientes nuevos, ninguno
-- recurrente» sobre alguien que ha pedido varias veces: el revés justo de lo
-- que la función existe para medir. Es el mismo fallo que
-- `20260823_un_cliente_por_persona.sql` arregló en `customers`, por la puerta
-- de al lado.
--
-- ── Lo que NO se cambia aquí, y por qué ────────────────────────────────────
--
-- Ninguna de estas funciones filtra `es_prueba`, y se quedan así. No es un
-- descuido: el lente de pruebas es un interruptor de la interfaz y una RPC
-- agregada no puede saber cómo está puesto. Hacerlo por dentro rompería el
-- lente en la otra dirección — encenderlo dejaría de enseñar las pruebas. Lo
-- que sí era un fallo es que `analiticas_whatsapp` lo filtrara **en el
-- numerador y no en el denominador**, lo que hundía la tasa de conversión sin
-- que se notara; eso se corrige dejando los dos lados de acuerdo.
--
-- Queda dicho en `docs/specs/admin-reportes-y-pauta.md`: hoy la pantalla mezcla
-- números que obedecen al lente con números que no.

-- ── 1. buscar_conversaciones ────────────────────────────────────────────────
-- Sin cambios: sólo se trae al repositorio. Busca texto en los chats para el
-- panel; el `limit 50` es lo que impide que una letra suelta devuelva la
-- correspondencia entera.
create or replace function public.buscar_conversaciones(p_query text)
returns table(phone_number text, content text, created_at timestamptz, role text)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
BEGIN
  RETURN QUERY
  SELECT wc.phone_number, wc.content, wc.created_at, wc.role
  FROM whatsapp_conversaciones wc
  WHERE wc.content ILIKE '%' || p_query || '%'
  ORDER BY wc.created_at DESC
  LIMIT 50;
END;
$function$;

-- ── 2. tendencia_comparativa ────────────────────────────────────────────────
-- Este mes contra el anterior. Decía $13.239.000 de un mes en el que entraron
-- $40.000.
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
  /* `venta_viva` para contar y `recibido_de` para sumar: las dos son las
     mismas de CLAUDE.md §8 que usa el resto del panel, y el vigía comprueba
     cada hora que sigan diciendo lo que dice esa tabla. */
  SELECT count(*) FILTER (WHERE public.venta_viva(status)),
         COALESCE(sum(public.recibido_de(status, payment_method, amount, abono_monto)), 0)
    INTO v_pedidos_actual, v_revenue_actual
  FROM orders WHERE created_at >= v_inicio_mes_actual;

  SELECT count(DISTINCT phone_number) INTO v_conversaciones_actual
  FROM whatsapp_conversaciones WHERE created_at >= v_inicio_mes_actual;

  SELECT count(*) FILTER (WHERE public.venta_viva(status)),
         COALESCE(sum(public.recibido_de(status, payment_method, amount, abono_monto)), 0)
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

-- ── 3. top_ciudades_envio ───────────────────────────────────────────────────
-- A dónde se despacha y cuánto deja. Decía que Bogotá había dejado
-- $13.239.000 en 18 pedidos; eran $40.000 en 2.
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
        COALESCE(sum(public.recibido_de(status, payment_method, amount, abono_monto)), 0) AS revenue
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

-- ── 4. clientes_nuevos_vs_recurrentes ───────────────────────────────────────
-- Cuántos vuelven. Contaba por la cadena cruda del teléfono, así que una misma
-- persona con el número guardado de dos formas contaba como dos clientes
-- nuevos y como ningún recurrente.
create or replace function public.clientes_nuevos_vs_recurrentes(p_dias integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
DECLARE
  v_nuevos int;
  v_recurrentes int;
  v_desde timestamptz := now() - (p_dias || ' days')::interval;
BEGIN
  /* Los últimos diez dígitos, la misma expresión del índice único de
     `customers`. Un pedido que no llegó a ser venta no hace cliente a nadie,
     así que se cuentan sólo los vivos. */
  WITH pedidos AS (
    SELECT right(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g'), 10) AS persona,
           created_at
    FROM orders
    WHERE customer_phone IS NOT NULL
      AND public.venta_viva(status)
  ),
  antes AS (SELECT DISTINCT persona FROM pedidos WHERE created_at <  v_desde),
  dentro AS (SELECT DISTINCT persona FROM pedidos WHERE created_at >= v_desde)
  SELECT count(*) FILTER (WHERE a.persona IS NULL),
         count(*) FILTER (WHERE a.persona IS NOT NULL)
    INTO v_nuevos, v_recurrentes
  FROM dentro d LEFT JOIN antes a USING (persona)
  WHERE d.persona <> '';

  RETURN jsonb_build_object(
    'nuevos', COALESCE(v_nuevos, 0),
    'recurrentes', COALESCE(v_recurrentes, 0),
    'total', COALESCE(v_nuevos, 0) + COALESCE(v_recurrentes, 0)
  );
END;
$function$;

-- ── 5. analiticas_whatsapp ──────────────────────────────────────────────────
-- Cuántas conversaciones acaban en pedido, y cuánto se tarda en contestar.
create or replace function public.analiticas_whatsapp(p_dias integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
DECLARE
  v_desde timestamptz := now() - (p_dias || ' days')::interval;
  v_total_conversaciones int;
  v_conversaciones_con_pedido int;
  v_tiempo_respuesta_seg numeric;
  v_mensajes_totales int;
BEGIN
  SELECT count(DISTINCT phone_number), count(*)
    INTO v_total_conversaciones, v_mensajes_totales
  FROM whatsapp_conversaciones WHERE created_at >= v_desde;

  /* Los dos lados de la fracción tienen que contar lo mismo.
     El numerador filtraba `es_prueba = false` y el denominador —todas las
     conversaciones— no, así que los chats del equipo restaban en abajo y no
     sumaban en arriba: la tasa de conversión salía más baja de lo real y no
     había forma de verlo. Ninguno de los dos filtra ahora, igual que el resto
     de las RPC; el lente de pruebas vive en la interfaz.

     Y se cruzan por los últimos diez dígitos, no por la cadena: el teléfono de
     un pedido y el de su conversación casi nunca vienen del mismo sitio. */
  SELECT count(DISTINCT right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 10))
    INTO v_conversaciones_con_pedido
  FROM orders o
  WHERE o.order_source = 'whatsapp'
    AND o.created_at >= v_desde
    AND right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 10) IN (
      SELECT right(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'), 10)
      FROM whatsapp_conversaciones WHERE created_at >= v_desde
    );

  /* Cuánto tarda en contestar. Sólo cuenta lo que respondió dentro de diez
     minutos: más allá de eso no es "tardó en contestar", es otra conversación
     y promediarlo desdibuja el número que interesa. */
  WITH pares AS (
    SELECT a.phone_number, a.created_at AS msg_user,
      (SELECT min(b.created_at) FROM whatsapp_conversaciones b
       WHERE b.phone_number = a.phone_number AND b.role = 'assistant'
         AND b.created_at > a.created_at
         AND b.created_at < a.created_at + interval '10 minutes') AS msg_assistant
    FROM whatsapp_conversaciones a
    WHERE a.role = 'user' AND a.created_at >= v_desde
  )
  SELECT round(avg(EXTRACT(EPOCH FROM (msg_assistant - msg_user)))::numeric, 1)
    INTO v_tiempo_respuesta_seg FROM pares WHERE msg_assistant IS NOT NULL;

  RETURN jsonb_build_object(
    'total_conversaciones', COALESCE(v_total_conversaciones, 0),
    'conversaciones_con_pedido', COALESCE(v_conversaciones_con_pedido, 0),
    'tasa_conversion', CASE WHEN v_total_conversaciones > 0
      THEN round((v_conversaciones_con_pedido::numeric / v_total_conversaciones * 100), 1) ELSE 0 END,
    'tiempo_respuesta_seg', COALESCE(v_tiempo_respuesta_seg, 0),
    'tiempo_respuesta_min', CASE
      WHEN v_tiempo_respuesta_seg IS NOT NULL AND v_tiempo_respuesta_seg > 0
      THEN round(v_tiempo_respuesta_seg / 60.0, 1) ELSE 0 END,
    'mensajes_totales', COALESCE(v_mensajes_totales, 0)
  );
END;
$function$;

-- Los permisos, otra vez. `create or replace` los conserva, pero declararlos
-- aquí es lo que hace que un entorno nuevo quede igual que producción sin
-- depender del orden en que se apliquen las migraciones.
revoke all on function public.buscar_conversaciones(text)            from public, anon;
revoke all on function public.tendencia_comparativa()                from public, anon;
revoke all on function public.top_ciudades_envio(integer)            from public, anon;
revoke all on function public.clientes_nuevos_vs_recurrentes(integer) from public, anon;
revoke all on function public.analiticas_whatsapp(integer)           from public, anon;

grant execute on function public.buscar_conversaciones(text)             to authenticated, service_role;
grant execute on function public.tendencia_comparativa()                 to authenticated, service_role;
grant execute on function public.top_ciudades_envio(integer)             to authenticated, service_role;
grant execute on function public.clientes_nuevos_vs_recurrentes(integer) to authenticated, service_role;
grant execute on function public.analiticas_whatsapp(integer)            to authenticated, service_role;
