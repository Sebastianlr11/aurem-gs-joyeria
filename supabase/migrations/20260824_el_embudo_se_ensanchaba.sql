-- El embudo de WhatsApp se ensanchaba en el segundo peldaño.
--
-- 23 de agosto de 2026 (el nombre del archivo va en UTC).
--
-- El gráfico dibujaba, en producción: **0 conversaciones → 1 interesada → 0
-- pedidos**. Un embudo cuyo segundo escalón es más ancho que el primero no es
-- un embudo mal calibrado, es un gráfico que no puede ser cierto.
--
-- Tres motivos, y los tres de la misma familia que el resto de lo que se
-- arregló estos días:
--
--   1. **Los peldaños no eran subconjuntos.** «Interesadas» se medía sobre los
--      mensajes de Valentina sin exigir que esa persona hubiera escrito nunca,
--      así que un chat donde sólo habló ella —una plantilla saliente— entraba
--      en el peldaño 2 sin estar en el 1.
--
--   2. **`es_prueba` era asimétrico.** Se filtraba en los peldaños de abajo
--      (pedidos, pagados) y no en los de arriba (conversaciones, interesadas):
--      los chats del equipo entraban por la boca del embudo y sus pedidos no
--      salían por el cuello. El embudo se estrechaba de mentira. Es el mismo
--      fallo que tenía `analiticas_whatsapp` en su tasa de conversión.
--
--   3. **Los teléfonos se cruzaban en crudo.** El de un pedido y el de su
--      conversación casi nunca vienen del mismo sitio —`3143602930` desde el
--      panel, `573143602930` desde WhatsApp—, así que el cruce entre los dos
--      no acertaba nunca.
--
-- Ahora cada peldaño se calcula SOBRE los que escribieron, ninguno filtra
-- `es_prueba` —igual que el resto de las RPC, porque el lente vive en la
-- interfaz— y los teléfonos se comparan por los últimos diez dígitos.
--
-- LÍMITE CONOCIDO: el peldaño «interesadas» detecta un precio con una
-- expresión que busca `$1.234`. Si Valentina lo escribe de otra forma —«500
-- mil»— ese chat no cuenta como interesada aunque después pida. Por eso los
-- peldaños 3 y 4 se calculan sobre los que escribieron y no sobre las
-- interesadas: preferimos que el peldaño 3 pueda salir más ancho que el 2 —y
-- que eso se lea como «a la expresión se le escapó un precio»— antes que
-- esconder pedidos de verdad.

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
  CREATE TEMP TABLE IF NOT EXISTS _embudo (persona text primary key) ON COMMIT DROP;
  DELETE FROM _embudo;

  -- 1. Quién escribió.
  INSERT INTO _embudo (persona)
  SELECT DISTINCT right(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'), 10)
  FROM whatsapp_conversaciones
  WHERE role = 'user' AND created_at >= v_desde
    AND right(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'), 10) <> '';

  SELECT count(*) INTO v_conversaciones FROM _embudo;

  -- 2. De ésas, a cuáles se les llegó a decir un precio.
  SELECT count(*) INTO v_interesados
  FROM _embudo e
  WHERE EXISTS (
    SELECT 1 FROM whatsapp_conversaciones wc
    WHERE wc.role = 'assistant' AND wc.created_at >= v_desde
      AND wc.content ~ '\$[0-9]{1,3}(\.[0-9]{3})*'
      AND right(regexp_replace(coalesce(wc.phone_number, ''), '\D', '', 'g'), 10) = e.persona
  );

  -- 3. De ésas, cuáles llegaron a pedir.
  SELECT count(*) INTO v_pedidos
  FROM _embudo e
  WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.order_source = 'whatsapp' AND o.created_at >= v_desde
      AND right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 10) = e.persona
  );

  -- 4. Y de ésas, cuáles siguen siendo una venta viva.
  SELECT count(*) INTO v_pagados
  FROM _embudo e
  WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.order_source = 'whatsapp' AND o.created_at >= v_desde
      AND public.venta_viva(o.status)
      AND right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 10) = e.persona
  );

  RETURN jsonb_build_object(
    'conversaciones', COALESCE(v_conversaciones, 0),
    'interesados', COALESCE(v_interesados, 0),
    'pedidos', COALESCE(v_pedidos, 0),
    'pagados', COALESCE(v_pagados, 0)
  );
END;
$function$;
