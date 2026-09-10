-- ============================================================================
-- EL PANEL PODÍA LEER LAS PIEZAS DE UN PEDIDO, PERO NO ESCRIBIRLAS
-- ============================================================================
-- 9 de septiembre de 2026, la misma noche en que el formulario de pedidos
-- aprendió a llevar varias piezas.
--
-- `order_items` tenía UNA política —«el equipo ve las piezas del pedido», de
-- sólo lectura— y ninguna de escritura. Nadie lo había notado en un mes porque
-- hasta ahora la tabla la llenaba **sólo `create-preference`**, que corre con
-- la llave de servicio y se salta RLS entera. El panel nunca había intentado
-- escribir ahí.
--
-- El primer pedido de dos piezas cargado a mano se guardó en `orders` con su
-- nombre pegado y su total, y sus dos filas de `order_items` **no se
-- escribieron**. El pedido quedó sin piezas: el correo de confirmación
-- enseñaría una sola, el taller no sabría qué fabricar y el certificado
-- saldría sin talla.
--
-- La lección, que es la de siempre en este proyecto: una tabla que hasta hoy
-- sólo tocaba una Edge Function con llave de servicio **no tiene sus permisos
-- probados**. El día que el panel la toca, se descubre.
-- ============================================================================

create policy "el equipo crea las piezas del pedido" on public.order_items
  for insert to authenticated
  with check (public.es_del_equipo());

create policy "el equipo corrige las piezas del pedido" on public.order_items
  for update to authenticated
  using (public.es_del_equipo())
  with check (public.es_del_equipo());

-- Editar un pedido reescribe sus piezas: se borran las que había y se vuelven
-- a insertar. Sin el borrado, editar duplicaría las líneas en vez de
-- reemplazarlas.
create policy "el equipo quita las piezas del pedido" on public.order_items
  for delete to authenticated
  using (public.es_del_equipo());
