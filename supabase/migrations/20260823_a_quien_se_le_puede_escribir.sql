-- ============================================================================
-- A QUIÉN SE LE PUEDE ESCRIBIR
-- ============================================================================
-- 23 de agosto de 2026.
--
-- Dos frenos en una sola pregunta: que no haya pedido que no le escriban, y
-- que no haya alguien del equipo atendiendo ese chat ahora mismo.
--
-- Existe porque `plantillas-programadas` los comprobaba con `.eq('phone', …)`,
-- comparando la cadena CRUDA. Y el mismo número entra de tres formas según el
-- canal: 3143602930 desde el panel, +573143602930 desde el checkout,
-- 573143602930 desde WhatsApp. Con 18 pedidos en la base, diez tenían el
-- teléfono en un formato distinto al de su ficha de cliente — así que para
-- esos diez **ninguno de los dos frenos se consultaba nunca**: la búsqueda no
-- encontraba nada y el código lo leía como «adelante».
--
-- El fallo no daba error. Simplemente decía que sí.
--
-- Se compara por los últimos diez dígitos, que es como comparan ya el índice
-- único de `customers`, los disparadores de `es_prueba`, `conversaciones_
-- purgables` y el buscador del panel. Aquí, además, la expresión es la misma
-- del índice, así que la usa.
-- ============================================================================

create or replace function public.puede_recibir_plantillas(p_telefono text)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select not exists (
           select 1 from public.customers c
            where c.no_escribir
              and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10)
                = right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10)
              and length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 10
         )
     and not exists (
           select 1 from public.chat_takeover t
            where t.is_active
              and right(regexp_replace(coalesce(t.phone_number, ''), '\D', '', 'g'), 10)
                = right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10)
              and length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 10
         )
$$;

comment on function public.puede_recibir_plantillas(text) is
  'Si a este teléfono se le pueden mandar plantillas: nadie pidió que no le escriban y nadie del equipo está atendiendo ese chat. Compara por los últimos diez dígitos, no por la cadena cruda.';

-- Sólo el proceso automático. Un desconocido no tiene por qué poder averiguar
-- quién pidió que no le escribieran.
revoke all on function public.puede_recibir_plantillas(text) from public, anon, authenticated;
grant execute on function public.puede_recibir_plantillas(text) to service_role;
