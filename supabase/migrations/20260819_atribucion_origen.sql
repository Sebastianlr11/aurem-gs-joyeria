-- De dónde vino cada venta, de verdad.
--
-- Hasta ahora el anuncio quedaba como texto dentro de las notas del pedido:
-- servía para leerlo, no para contarlo. Y el ctwa_clid —el identificador que
-- Meta manda cuando alguien toca un anuncio de Click-to-WhatsApp— se
-- capturaba en la conversación pero nunca se le devolvía a Meta, así que las
-- ventas que cerraba Valentina no se le atribuían a ningún anuncio.
--
-- Estas columnas son lo que permite dos cosas: devolverle a Meta la venta
-- con su ctwa_clid, y armar un informe propio de ventas por origen que no
-- dependa de lo que cada plataforma diga que le corresponde.

alter table public.orders
  add column if not exists ctwa_clid    text,
  add column if not exists anuncio_id   text,
  add column if not exists utm_source   text,
  add column if not exists utm_campaign text;

comment on column public.orders.ctwa_clid    is 'Identificador de clic de un anuncio Click-to-WhatsApp de Meta. Se le devuelve en la API de Conversiones para que la venta se atribuya al anuncio.';
comment on column public.orders.anuncio_id   is 'Id del anuncio o publicación de la que vino (source_id del referral de Meta).';
comment on column public.orders.utm_source   is 'utm_source de la URL de llegada. Cubre el tráfico que no trae identificador de clic: orgánico, lives, enlaces compartidos.';
comment on column public.orders.utm_campaign is 'utm_campaign de la URL de llegada.';

-- Índice para el informe: filtra por fecha y agrupa por origen.
create index if not exists orders_atribucion_idx
  on public.orders (created_at desc)
  where status in ('pagado', 'procesando', 'enviado', 'entregado');
