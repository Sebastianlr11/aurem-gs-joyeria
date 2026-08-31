-- Una Valentina a la vez por conversación.
--
-- El 31 de agosto de 2026, con la primera clienta que llegó por pauta, pasó
-- esto en once segundos:
--
--   05:32:34  [foto] Anillo solitario sencillo
--   05:32:35  [foto] Anillo corazón entrelazado
--   05:32:43  [foto] Anillo solitario sencillo      ← repetida
--   05:32:44  [foto] Anillo corazón entrelazado     ← repetida
--   05:32:44  [foto] Anillo de brazos cruzados
--   05:32:45  "Te muestro dos opciones…"
--   05:32:52  "Te muestro tres opciones…"           ← se contradice
--
-- `wa-webhook` ya esperaba unos segundos para agrupar los mensajes seguidos de
-- una misma persona, pero esa espera sólo protege el ARRANQUE. Una corrida
-- tarda diez o veinte segundos entre el modelo y las fotos, y un mensaje que
-- entra en ese rato arranca una segunda corrida que pasa su propio chequeo:
-- dos Valentinas contestando a la vez, sin saber una de la otra.
--
-- Esto es el candado. Quien lo toma responde; quien no, se retira y deja que
-- la corrida en curso conteste con todo el contexto junto.
--
-- ── Por qué una tabla y no un lock de Postgres ────────────────────────────
--
-- `pg_try_advisory_lock` vive en la sesión, y las edge functions hablan por
-- PostgREST con conexiones agrupadas que van y vienen: el lock se soltaría
-- cuando le diera la gana. Una fila es explícita y se puede mirar.
--
-- ── Por qué caduca ────────────────────────────────────────────────────────
--
-- Si una corrida se cae a mitad —el modelo se cuelga, la función se queda sin
-- tiempo— el candado quedaría puesto para siempre y esa persona no volvería a
-- recibir respuesta nunca. A los 90 segundos cualquier corrida nueva se lo
-- puede quedar. Es más de lo que tarda la corrida más lenta y menos de lo que
-- una persona espera antes de repetir la pregunta.

create table if not exists public.bot_respondiendo (
  phone_number text primary key,
  desde timestamptz not null default now()
);

comment on table public.bot_respondiendo is
  'Quién tiene el turno de responder ahora mismo. Una fila por conversación en curso; se borra al terminar y caduca a los 90 s.';

-- Nadie con la llave pública tiene nada que hacer acá: sólo la escribe la
-- service role desde wa-webhook.
alter table public.bot_respondiendo enable row level security;

/**
 * Pide el turno para responderle a alguien.
 *
 * Devuelve `true` si es tuyo —o si el anterior ya caducó— y `false` si otra
 * corrida está contestando en este momento.
 */
create or replace function public.tomar_turno(
  p_telefono text,
  p_caduca_segundos integer default 90
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tomado boolean;
begin
  insert into public.bot_respondiendo (phone_number, desde)
  values (p_telefono, now())
  on conflict (phone_number) do update
    set desde = now()
    /* Sin este WHERE el candado no serviría de nada: cada corrida nueva se lo
       quitaría a la que está trabajando. */
    where public.bot_respondiendo.desde < now() - make_interval(secs => p_caduca_segundos)
  returning true into v_tomado;

  return coalesce(v_tomado, false);
end;
$$;

/** Suelta el turno. Se llama pase lo que pase, también si la corrida falló. */
create or replace function public.soltar_turno(p_telefono text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bot_respondiendo where phone_number = p_telefono;
$$;

-- Las dos son SECURITY DEFINER, así que se cierran a la llave pública. Es la
-- misma puerta que se dejó abierta una vez y se cerró en
-- 20260823_las_rpc_estaban_abiertas.sql.
revoke execute on function public.tomar_turno(text, integer) from public, anon, authenticated;
revoke execute on function public.soltar_turno(text)         from public, anon, authenticated;
