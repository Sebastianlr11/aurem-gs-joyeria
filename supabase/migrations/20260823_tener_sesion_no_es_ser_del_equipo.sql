-- ============================================================================
-- TENER SESIÓN NO ES SER DEL EQUIPO
-- ============================================================================
-- 23 de agosto de 2026.
--
-- Toda la seguridad del panel descansaba sobre una premisa que está escrita en
-- el propio código, en `create-admin`:
--
--     «en este proyecto todo usuario de Supabase Auth es administrador»
--
-- Y era literal. Las veinte políticas de las quince tablas del panel decían lo
-- mismo: `to authenticated using (true)`. Leer y borrar pedidos, leer y
-- escribir toda la correspondencia de WhatsApp, ver el libro de caja, cambiar
-- el recargo del taller —que es el margen del negocio—, borrar piezas. Todo,
-- con el único requisito de tener una sesión.
--
-- La premisa sólo se sostiene si nadie más puede conseguir una sesión. **Y
-- podía: el registro público estaba abierto.** Comprobado el 23 de agosto sin
-- crear ninguna cuenta: una petición a `/auth/v1/signup` con un correo mal
-- formado contestaba «Unable to validate email address» —es decir, procesando
-- altas— en vez de `signup_disabled`. Con la llave pública, que va dentro del
-- bundle y cualquiera lee del navegador, el camino entero era: registrarse,
-- confirmar en su propia bandeja, y consultar PostgREST directamente. Ni
-- siquiera hacía falta entrar al panel.
--
-- El registro ya se cerró desde el panel de Supabase. Esto es para que **no
-- dependa de ese interruptor**: si alguien lo vuelve a encender, o si mañana se
-- añade un proveedor externo, el acceso a los datos sigue cerrado.
--
-- ── Por qué el rol va en app_metadata ───────────────────────────────────────
--
-- Porque `user_metadata` lo puede cambiar el propio usuario desde el navegador
-- —se marcaría «dueño» solo— y `app_metadata` sólo se escribe con la llave de
-- servicio. Es el mismo sitio que ya usaba `create-admin` para saber quién
-- manda, así que no se inventa un mecanismo nuevo: se extiende el que había.
--
-- ── El orden en que se hizo, que es la parte delicada ───────────────────────
--
-- Un JWT lleva el `app_metadata` que existía cuando se emitió. Aplicar estas
-- políticas antes de sellar los roles deja a todo el mundo fuera del panel
-- hasta que renueve el token — y si el proveedor de correo estuviera apagado,
-- fuera del todo. Así que:
--
--   1. Se sellaron los roles de las dos cuentas (`dueño` y `equipo`).
--   2. Se comprobó EN EL NAVEGADOR que la sesión abierta ya llevaba el rol y
--      que `refreshSession()` seguía funcionando.
--   3. Sólo entonces se aplicó esto.
--
-- Si algún día hay que repetirlo en otro entorno, ese es el orden.
-- ============================================================================

-- ── Quién es del equipo ─────────────────────────────────────────────────────
create or replace function public.es_del_equipo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') in ('dueño', 'equipo')
$$;

comment on function public.es_del_equipo() is
  'Si quien llama tiene rol de equipo en app_metadata. No basta con tener sesión: '
  'el registro puede volver a abrirse y entonces cualquiera tendría una.';

-- ── Las tablas del panel ────────────────────────────────────────────────────
-- Van una por una y no en un bucle a propósito: así el diff enseña qué tabla
-- se protegió y quien lea esto dentro de un año ve la lista completa sin tener
-- que consultar la base.

alter policy "Auth full access" on public.chat_status
  to authenticated using (public.es_del_equipo());

alter policy "el equipo maneja el control manual" on public.chat_takeover
  to authenticated using (public.es_del_equipo());

alter policy "Auth full access" on public.contact_tags
  to authenticated using (public.es_del_equipo());

alter policy "customers_auth_all" on public.customers
  to authenticated using (public.es_del_equipo());

alter policy "el equipo ve el gasto" on public.gasto_pauta
  to authenticated using (public.es_del_equipo());
alter policy "el equipo anota el gasto" on public.gasto_pauta
  to authenticated with check (public.es_del_equipo());
alter policy "el equipo corrige el gasto" on public.gasto_pauta
  to authenticated using (public.es_del_equipo());
alter policy "el equipo borra el gasto" on public.gasto_pauta
  to authenticated using (public.es_del_equipo());

alter policy "Allow all for authenticated users" on public.notes
  to authenticated using (public.es_del_equipo());

alter policy "el equipo ve las piezas del pedido" on public.order_items
  to authenticated using (public.es_del_equipo());

alter policy "orders_auth_all" on public.orders
  to authenticated using (public.es_del_equipo());

alter policy "el equipo ve el libro de caja" on public.pagos
  to authenticated using (public.es_del_equipo());

alter policy "plantillas_enviadas_lectura_admin" on public.plantillas_enviadas
  to authenticated using (public.es_del_equipo());

-- Ojo: `products` tiene ADEMÁS una política pública de lectura, que es el
-- catálogo de la tienda. Esa no se toca.
alter policy "products_auth_insert" on public.products
  to authenticated with check (public.es_del_equipo());
alter policy "products_auth_update" on public.products
  to authenticated using (public.es_del_equipo());
alter policy "products_auth_delete" on public.products
  to authenticated using (public.es_del_equipo());

alter policy "conocimiento_auth_read" on public.taller_conocimiento
  to authenticated using (public.es_del_equipo());
alter policy "conocimiento_auth_write" on public.taller_conocimiento
  to authenticated using (public.es_del_equipo());

alter policy "taller_precios_auth_read" on public.taller_precios
  to authenticated using (public.es_del_equipo());
alter policy "taller_precios_auth_update" on public.taller_precios
  to authenticated using (public.es_del_equipo());

alter policy "el equipo ve la vigilancia" on public.vigilancia_ultima
  to authenticated using (public.es_del_equipo());

alter policy "el equipo ve y escribe las conversaciones" on public.whatsapp_conversaciones
  to authenticated using (public.es_del_equipo());

-- ── Y el search_path de las funciones que se saltan RLS ─────────────────────
-- Una función `SECURITY DEFINER` sin `search_path` fijo resuelve los nombres
-- con el del que la llama. Quien pueda crear un objeto en un esquema que esté
-- antes en esa lista, puede hacer que la función ejecute su código con los
-- privilegios del dueño. Aquí nadie puede crear esquemas, así que no es una
-- puerta abierta hoy — es una que conviene no dejar entornada.
--
-- Se incluye `extensions` porque `unaccent` vive ahí en algunos entornos, y
-- `buscar_conversaciones` lo usa.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.firma);
    raise notice 'search_path fijado en %', f.firma;
  end loop;
end $$;
