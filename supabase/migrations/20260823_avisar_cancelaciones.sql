-- El candado de las cancelaciones avisadas.
--
-- Cuando un pedido ya contado como venta se cae, se le manda a Meta y a TikTok
-- un evento personalizado `PedidoCancelado`. Esta columna es lo que impide que
-- salga dos veces, exactamente igual que `conversion_enviada_en` hace con la
-- venta: se marca y se lee en el mismo UPDATE, que es lo que lo hace seguro
-- contra dos clics seguidos o dos caminos a la vez.
--
-- Conviene saber qué NO arregla esto. Meta no tiene evento estándar de
-- devolución ni forma documentada de revertir un `Purchase` ya enviado — su
-- lista son 17 eventos y ninguno sirve para eso. Así que la cancelación **no
-- se resta** de las conversiones que Meta reporta: sirve para verla en el
-- Administrador de eventos, para colgarle una conversión personalizada, y como
-- señal para que el algoritmo aprenda qué clics acaban mal.
--
-- El retorno de verdad se corrige en el panel, no en Meta: el libro de caja
-- (`pagos`) ya descuenta las ventas que se caen con un movimiento en negativo,
-- y `PautaRetorno` divide esa caja por el gasto con IVA. Meta nunca va a saber
-- que la clienta rechazó el paquete en la puerta.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelacion_enviada_en timestamptz;

COMMENT ON COLUMN public.orders.cancelacion_enviada_en IS
  'Cuándo se le avisó a Meta y TikTok que este pedido se canceló. Candado: si está lleno, no se vuelve a avisar.';
