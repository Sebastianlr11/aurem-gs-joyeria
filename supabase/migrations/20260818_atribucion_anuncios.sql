-- De qué anuncio vino cada pedido.
--
-- El navegador conoce estos identificadores; el servidor, que es quien
-- confirma el pago cuando Mercado Pago avisa, no. Guardarlos con el pedido es
-- lo que permite decirle después a TikTok y a Meta qué clic terminó en venta,
-- incluso cuando el cliente nunca volvió a la página de confirmación.
--
-- Ninguno identifica a una persona por nombre: son códigos opacos que sólo
-- la plataforma que los emitió puede cruzar con su propio usuario.

alter table public.orders
  add column if not exists ttclid text,  -- clic de TikTok, viene en la URL
  add column if not exists ttp    text,  -- cookie _ttp del píxel de TikTok
  add column if not exists fbc    text,  -- clic de Meta, formato fb.1.<ms>.<fbclid>
  add column if not exists fbp    text;  -- cookie _fbp del píxel de Meta

comment on column public.orders.ttclid is 'Identificador de clic de TikTok (parámetro ttclid). Para atribuir la venta al anuncio.';
comment on column public.orders.ttp    is 'Cookie _ttp del píxel de TikTok. Identifica el navegador, no a la persona.';
comment on column public.orders.fbc    is 'Identificador de clic de Meta, formato fb.1.<momento>.<fbclid>.';
comment on column public.orders.fbp    is 'Cookie _fbp del píxel de Meta. Identifica el navegador, no a la persona.';

-- Marca de que la venta ya se le informó al servidor de anuncios, para no
-- contarla dos veces si Mercado Pago reintenta el webhook —cosa que hace.
alter table public.orders
  add column if not exists conversion_enviada_en timestamptz;

comment on column public.orders.conversion_enviada_en is 'Cuándo se envió esta venta a las APIs de conversiones. Sirve de candado contra reintentos del webhook.';
