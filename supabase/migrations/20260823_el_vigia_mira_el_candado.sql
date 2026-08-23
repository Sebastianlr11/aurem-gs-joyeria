-- ============================================================================
-- EL VIGÍA MIRA EL CANDADO
-- ============================================================================
-- 23 de agosto de 2026.
--
-- Qué políticas del panel dejaron de exigir ser del equipo, qué tabla se quedó
-- sin RLS y qué función SECURITY DEFINER se creó sin `search_path`.
--
-- Existe por la segunda mitad del hallazgo de
-- `20260823_tener_sesion_no_es_ser_del_equipo.sql`: la premisa de seguridad
-- del panel estuvo rota seis meses y **no lo dijo nadie**. Arreglarlo no
-- basta; hace falta que la próxima vez lo diga alguien sin que haya que
-- preguntar. La llama la función `vigilancia` cada hora, y si encuentra algo
-- manda el mismo correo que cuando se cae la tienda.
--
-- Las dos excepciones de la lista son deliberadas y públicas: el catálogo de
-- la tienda y las fotos de las piezas. Cualquier otra política sin
-- `es_del_equipo()` sale como hallazgo aunque sea legítima — el vigía informa,
-- no decide, y una lista blanca que crece sola es una lista blanca que un día
-- deja pasar lo que no debía.
--
-- **Reservada a la llave de servicio.** Una función `SECURITY DEFINER` que
-- enumera los agujeros de RLS es justo lo que no se le enseña a nadie más, y
-- hoy era el día de acordarse: esta misma mañana se cerraron 14 RPC que
-- PostgREST exponía a la llave pública.
-- ============================================================================

create or replace function public.politicas_flojas()
returns table (donde text, politica text, motivo text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select n.nspname || '.' || c.relname,
         p.polname,
         'la política no exige es_del_equipo()'
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'storage')
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '')
      || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') not like '%es_del_equipo%'
     and p.polname not in ('products_public_read', 'product_images_public_read')

  union all

  select 'public.' || c.relname, '—', 'la tabla se quedó sin RLS'
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all

  select 'public.' || p.proname, '—', 'SECURITY DEFINER sin search_path fijo'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) k where k like 'search_path=%'
     )
$$;

revoke all on function public.politicas_flojas() from public, anon, authenticated;
grant execute on function public.politicas_flojas() to service_role;
