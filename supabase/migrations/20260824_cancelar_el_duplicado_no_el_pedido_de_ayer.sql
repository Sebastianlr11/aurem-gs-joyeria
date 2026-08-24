-- El disparador que cancela duplicados cancelaba de más y detectaba de menos.
--
-- 24 de agosto de 2026.
--
-- `cancel_duplicate_pending_orders` corre en cada `INSERT` sobre `orders` y
-- cancela los pedidos `pendiente` del mismo cliente y la misma pieza. Existe
-- por un caso concreto y real: la clienta llena el checkout, se va a Mercado
-- Pago, se arrepiente y vuelve a empezar eligiendo contraentrega. Sin esto
-- quedan dos pedidos por la misma pieza y alguien fabrica dos anillos.
--
-- Tenía dos problemas, uno en cada dirección.
--
-- ── Detectaba de menos ──────────────────────────────────────────────────────
--
-- Cruzaba `customer_phone = NEW.customer_phone`, la cadena entera. El mismo
-- número entra de tres formas según el canal —`3143602930` desde el panel,
-- `+573143602930` desde el checkout, `573143602930` desde WhatsApp—, así que
-- **cuando el formato cambiaba el duplicado no se detectaba** y quedaban los
-- dos pedidos vivos. Es el mismo fallo que `20260823_un_cliente_por_persona.sql`
-- cerró en `customers` y que después apareció en las RPC de informes.
--
-- ── Y cancelaba de más ──────────────────────────────────────────────────────
--
-- No miraba CUÁNDO se había hecho el pedido viejo. Así que **un pedido
-- legítimo repetido se caía solo y en silencio**: dos anillos iguales, uno
-- para regalar, pedidos con una semana de diferencia y el primero todavía sin
-- pagar. El segundo mataba al primero.
--
-- Arreglar sólo el teléfono habría empeorado eso, porque el cruce acertaría
-- más veces. Por eso van juntos: se amplía el cruce y se acota la ventana.
--
-- **Una hora.** El caso que esto resuelve ocurre en minutos —es la misma
-- persona en la misma sesión de checkout cambiando de idea—. Un pedido
-- pendiente de ayer no es un duplicado: es un pedido que merece que alguien
-- decida. Se mide contra `NEW.created_at` y no contra `now()` para que se
-- comporte igual si algún día se recargan pedidos con su fecha original.

create or replace function public.cancel_duplicate_pending_orders()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  UPDATE orders
  SET status = 'cancelado',
      status_updated_at = now()
  WHERE id != NEW.id
    AND status = 'pendiente'
    AND product_name = NEW.product_name
    /* La ventana. Sin esto se cancelaban pedidos legítimos de días atrás. */
    AND created_at >= NEW.created_at - interval '1 hour'
    AND (
      (NEW.customer_phone IS NOT NULL
        AND right(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g'), 10)
          = right(regexp_replace(NEW.customer_phone, '\D', '', 'g'), 10)
        AND right(regexp_replace(NEW.customer_phone, '\D', '', 'g'), 10) <> '')
      OR
      (NEW.customer_phone IS NULL AND NEW.customer_email IS NOT NULL
        AND lower(customer_email) = lower(NEW.customer_email))
    );
  RETURN NEW;
END;
$function$;

comment on function public.cancel_duplicate_pending_orders() is
  'Cancela el pedido pendiente que la clienta acaba de reemplazar en el checkout. Cruza por los últimos diez dígitos del teléfono y sólo dentro de la hora anterior: un pendiente más viejo no es un duplicado.';
