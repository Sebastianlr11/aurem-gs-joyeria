-- Qué plantilla se le mandó a quién, y quién pidió que no le escriban.
--
-- Las dos cosas son el freno de un proceso automático que le escribe a
-- clientes reales y que, en una de las cuatro plantillas, cuesta plata por
-- mensaje. Sin registro no hay forma de garantizar "una sola vez", y sin
-- lista de exclusión el negocio termina insistiéndole a alguien que ya dijo
-- que no.

create table if not exists public.plantillas_enviadas (
  id           uuid primary key default gen_random_uuid(),
  phone_number text not null,
  plantilla    text not null,
  -- A qué pedido corresponde, cuando aplica. Es lo que permite mandar la
  -- misma plantilla dos veces a la misma persona por pedidos distintos, sin
  -- permitir mandarla dos veces por el mismo.
  pedido_id    uuid references public.orders(id) on delete set null,
  enviada_en   timestamptz not null default now(),
  wamid        text,
  -- Guardar el error cuando falla: una plantilla rechazada por Meta suele
  -- serlo por un motivo que hay que corregir, no por un fallo pasajero.
  error        text
);

comment on table public.plantillas_enviadas is 'Registro de plantillas de WhatsApp enviadas. Es el candado que garantiza que cada aviso salga una sola vez.';

-- El candado. Con pedido: una vez por pedido. Sin pedido —la reactivación—:
-- una vez por persona, para siempre. Van en dos índices porque en Postgres un
-- unique normal deja pasar filas repetidas si la columna es null.
create unique index if not exists plantillas_enviadas_por_pedido_idx
  on public.plantillas_enviadas (plantilla, pedido_id)
  where pedido_id is not null;

create unique index if not exists plantillas_enviadas_por_persona_idx
  on public.plantillas_enviadas (plantilla, phone_number)
  where pedido_id is null;

create index if not exists plantillas_enviadas_fecha_idx
  on public.plantillas_enviadas (enviada_en desc);

alter table public.plantillas_enviadas enable row level security;

-- Sólo el panel lee esto; el proceso que escribe usa la clave de servicio,
-- que se salta RLS. Nadie más tiene por qué verlo.
drop policy if exists "plantillas_enviadas_lectura_admin" on public.plantillas_enviadas;
create policy "plantillas_enviadas_lectura_admin"
  on public.plantillas_enviadas for select
  to authenticated
  using (true);

-- Quien pidió que no le escriban. Se respeta en TODA plantilla, incluidas las
-- de utilidad: alguien que dijo "no me escriban más" no distingue categorías
-- de Meta, y tampoco tiene por qué.
alter table public.customers
  add column if not exists no_escribir boolean not null default false;

comment on column public.customers.no_escribir is 'Pidió no recibir mensajes. Ninguna plantilla automática le llega, sea de utilidad o de marketing.';
