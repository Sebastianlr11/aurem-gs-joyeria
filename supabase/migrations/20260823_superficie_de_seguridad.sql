-- La superficie de seguridad de la base, en el repositorio.
--
-- QUÉ ES ESTO
-- Un volcado de lo que hay HOY en producción: en qué tablas está encendido el
-- RLS, las 24 políticas que dicen quién puede tocar qué, las 21 funciones y
-- los 6 disparadores. Generado desde el catálogo de Postgres —pg_policies,
-- pg_get_functiondef, pg_get_triggerdef— y no escrito a mano.
--
-- POR QUÉ HACÍA FALTA
-- Cinco tablas de conversaciones estuvieron abiertas a la llave pública hasta
-- el 22 de agosto de 2026, y nadie lo vio en meses. No por descuido: una
-- política que no está en el repositorio no aparece en ningún diff, así que no
-- hay dónde verla. El mismo hueco hizo que docs/pendientes.md afirmara que los
-- pedidos estaban expuestos cuando no lo estaban — el archivo de migración
-- decía una cosa y la base otra, y no había forma de notarlo leyendo el repo.
--
-- A partir de ahora, cambiar un permiso deja rastro en un commit.
--
-- QUÉ **NO** ES
-- No levanta un entorno vacío. Faltan las tablas: casi ninguna está versionada
-- y sin ellas esto no se puede reproducir. Es un REGISTRO diffeable, no una
-- receta. El volcado completo necesita `supabase db pull`, que pide la
-- contraseña de la base.
--
-- Tampoco están los dos trabajos de pg_cron (`avisos-whatsapp` y `vigilancia`)
-- ni las políticas de Storage: viven fuera del esquema public. Se consultan
-- con `select jobname, schedule from cron.job`.
--
-- CÓMO SE ACTUALIZA
-- No a mano. Se vuelve a generar cuando cambie algo, y se mira el diff: si
-- aparece una política que nadie recuerda haber escrito, ahí está la pregunta
-- que este archivo existe para provocar.
--
-- Idempotente: las políticas y los disparadores llevan su DROP delante y las
-- funciones van con CREATE OR REPLACE.

/* ══ 1. Row Level Security: dónde está encendido ══ */

ALTER TABLE public.ajustes_internos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_status ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_takeover ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gasto_pauta ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plantillas_enviadas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.taller_conocimiento ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.taller_precios ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vigilancia_ultima ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_conversaciones ENABLE ROW LEVEL SECURITY;


/* ══ 2. Políticas: quién puede tocar qué ══ */

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.notes;
CREATE POLICY "Allow all for authenticated users" ON public.notes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Auth full access" ON public.chat_status;
CREATE POLICY "Auth full access" ON public.chat_status
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Auth full access" ON public.contact_tags;
CREATE POLICY "Auth full access" ON public.contact_tags
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "el equipo anota el gasto" ON public.gasto_pauta;
CREATE POLICY "el equipo anota el gasto" ON public.gasto_pauta
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "el equipo borra el gasto" ON public.gasto_pauta;
CREATE POLICY "el equipo borra el gasto" ON public.gasto_pauta
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "el equipo corrige el gasto" ON public.gasto_pauta;
CREATE POLICY "el equipo corrige el gasto" ON public.gasto_pauta
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "el equipo maneja el control manual" ON public.chat_takeover;
CREATE POLICY "el equipo maneja el control manual" ON public.chat_takeover
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "el equipo ve el gasto" ON public.gasto_pauta;
CREATE POLICY "el equipo ve el gasto" ON public.gasto_pauta
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "el equipo ve el libro de caja" ON public.pagos;
CREATE POLICY "el equipo ve el libro de caja" ON public.pagos
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "el equipo ve la vigilancia" ON public.vigilancia_ultima;
CREATE POLICY "el equipo ve la vigilancia" ON public.vigilancia_ultima
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "el equipo ve las piezas del pedido" ON public.order_items;
CREATE POLICY "el equipo ve las piezas del pedido" ON public.order_items
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "el equipo ve y escribe las conversaciones" ON public.whatsapp_conversaciones;
CREATE POLICY "el equipo ve y escribe las conversaciones" ON public.whatsapp_conversaciones
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS conocimiento_auth_read ON public.taller_conocimiento;
CREATE POLICY conocimiento_auth_read ON public.taller_conocimiento
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS conocimiento_auth_write ON public.taller_conocimiento;
CREATE POLICY conocimiento_auth_write ON public.taller_conocimiento
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customers_auth_all ON public.customers;
CREATE POLICY customers_auth_all ON public.customers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orders_auth_all ON public.orders;
CREATE POLICY orders_auth_all ON public.orders
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS plantillas_enviadas_lectura_admin ON public.plantillas_enviadas;
CREATE POLICY plantillas_enviadas_lectura_admin ON public.plantillas_enviadas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS products_auth_delete ON public.products;
CREATE POLICY products_auth_delete ON public.products
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS products_auth_insert ON public.products;
CREATE POLICY products_auth_insert ON public.products
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS products_auth_update ON public.products;
CREATE POLICY products_auth_update ON public.products
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS taller_precios_auth_read ON public.taller_precios;
CREATE POLICY taller_precios_auth_read ON public.taller_precios
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS taller_precios_auth_update ON public.taller_precios;
CREATE POLICY taller_precios_auth_update ON public.taller_precios
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


