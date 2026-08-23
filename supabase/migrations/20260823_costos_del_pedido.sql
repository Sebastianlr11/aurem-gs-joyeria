-- El costo deja de vivir en el catálogo y pasa a vivir en el pedido.
--
-- Por qué. `products.costo` era un número fijo por pieza, y el costo de esta
-- joyería no es fijo: el oro se mueve, los materiales se mueven y el flete
-- depende de a dónde va. Mantener ese número al día era imposible, así que en
-- la práctica se llenaba con estimaciones —de ahí `costo_provisional` y los
-- avisos de "costo de relleno" en el panel—, y los márgenes salían de una
-- predicción, no de un hecho.
--
-- El proyecto ya había resuelto este mismo problema para el otro lado: los
-- precios se congelan en `order_items` para que un pedido viejo no cambie de
-- importe porque hoy suba el oro. El costo se congela igual. Se anota una vez,
-- cuando el taller entrega la pieza y ya se sabe qué costó de verdad, y queda
-- pegado a ESE pedido para siempre.
--
-- Las columnas son NULL a propósito: null es "todavía no se sabe", que es el
-- estado normal de un pedido recién creado. Cero sería decir que salió gratis.

alter table public.orders
  add column if not exists costo_taller numeric,
  add column if not exists costo_envio numeric,
  add column if not exists costo_anotado_en timestamptz;

comment on column public.orders.costo_taller is
  'Lo que cobró el taller por esta pieza, con el oro del día en que se hizo. Se anota al despachar. Null = todavía no se sabe.';
comment on column public.orders.costo_envio is
  'Lo que costó el flete de este pedido. No confundir con abono_monto, que es lo que pagó la clienta.';
comment on column public.orders.costo_anotado_en is
  'Cuándo se anotó el costo. Sirve para saber si un margen es un hecho o un hueco.';

-- `products.costo` y `products.costo_provisional` quedan muertas: el panel ya
-- no las lee ni las escribe. No se borran para no perder lo que haya anotado,
-- pero cualquier cifra que salga de ellas es una estimación vieja.
comment on column public.products.costo is
  'MUERTA desde el 23-ago-2026. El costo real vive en orders.costo_taller.';
comment on column public.products.costo_provisional is
  'MUERTA desde el 23-ago-2026. Ver orders.costo_taller.';
