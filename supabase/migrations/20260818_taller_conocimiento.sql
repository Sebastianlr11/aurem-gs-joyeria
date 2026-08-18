-- Lo que Valentina sabe de cómo funciona el negocio.
--
-- Hasta ahora vivía escrito a mano dentro del prompt, con dos problemas:
-- cambiar una línea exigía desplegar código, y como nadie lo revisaba se
-- había desincronizado de la operación real. Llegó a decir "Mercado Pago
-- con 2% de descuento, envíos en 24 a 48 horas" cuando el taller cobra por
-- Nequi y despacha por Interrapidísimo.
create table if not exists public.taller_conocimiento (
  id             uuid primary key default gen_random_uuid(),
  tema           text not null unique,
  contenido      text not null,
  orden          int  not null default 0,
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

comment on table public.taller_conocimiento is
  'Politicas del negocio que Valentina puede decir sin consultar. Se inyectan en el prompt igual que el catalogo.';

alter table public.taller_conocimiento enable row level security;

create policy conocimiento_auth_read on public.taller_conocimiento
  for select to authenticated using (true);
create policy conocimiento_auth_write on public.taller_conocimiento
  for all to authenticated using (true) with check (true);

-- Sembrado con lo que se observó en conversaciones reales de agosto de 2026.
-- TODO EL CONTENIDO ESTÁ SIN CONFIRMAR: hay que revisarlo en el panel antes
-- de que Valentina se lo prometa a nadie.
insert into public.taller_conocimiento (tema, contenido, orden) values
  ('Envíos',
   'Enviamos a todo el país por Interrapidísimo. Se manda la guía para hacer seguimiento. El envío tiene un costo adicional aproximado de 15.000 pesos. Suele llegar al día siguiente del despacho. SIN CONFIRMAR.',
   10),
  ('Medios de pago',
   'Aceptamos Nequi y pago contra entrega. SIN CONFIRMAR: revisar si sigue vigente Mercado Pago y si hay descuento por pagar anticipado.',
   20),
  ('Piezas a medida: cómo se trabaja',
   'Se hace primero el diseño y se aprueba antes de fabricar. Se empieza con un abono del 50% y el resto se paga al terminar, y ahí se despacha. Se envían fotos de cada proceso para que el cliente vea cómo va quedando. SIN CONFIRMAR.',
   30),
  ('Qué va incluido en el precio',
   'Estuche, la marcada (grabar un nombre, una fecha o una frase) y la garantía. En aretes van también las mariposas. SIN CONFIRMAR.',
   40),
  ('Garantía',
   'Garantía de por vida: cubre ajuste de talla si el dedo cambia, y mantenimiento de la pieza. SIN CONFIRMAR qué NO cubre.',
   50),
  ('Piedras',
   'Además de fabricar, comerciamos esmeraldas y podemos vender la piedra suelta, con certificación. También se puede trabajar con una piedra que el cliente ya tenga: la envía y se fabrica alrededor. SIN CONFIRMAR.',
   60)
on conflict (tema) do nothing;
