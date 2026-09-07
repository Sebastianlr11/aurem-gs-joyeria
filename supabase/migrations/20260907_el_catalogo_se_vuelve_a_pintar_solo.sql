-- ============================================================================
-- El catálogo se vuelve a pintar solo cuando cambia una pieza.
--
-- Desde el 7 de septiembre de 2026 `/catalogo` viene pintado desde el build
-- (`scripts/prerenderizar.mjs`): la rejilla, la hoja de estilos y la foto de
-- la primera tarjeta salen en el HTML, y así el LCP no espera a que baje el
-- bundle, corra React y llegue la consulta. El precio es que ese primer frame
-- es la lista del ÚLTIMO BUILD. El navegador la reemplaza por la viva en
-- cuanto React monta —una pieza nueva aparece igual, un segundo después—,
-- pero el primer frame la seguiría sin enseñar hasta el próximo despliegue.
--
-- Esto cierra ese hueco: cada vez que se guarda, se edita o se borra una
-- pieza, la base le pide a Vercel un despliegue nuevo, por su Deploy Hook. En
-- tres minutos el HTML del catálogo está al día.
--
-- La URL del Deploy Hook vive en `ajustes_internos` (clave
-- `vercel_deploy_hook`) y NO aquí, por lo mismo que el secreto del reloj: se
-- rota sin tocar el repo y no queda en ningún diff. Es una URL que cualquiera
-- que la tenga puede usar para disparar builds, así que se trata como un
-- secreto.
--
-- Si la clave no está, el disparador NO hace nada y no falla: el catálogo
-- sigue funcionando, sólo que su primer frame se actualiza en cada despliegue
-- en vez de en cada pieza. Se crea en Vercel → Settings → Git → Deploy Hooks
-- (rama `main`) y se guarda con:
--
--   insert into public.ajustes_internos (clave, valor)
--   values ('vercel_deploy_hook', 'https://api.vercel.com/v1/integrations/deploy/…')
--   on conflict (clave) do update set valor = excluded.valor;
--
-- `for each statement` y no `for each row`: un cambio masivo —resubir fotos,
-- corregir precios en lote— es UN build, no uno por fila. Vercel encola los
-- que lleguen mientras otro corre.
-- ============================================================================

-- pg_net es quien hace la llamada HTTP desde dentro de Postgres. En Supabase
-- ya viene puesto; la línea es para un entorno levantado desde cero.
create extension if not exists pg_net;

create or replace function public.pedir_nuevo_despliegue()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  hook text;
begin
  select valor into hook
    from public.ajustes_internos
   where clave = 'vercel_deploy_hook';

  if coalesce(hook, '') = '' or hook not like 'https://%' then
    -- Sin hook no hay nada que pedir. No se lanza error: guardar una pieza no
    -- puede depender de que Vercel esté configurado.
    return null;
  end if;

  perform net.http_post(
    url := hook,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );

  return null;
end;
$$;

comment on function public.pedir_nuevo_despliegue() is
  'Le pide a Vercel un build nuevo por su Deploy Hook (ajustes_internos.vercel_deploy_hook) para que el HTML prerenderizado de /catalogo se actualice. Sin la clave, no hace nada.';

-- Sólo la dispara la base. Nadie tiene por qué poder llamarla a mano.
revoke all on function public.pedir_nuevo_despliegue() from public, anon, authenticated;

drop trigger if exists products_pide_despliegue on public.products;
create trigger products_pide_despliegue
  after insert or update or delete on public.products
  for each statement
  execute function public.pedir_nuevo_despliegue();
