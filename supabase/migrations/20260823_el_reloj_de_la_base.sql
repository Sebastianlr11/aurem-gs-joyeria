-- ============================================================================
-- EL RELOJ DE LA BASE
-- ============================================================================
-- 23 de agosto de 2026.
--
-- Dos cosas de este sistema pasan solas, sin que nadie abra el panel:
--
--   · el aviso de WhatsApp cuando un chat lleva rato esperando a una persona
--     (`plantillas-programadas`), y
--   · el vigía, que cada media hora comprueba que la tienda, la base y las
--     funciones siguen en pie y manda un correo si algo se cayó
--     (`vigilancia`).
--
-- Las dispara `pg_cron` DENTRO de la base, no un servicio de fuera. Y hasta
-- hoy esa programación **no estaba escrita en ninguna parte**: vivía sólo en
-- la tabla `cron.job` del proyecto de producción. Para saber a qué hora corría
-- algo había que entrar a la base y preguntar. Si el proyecto se perdía, se
-- perdía con él la única copia del horario, y un entorno nuevo levantado desde
-- este repositorio se quedaba mudo: nadie avisaba de nada y nadie vigilaba
-- nada, sin un solo error que lo delatara.
--
-- Esta migración lo declara. Es idempotente: `cron.schedule` con nombre
-- reemplaza el trabajo si ya existe, así que se puede volver a aplicar.
--
-- ── Lo que hace falta que exista antes ──────────────────────────────────────
--
-- Los tres valores que el reloj necesita están en `ajustes_internos`, NO aquí.
-- Es a propósito: dos son secretos y el tercero cambia con el entorno, y este
-- archivo se commitea.
--
--   clave_anon     La llave pública del proyecto. No autoriza nada; sólo
--                  satisface el `verify_jwt` de las funciones.
--   cron_secreto   El que de verdad autoriza. Lo comprueban las dos funciones
--                  en el header `x-cron-secreto`. Está en la base y no en una
--                  variable de entorno para poder rotarlo sin redesplegar.
--   url_funciones  La raíz de las Edge Functions, sin barra final.
--
-- En un entorno nuevo hay que ponerlos a mano ANTES de aplicar esto:
--
--   insert into public.ajustes_internos (clave, valor) values
--     ('url_funciones', 'https://<ref>.supabase.co/functions/v1'),
--     ('clave_anon',    '<la llave pública>'),
--     ('cron_secreto',  encode(gen_random_bytes(32), 'hex'));
--
-- El bloque de comprobación de abajo tumba la migración con un mensaje claro
-- si falta alguno, en vez de dejar dos trabajos programados que fallan en
-- silencio a las tres de la mañana.
--
-- ── Por qué no hay una función que envuelva esto ────────────────────────────
--
-- Lo natural sería una función `despertar_funcion(nombre)` y que los dos
-- trabajos la llamaran. No se hizo, y la razón es del mismo día: esta misma
-- mañana se cerraron 14 funciones `SECURITY DEFINER` que PostgREST estaba
-- exponiendo a la llave pública (ver `20260823_las_rpc_estaban_abiertas.sql`).
-- Una función así sería justo eso otra vez, y peor: cualquiera con la llave
-- pública podría llamarla y disparar plantillas de WhatsApp de verdad a
-- clientas de verdad. El texto del comando, en cambio, vive en `cron.job`, que
-- PostgREST no expone. Se duplican quince líneas y se duerme tranquilo.
-- ============================================================================

create extension if not exists pg_cron;
-- pg_net es quien hace la llamada HTTP desde dentro de Postgres. En Supabase
-- ya viene puesto; la línea es para un entorno levantado desde cero.
create extension if not exists pg_net;

-- ── Que no arranque a ciegas ────────────────────────────────────────────────
do $$
declare faltan text;
begin
  select string_agg(c, ', ')
    into faltan
    from unnest(array['url_funciones', 'clave_anon', 'cron_secreto']) c
   where not exists (
     select 1 from public.ajustes_internos a
      where a.clave = c and coalesce(a.valor, '') <> ''
   );

  if faltan is not null then
    raise exception
      'Falta en ajustes_internos: %. Ponlos antes de programar el reloj: sin ellos los dos trabajos quedarían programados y fallando en silencio.',
      faltan;
  end if;
end $$;

-- ── 1. El aviso de WhatsApp ─────────────────────────────────────────────────
-- A las horas en que hay alguien para atender: de 13:00 a 01:00 UTC, que en
-- Bogotá (UTC-5) son las 8 de la mañana a las 8 de la noche. Fuera de esa
-- franja no se manda nada, porque una plantilla a las 3 de la madrugada no
-- ayuda a nadie y sí quema el candado de `plantillas_enviadas`.
select cron.schedule(
  'avisos-whatsapp',
  '0 0,1,13-23 * * *',
  $cmd$
  select net.http_post(
    url := (select valor from public.ajustes_internos where clave = 'url_funciones')
           || '/plantillas-programadas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Pública por diseño: sólo satisface el verify_jwt de la función.
      'Authorization', 'Bearer ' ||
        (select valor from public.ajustes_internos where clave = 'clave_anon'),
      -- El que de verdad autoriza. Nunca sale de la base.
      'x-cron-secreto', (select valor from public.ajustes_internos where clave = 'cron_secreto')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);

-- ── 2. El vigía ─────────────────────────────────────────────────────────────
-- Cada hora, en el minuto 30. A todas horas, porque una caída de madrugada
-- también es una caída.
select cron.schedule(
  'vigilancia',
  '30 * * * *',
  $cmd$
  select net.http_post(
    url := (select valor from public.ajustes_internos where clave = 'url_funciones')
           || '/vigilancia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select valor from public.ajustes_internos where clave = 'clave_anon'),
      'x-cron-secreto', (select valor from public.ajustes_internos where clave = 'cron_secreto')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $cmd$
);

-- ── Comprobar ───────────────────────────────────────────────────────────────
--   select jobname, schedule, active from cron.job;
--   select jobname, status, start_time, return_message
--     from cron.job_run_details order by start_time desc limit 10;
