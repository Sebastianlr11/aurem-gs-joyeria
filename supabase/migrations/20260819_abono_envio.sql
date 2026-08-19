-- El abono que confirma un pedido contraentrega.
--
-- El contraentrega sin abono es una promesa que no cuesta nada hacer: llenar
-- un formulario es gratis, y por eso la mitad de esos pedidos no se reciben.
-- Las devoluciones las paga el negocio, y encima le enseñan a los anuncios
-- que ese público compra, cuando no compra.
--
-- Con un abono, el pedido pasa a ser un hecho verificable: alguien giró plata.
-- Y como se descuenta del total, el cliente no paga de más — paga lo mismo,
-- partido en dos. Si rechaza, el abono cubre el envío que la transportadora
-- cobra igual por haber prestado el servicio.

alter table public.orders
  add column if not exists abono_monto     numeric,
  add column if not exists abono_pagado_en timestamptz;

comment on column public.orders.abono_monto     is 'Cuánto se cobró por adelantado para confirmar un contraentrega. Null en los pedidos que se pagan completos por Mercado Pago.';
comment on column public.orders.abono_pagado_en is 'Cuándo entró el abono. Es el momento en que el pedido deja de ser una intención y pasa a ser una venta.';

-- El monto vive con los demás precios del taller, para que se pueda cambiar
-- desde el panel sin desplegar. Cuando se expanda fuera de Bogotá va a
-- depender del destino, y entonces esta columna pasa a ser el mínimo.
alter table public.taller_precios
  add column if not exists abono_envio numeric not null default 20000;

comment on column public.taller_precios.abono_envio is 'Abono que se cobra por adelantado para confirmar un pedido contraentrega. Se descuenta del total.';
