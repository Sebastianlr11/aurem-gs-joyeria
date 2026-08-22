-- Lo que /confirmacion necesita saber de un pedido, y nada más.
--
-- La pantalla de vuelta de Mercado Pago leía el pedido con `.from('orders')`
-- y la llave pública. Pero `anon` no tiene permiso de lectura sobre `orders`
-- —la única política es `orders_auth_all`, para `authenticated`—, así que para
-- una clienta de verdad esa consulta devuelve null y la página se queda sin
-- resumen del pedido.
--
-- Y hay un daño peor que no se ve: `pixelCompra()` está condicionado a que el
-- pedido exista, así que **el evento Purchase del navegador nunca se
-- disparaba**. El del servidor sí sale desde mp-webhook, pero la
-- deduplicación entre los dos embudos que está construida se quedaba coja
-- justo antes de prender pauta.
--
-- Nadie lo notó porque 16 de los 17 pedidos son contraentrega tomados por
-- WhatsApp: ninguna clienta real ha pasado nunca por esta pantalla.
--
-- Por qué una función y no una política: RLS no sabe expresar "sólo si
-- conoces el id". Si `anon` puede seleccionar por id, puede seleccionar todo
-- —basta con quitar el filtro—. Una función SECURITY DEFINER sí puede, porque
-- devuelve exactamente las columnas que se le escriben y sólo la fila pedida.
--
-- Las cinco columnas son las cinco que la pantalla usa, contadas a mano sobre
-- Confirmacion.jsx. Ni nombre, ni teléfono, ni correo, ni dirección. Tampoco
-- `status`: la pantalla se guía por el parámetro de la URL y quien decide el
-- estado es el webhook, así que darle el de la base sólo invitaría a usarlo.
--
-- El id es un uuid v4: no se adivina, y quien vuelve de Mercado Pago lo trae
-- en la URL.

CREATE OR REPLACE FUNCTION public.pedido_publico(p_id uuid)
RETURNS TABLE (
  amount         numeric,
  abono_monto    numeric,
  payment_method text,
  product_id     uuid,
  product_name   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.amount, o.abono_monto, o.payment_method, o.product_id, o.product_name
    FROM public.orders o
   WHERE o.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.pedido_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedido_publico(uuid) TO anon, authenticated;

/* ── Una mina en un archivo viejo ────────────────────────────────────── */
--
-- `20260311_orders_rls.sql` declara seis políticas sobre `orders`, entre ellas
-- una `orders_anon_read_own` con `TO anon USING (true)` y un comentario que
-- dice "customer can only see order if they know the ID". La política no
-- impone nada de eso: `USING (true)` autoriza la tabla entera, con nombre,
-- teléfono, correo, dirección e importe de todos los pedidos.
--
-- En la base **no existe**: producción tiene una sola política sobre `orders`
-- y es la de `authenticated`. Se comprobó con la llave pública antes de
-- escribir esto y devuelve `[]`. El archivo y la base llevan tiempo separados.
--
-- Pero el archivo sigue ahí, y el día que alguien reconstruya la base
-- reproduciendo las migraciones en orden, esa política se crea. Este DROP va
-- después, así que la deshace. No cambia nada hoy; existe para el día que sí.

DROP POLICY IF EXISTS "orders_anon_read_own" ON public.orders;