/* ══ 3. Funciones ══ */

CREATE OR REPLACE FUNCTION public.analiticas_whatsapp(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_desde timestamptz := now() - (p_dias || ' days')::interval;
  v_total_conversaciones int;
  v_conversaciones_con_pedido int;
  v_tiempo_respuesta_seg numeric;
  v_mensajes_totales int;
BEGIN
  SELECT count(DISTINCT phone_number) INTO v_total_conversaciones
  FROM whatsapp_conversaciones WHERE created_at >= v_desde;

  SELECT count(DISTINCT o.customer_phone) INTO v_conversaciones_con_pedido
  FROM orders o
  WHERE o.order_source = 'whatsapp' AND o.created_at >= v_desde
    AND o.es_prueba = false
    AND o.customer_phone IN (
      SELECT DISTINCT phone_number FROM whatsapp_conversaciones WHERE created_at >= v_desde
    );

  SELECT count(*) INTO v_mensajes_totales
  FROM whatsapp_conversaciones WHERE created_at >= v_desde;

  /* Cuánto tarda en contestar. Sólo cuenta lo que respondió dentro de diez
     minutos: más allá de eso no es "tardó en contestar", es otra conversación
     y promediarlo desdibuja el número que interesa. */
  WITH pares AS (
    SELECT a.phone_number, a.created_at AS msg_user,
      (SELECT min(b.created_at) FROM whatsapp_conversaciones b
       WHERE b.phone_number = a.phone_number AND b.role = 'assistant'
         AND b.created_at > a.created_at AND b.created_at < a.created_at + interval '10 minutes'
      ) AS msg_assistant
    FROM whatsapp_conversaciones a
    WHERE a.role = 'user' AND a.created_at >= v_desde
  )
  SELECT round(avg(EXTRACT(EPOCH FROM (msg_assistant - msg_user)))::numeric, 1)
  INTO v_tiempo_respuesta_seg FROM pares WHERE msg_assistant IS NOT NULL;

  RETURN jsonb_build_object(
    'total_conversaciones', COALESCE(v_total_conversaciones, 0),
    'conversaciones_con_pedido', COALESCE(v_conversaciones_con_pedido, 0),
    'tasa_conversion', CASE
      WHEN v_total_conversaciones > 0
      THEN round((v_conversaciones_con_pedido::numeric / v_total_conversaciones * 100), 1)
      ELSE 0 END,
    'tiempo_respuesta_seg', COALESCE(v_tiempo_respuesta_seg, 0),
    'tiempo_respuesta_min', CASE
      WHEN v_tiempo_respuesta_seg IS NOT NULL AND v_tiempo_respuesta_seg > 0
      THEN round(v_tiempo_respuesta_seg / 60.0, 1)
      ELSE 0 END,
    'mensajes_totales', COALESCE(v_mensajes_totales, 0)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_conversaciones(p_query text)
 RETURNS TABLE(phone_number text, content text, created_at timestamp with time zone, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    wc.phone_number,
    wc.content,
    wc.created_at,
    wc.role
  FROM whatsapp_conversaciones wc
  WHERE wc.content ILIKE '%' || p_query || '%'
  ORDER BY wc.created_at DESC
  LIMIT 50;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_productos(p_query text, p_limite integer DEFAULT 4)
 RETURNS TABLE(id uuid, nombre text, descripcion text, precio numeric, precio_oferta numeric, categoria text, imagen text, is_new boolean, is_featured boolean, precio_cop text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name::TEXT,
    p.description::TEXT,
    p.price,
    p.compare_price,
    p.category::TEXT,
    COALESCE(p.image_url, p.images[1])::TEXT,
    p.is_new,
    p.is_featured,
    '$' || TO_CHAR(p.price, 'FM999G999G999') || ' COP' AS precio_cop
  FROM public.products p
  WHERE
    p.name        ILIKE '%' || p_query || '%'
    OR p.description ILIKE '%' || p_query || '%'
    OR p.category    ILIKE '%' || p_query || '%'
  ORDER BY
    CASE WHEN p.name ILIKE '%' || p_query || '%' THEN 0 ELSE 1 END,
    p.is_featured DESC,
    p.price ASC
  LIMIT p_limite;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_duplicate_pending_orders()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Cuando se inserta un pedido nuevo, cancelar pedidos pendientes
  -- del mismo cliente y producto (evita duplicados por cambio de método de pago)
  UPDATE orders
  SET status = 'cancelado'
  WHERE id != NEW.id
    AND status = 'pendiente'
    AND product_name = NEW.product_name
    AND (
      (NEW.customer_phone IS NOT NULL AND customer_phone = NEW.customer_phone)
      OR
      (NEW.customer_phone IS NULL AND NEW.customer_email IS NOT NULL AND customer_email = NEW.customer_email)
    );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.chats_sin_responder()
 RETURNS TABLE(phone_number text, content text, message_type text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.phone_number, u.content, u.message_type, u.created_at
    FROM (
      SELECT DISTINCT ON (c.phone_number)
             c.phone_number, c.role, c.content, c.message_type, c.created_at
        FROM public.whatsapp_conversaciones c
       ORDER BY c.phone_number, c.created_at DESC
    ) u
   WHERE u.role = 'user'
   ORDER BY u.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.clientes_nuevos_vs_recurrentes(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_nuevos int;
  v_recurrentes int;
  v_desde timestamptz := now() - (p_dias || ' days')::interval;
BEGIN
  -- Nuevos: su primer pedido está dentro del periodo
  SELECT count(DISTINCT customer_phone) INTO v_nuevos
  FROM orders
  WHERE created_at >= v_desde
    AND customer_phone IS NOT NULL
    AND customer_phone NOT IN (
      SELECT DISTINCT customer_phone 
      FROM orders 
      WHERE created_at < v_desde 
        AND customer_phone IS NOT NULL
    );

  -- Recurrentes: tienen pedidos antes Y durante el periodo
  SELECT count(DISTINCT customer_phone) INTO v_recurrentes
  FROM orders
  WHERE created_at >= v_desde
    AND customer_phone IS NOT NULL
    AND customer_phone IN (
      SELECT DISTINCT customer_phone 
      FROM orders 
      WHERE created_at < v_desde 
        AND customer_phone IS NOT NULL
    );

  RETURN jsonb_build_object(
    'nuevos', COALESCE(v_nuevos, 0),
    'recurrentes', COALESCE(v_recurrentes, 0),
    'total', COALESCE(v_nuevos, 0) + COALESCE(v_recurrentes, 0)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.conversaciones_purgables(p_meses integer DEFAULT 12)
 RETURNS TABLE(phone_number text, ultimo_mensaje timestamp with time zone, mensajes bigint, fotos bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with hilos as (
    select c.phone_number,
           max(c.created_at) as ultimo_mensaje,
           count(*)          as mensajes,
           count(*) filter (
             where c.message_type = 'image' and c.media_url is not null
           ) as fotos,
           right(regexp_replace(c.phone_number, '\D', '', 'g'), 10) as clave
      from public.whatsapp_conversaciones c
     group by c.phone_number
  ),
  compradores as (
    select distinct right(regexp_replace(o.customer_phone, '\D', '', 'g'), 10) as clave
      from public.orders o
     where o.es_prueba = false
       and o.customer_phone is not null
  )
  select h.phone_number, h.ultimo_mensaje, h.mensajes, h.fotos
    from hilos h
   where h.ultimo_mensaje < now() - make_interval(months => greatest(p_meses, 1))
     and not exists (
       select 1 from compradores k where k.clave = h.clave
     )
     and not exists (
       select 1 from public.chat_takeover t
        where t.phone_number = h.phone_number and t.is_active
     )
   order by h.ultimo_mensaje asc;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_orden_whatsapp(p_customer_name text, p_customer_phone text, p_customer_email text DEFAULT NULL::text, p_product_id uuid DEFAULT NULL::uuid, p_product_name text DEFAULT NULL::text, p_amount numeric DEFAULT 0, p_payment_method text DEFAULT 'contraentrega'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_order_id UUID;
  v_status   TEXT;
BEGIN
  v_status := 'pendiente';

  INSERT INTO public.customers (name, phone, email)
  VALUES (p_customer_name, p_customer_phone, p_customer_email)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.orders (
    customer_name,
    customer_phone,
    customer_email,
    product_id,
    product_name,
    amount,
    status,
    notes
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    COALESCE(p_customer_email, ''),
    p_product_id,
    p_product_name,
    p_amount,
    v_status,
    COALESCE(p_notes, 'Pedido via WhatsApp — ' || p_payment_method)
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id',      v_order_id,
    'status',        v_status,
    'product_name',  p_product_name,
    'amount',        p_amount,
    'amount_cop',    '$' || TO_CHAR(p_amount, 'FM999G999G999') || ' COP'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.embudo_whatsapp(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    AND status IN ('pagado', 'procesando', 'enviado', 'entregado');

  RETURN jsonb_build_object(
    'conversaciones', COALESCE(v_conversaciones, 0),
    'interesados', COALESCE(v_interesados, 0),
    'pedidos', COALESCE(v_pedidos, 0),
    'pagados', COALESCE(v_pagados, 0)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_cliente_de_prueba()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  contactos  text[];
  tel_limpio text;
BEGIN
  IF new.es_prueba THEN
    RETURN new;
  END IF;

  SELECT string_to_array(lower(valor), ',') INTO contactos
    FROM ajustes_internos WHERE clave = 'contactos_equipo';

  IF contactos IS NULL THEN
    RETURN new;
  END IF;

  tel_limpio := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10);

  IF lower(coalesce(new.email, '')) = ANY(contactos)
     OR (tel_limpio <> '' AND EXISTS (
           SELECT 1 FROM unnest(contactos) c
            WHERE right(regexp_replace(c, '\D', '', 'g'), 10) = tel_limpio
         ))
  THEN
    new.es_prueba := true;
  END IF;

  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_pedido_de_prueba()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  contactos text[];
  tel_limpio text;
begin
  -- Si ya viene marcado a mano, se respeta.
  if new.es_prueba then
    return new;
  end if;

  select string_to_array(lower(valor), ',') into contactos
  from ajustes_internos where clave = 'contactos_equipo';

  if contactos is null then
    return new;
  end if;

  -- El mismo número aparece como 3143602930, +573143602930 y 573143602930
  -- según por dónde entre. Se comparan sólo los dígitos, y los últimos diez,
  -- que es el número colombiano sin indicativo.
  tel_limpio := right(regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g'), 10);

  if lower(coalesce(new.customer_email, '')) = any(contactos)
     or (tel_limpio <> '' and exists (
           select 1 from unnest(contactos) c
           where right(regexp_replace(c, '\D', '', 'g'), 10) = tel_limpio
         ))
  then
    new.es_prueba := true;
  end if;

  return new;
end;
$function$
;

/* Aquí estaban `guardar_mensajes` y `obtener_conversacion`, las dos de la era
   n8n. Se quitan de este archivo —no sólo se borran en
   `20260823_las_rpc_estaban_abiertas.sql`— porque **no se podían ni crear** en
   un entorno nuevo: `obtener_conversacion` declaraba una variable del tipo de
   la tabla `conversaciones`, y CREATE FUNCTION sí valida eso. Comprobado.
   Dejarlas aquí habría partido la cadena de migraciones en este punto. */
CREATE OR REPLACE FUNCTION public.pedido_publico(p_id uuid)
 RETURNS TABLE(amount numeric, abono_monto numeric, payment_method text, product_id uuid, product_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.amount, o.abono_monto, o.payment_method, o.product_id, o.product_name
    FROM public.orders o
   WHERE o.id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.recibido_de(p_status text, p_payment_method text, p_amount numeric, p_abono_monto numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_status IN ('cancelado', 'pendiente') THEN 0
    WHEN p_payment_method IS DISTINCT FROM 'contraentrega' THEN
      CASE WHEN p_status IN ('pagado', 'procesando', 'enviado', 'entregado')
           THEN COALESCE(p_amount, 0) ELSE 0 END
    WHEN p_status IN ('entregado', 'pagado') THEN COALESCE(p_amount, 0)
    WHEN p_status IN ('procesando', 'enviado') THEN COALESCE(p_abono_monto, 0)
    ELSE 0
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deberia  numeric;
  v_anotado  numeric;
  v_delta    numeric;
  v_concepto text;
  v_cuando   timestamptz;
  v_cod      boolean := NEW.payment_method IS NOT DISTINCT FROM 'contraentrega';
BEGIN
  v_deberia := recibido_de(NEW.status, NEW.payment_method, NEW.amount, NEW.abono_monto);
  SELECT COALESCE(sum(monto), 0) INTO v_anotado FROM pagos WHERE order_id = NEW.id;
  v_delta := v_deberia - v_anotado;

  IF v_delta = 0 THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.abono_pagado_en IS NOT NULL
     AND NEW.abono_pagado_en IS DISTINCT FROM OLD.abono_pagado_en THEN
    v_cuando := NEW.abono_pagado_en;
  ELSIF TG_OP = 'INSERT' THEN
    v_cuando := COALESCE(NEW.abono_pagado_en, NEW.created_at, now());
  ELSE
    v_cuando := now();
  END IF;

  v_concepto := CASE
    WHEN v_delta < 0                                         THEN 'reverso'
    WHEN v_cod AND v_anotado > 0                             THEN 'saldo'
    WHEN v_cod AND v_deberia = COALESCE(NEW.abono_monto, -1) THEN 'abono'
    ELSE 'total'
  END;

  INSERT INTO pagos (order_id, concepto, monto, medio, ocurrido_en)
  VALUES (NEW.id, v_concepto, v_delta, NEW.payment_method, v_cuando);

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revenue_por_fuente(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    FROM (
      SELECT 
        COALESCE(order_source, 'desconocido') AS fuente,
        count(*) AS cantidad,
        COALESCE(sum(amount), 0) AS revenue
      FROM orders
      WHERE created_at >= now() - (p_dias || ' days')::interval
      GROUP BY order_source
      ORDER BY revenue DESC
    ) t
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_customer_from_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone <> '' THEN
    INSERT INTO public.customers (phone, name, email, city, es_prueba, updated_at)
    VALUES (
      NEW.customer_phone,
      COALESCE(NULLIF(NEW.customer_name, ''), ''),
      NULLIF(NEW.customer_email, 'noreply@auremgs.com'),
      NEW.shipping_city,
      COALESCE(NEW.es_prueba, false),
      now()
    )
    ON CONFLICT (phone) DO UPDATE SET
      name = CASE WHEN EXCLUDED.name <> '' AND (customers.name IS NULL OR customers.name = '')
        THEN EXCLUDED.name ELSE customers.name END,
      email = COALESCE(NULLIF(EXCLUDED.email, ''), customers.email),
      city = COALESCE(EXCLUDED.city, customers.city),
      -- Sólo baja: un pedido real redime a un cliente marcado como prueba,
      -- pero un pedido de prueba no puede ensuciar a un cliente real.
      es_prueba = customers.es_prueba AND EXCLUDED.es_prueba,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tendencia_comparativa()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_inicio_mes_actual date := date_trunc('month', now())::date;
  v_inicio_mes_anterior date := (date_trunc('month', now()) - interval '1 month')::date;
  v_fin_mes_anterior date := (date_trunc('month', now()) - interval '1 day')::date;
  v_pedidos_actual int;
  v_revenue_actual numeric;
  v_conversaciones_actual int;
  v_pedidos_anterior int;
  v_revenue_anterior numeric;
  v_conversaciones_anterior int;
BEGIN
  -- Mes actual
  SELECT count(*), COALESCE(sum(amount), 0)
  INTO v_pedidos_actual, v_revenue_actual
  FROM orders
  WHERE created_at >= v_inicio_mes_actual;

  SELECT count(DISTINCT phone_number)
  INTO v_conversaciones_actual
  FROM whatsapp_conversaciones
  WHERE created_at >= v_inicio_mes_actual;

  -- Mes anterior
  SELECT count(*), COALESCE(sum(amount), 0)
  INTO v_pedidos_anterior, v_revenue_anterior
  FROM orders
  WHERE created_at >= v_inicio_mes_anterior
    AND created_at <= v_fin_mes_anterior;

  SELECT count(DISTINCT phone_number)
  INTO v_conversaciones_anterior
  FROM whatsapp_conversaciones
  WHERE created_at >= v_inicio_mes_anterior
    AND created_at <= v_fin_mes_anterior;

  RETURN jsonb_build_object(
    'mes_actual', jsonb_build_object(
      'pedidos', COALESCE(v_pedidos_actual, 0),
      'revenue', COALESCE(v_revenue_actual, 0),
      'conversaciones', COALESCE(v_conversaciones_actual, 0)
    ),
    'mes_anterior', jsonb_build_object(
      'pedidos', COALESCE(v_pedidos_anterior, 0),
      'revenue', COALESCE(v_revenue_anterior, 0),
      'conversaciones', COALESCE(v_conversaciones_anterior, 0)
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.top_ciudades_envio(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    FROM (
      SELECT 
        upper(unaccent(shipping_city)) AS ciudad,
        count(*) AS cantidad,
        COALESCE(sum(amount), 0) AS revenue
      FROM orders
      WHERE shipping_city IS NOT NULL
        AND created_at >= now() - (p_dias || ' days')::interval
      GROUP BY upper(unaccent(shipping_city))
      ORDER BY cantidad DESC
      LIMIT 10
    ) t
  );
END;
$function$
;


/* ══ 4. Disparadores ══ */

DROP TRIGGER IF EXISTS trg_cancel_duplicate_orders ON public.orders;
CREATE TRIGGER trg_cancel_duplicate_orders AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION cancel_duplicate_pending_orders();

DROP TRIGGER IF EXISTS trg_marcar_cliente_de_prueba ON public.customers;
CREATE TRIGGER trg_marcar_cliente_de_prueba BEFORE INSERT OR UPDATE OF phone, email ON public.customers FOR EACH ROW EXECUTE FUNCTION marcar_cliente_de_prueba();

DROP TRIGGER IF EXISTS trg_marcar_pedido_de_prueba ON public.orders;
CREATE TRIGGER trg_marcar_pedido_de_prueba BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION marcar_pedido_de_prueba();

DROP TRIGGER IF EXISTS trg_registrar_pago ON public.orders;
CREATE TRIGGER trg_registrar_pago AFTER INSERT OR UPDATE OF status, amount, abono_monto, abono_pagado_en, payment_method ON public.orders FOR EACH ROW EXECUTE FUNCTION registrar_pago();

DROP TRIGGER IF EXISTS trg_sync_customer_from_order ON public.orders;
CREATE TRIGGER trg_sync_customer_from_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION sync_customer_from_order();

/* ── Nota añadida el 23 de agosto de 2026, después de aplicada ────────
   Este archivo tocaba cuatro tablas que ese mismo día se borraron
   (`20260823_fuera_las_tablas_muertas.sql`): conversaciones, message_history,
   whatsapp_dedup y whatsapp_conversaciones_respaldo. Sobre la base real no
   cambia nada —ya se aplicó—, pero en un ENTORNO NUEVO estas sentencias
   fallaban: ALTER TABLE y CREATE POLICY sobre una tabla que no existe es un
   error, no un no-op, y la cadena de migraciones se partía justo aquí.

   Se envuelven en comprobaciones de existencia en vez de borrarlas: así el
   archivo sigue contando lo que pasó ese día —que esas tablas existían y se
   cerraron— sin impedir que la base se pueda reconstruir. Es la excepción a
   "una migración aplicada no se reescribe", y la razón es justamente la que
   motiva el pendiente #4: un repositorio que no puede levantar su base no
   sirve de nada. */

do $guardia$
begin
  if to_regclass('public.conversaciones') is not null then
    execute 'alter table public.conversaciones enable row level security';
    execute 'drop policy if exists conversaciones_admin on public.conversaciones';
    execute 'create policy conversaciones_admin on public.conversaciones as permissive for all to authenticated using (true) with check (true)';
    execute 'drop trigger if exists trg_conversaciones_updated_at on public.conversaciones';
    execute 'create trigger trg_conversaciones_updated_at before update on public.conversaciones for each row execute function set_updated_at()';
  end if;
  if to_regclass('public.message_history') is not null then
    execute 'alter table public.message_history enable row level security';
  end if;
  if to_regclass('public.whatsapp_dedup') is not null then
    execute 'alter table public.whatsapp_dedup enable row level security';
  end if;
  if to_regclass('public.whatsapp_conversaciones_respaldo') is not null then
    execute 'alter table public.whatsapp_conversaciones_respaldo enable row level security';
  end if;
end
$guardia$;
