-- Que el libro de caja cuadre con la regla del dinero, y que lo diga solo.
--
-- 24 de agosto de 2026.
--
-- `pagos` lo llena el disparador `registrar_pago`, y de esa tabla salen ahora
-- las cifras de la portada y el retorno de la pauta. La tabla y la regla
-- —`recibido_de`— son dos formas de responder «cuánto entró por este pedido»,
-- y como toda pareja de este proyecto, un día pueden dejar de coincidir sin
-- que nadie se entere: el número seguiría saliendo redondo y creíble.
--
-- El disparador está bien pensado —recalcula lo que debería haber anotado,
-- resta lo ya anotado y guarda sólo la diferencia, así que se autocorrige—,
-- pero corre en cada `INSERT` y en cada `UPDATE` de cinco columnas. Cualquier
-- cambio futuro en el circuito de estados puede dejarlo desfasado.
--
-- Esta función es el guardián. Devuelve los pedidos donde la suma del libro no
-- es lo que dice la regla. **Vacío es que cuadra**, que es como están las
-- cosas el día que se escribe: 18 pedidos, cero descuadres.
--
-- Es la misma idea que `regla_del_dinero_cuadra()` —que compara la regla de la
-- base contra la tabla de CLAUDE.md §8— pero un piso más abajo: aquélla
-- comprueba que la regla diga lo que debe, y ésta que el libro le haga caso.

create or replace function public.caja_cuadra_con_la_regla()
returns table (
  pedido      uuid,
  estado      text,
  forma_de_pago text,
  dice_el_libro numeric,
  dice_la_regla numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  SELECT o.id, o.status, o.payment_method,
         COALESCE(l.anotado, 0),
         public.recibido_de(o.status, o.payment_method, o.amount, o.abono_monto)
    FROM public.orders o
    LEFT JOIN (
      SELECT order_id, sum(monto) AS anotado
        FROM public.pagos
       GROUP BY order_id
    ) l ON l.order_id = o.id
   WHERE COALESCE(l.anotado, 0)
         <> public.recibido_de(o.status, o.payment_method, o.amount, o.abono_monto)
   ORDER BY o.created_at DESC
   LIMIT 50;
$$;

comment on function public.caja_cuadra_con_la_regla() is
  'Pedidos donde el libro de pagos no cuadra con recibido_de(). Vacío es que cuadra. Lo consulta el vigía cada hora.';

revoke all on function public.caja_cuadra_con_la_regla() from public, anon;
grant execute on function public.caja_cuadra_con_la_regla() to authenticated, service_role;
