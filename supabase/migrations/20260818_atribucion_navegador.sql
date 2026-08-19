-- El navegador del comprador, para que Meta no descarte la venta.
--
-- Meta exige client_user_agent en todo evento de servidor con
-- action_source 'website', y descarta los que llegan sin él. El servidor no
-- puede saberlo: cuando Mercado Pago confirma el pago, quien hace la llamada
-- es Mercado Pago, no el cliente. Así que se captura en el checkout y viaja
-- con el pedido.
--
-- La IP se toma del encabezado de la petición al crear la preferencia, que es
-- el único momento en que el navegador del comprador habla con nosotros.

alter table public.orders
  add column if not exists client_ua text,
  add column if not exists client_ip text;

comment on column public.orders.client_ua is 'User agent del navegador del comprador al momento del checkout. Obligatorio para la API de Conversiones de Meta.';
comment on column public.orders.client_ip is 'IP del comprador al crear la preferencia de pago. Mejora la coincidencia en Meta y TikTok.';
