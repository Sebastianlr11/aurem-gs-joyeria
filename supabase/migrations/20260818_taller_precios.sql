-- Cómo cotiza el taller una pieza a medida en oro.
--
-- El modelo, explicado por el joyero: al precio del gramo de oro del día se
-- le suma un recargo fijo que cubre diseño, fundición y terminado. Sólo
-- aplica de cierto gramaje para arriba, porque en piezas livianas la merma
-- —el oro que se pierde en cada proceso— se come la ganancia.
--
-- La plata NO va acá: se vende por pieza, no por gramo, y eso es criterio
-- de joyero. Las piedras tampoco: cuánto suma una esmeralda depende de la
-- piedra concreta. Las dos cosas escalan a una persona.
create table if not exists public.taller_precios (
  -- Fuerza que exista una sola fila: no hay dos listas de precios.
  id                boolean primary key default true check (id),
  precio_gramo_oro  numeric not null,
  recargo_por_gramo numeric not null default 118000,
  gramos_minimos    numeric not null default 5,
  actualizado_en    timestamptz not null default now(),
  actualizado_por   text
);

comment on column public.taller_precios.precio_gramo_oro is
  'Precio del gramo de oro que se toma como base. Se consulta a diario pero NO se cambia por movimientos pequeños: sólo cuando el mercado se mueve lo suficiente.';
comment on column public.taller_precios.recargo_por_gramo is
  'Lo que se suma por gramo: diseño, fundición, terminado y ganancia.';
comment on column public.taller_precios.gramos_minimos is
  'Por debajo de este peso no se cotiza por gramo: va por pieza, y lo decide una persona.';

alter table public.taller_precios enable row level security;

-- Sin lectura pública: el recargo es el margen del taller. Sólo el panel.
create policy taller_precios_auth_read on public.taller_precios
  for select to authenticated using (true);

create policy taller_precios_auth_update on public.taller_precios
  for update to authenticated using (true) with check (true);

-- Valor inicial, tomado de lo que explicó el joyero el 18 de agosto de 2026.
-- El precio del gramo hay que confirmarlo antes de cotizarle a nadie.
insert into public.taller_precios (id, precio_gramo_oro, recargo_por_gramo, gramos_minimos, actualizado_por)
values (true, 437668, 118000, 5, 'valor inicial · confirmar')
on conflict (id) do nothing;
