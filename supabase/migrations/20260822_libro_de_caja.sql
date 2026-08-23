-- El libro de caja: cuándo entró cada peso.
--
-- Hasta hoy no había forma de responder "¿cuánto entró ayer?". `orders` guarda
-- el estado de AHORA y dos fechas: `abono_pagado_en` y `status_updated_at`. La
-- segunda es el ÚLTIMO cambio de estado, así que se pisa sola — cuando un
-- pedido llega a entregado ya no queda rastro de cuándo se pagó.
--
-- Por eso el gráfico de catorce días del panel tuvo que pasar a medir "lo que
-- se pidió" en vez de "lo que se cobró": era lo único que se podía fechar sin
-- inventar. Esto arregla la causa.
--
-- SE HACE AHORA PORQUE AHORA ES GRATIS
-- Los 17 pedidos de la base son pruebas del equipo; no hay ni un cliente real.
-- Con clientes reales habría que reconstruir la historia a mano, y no se
-- podría. La tabla arranca vacía y se llena de aquí en adelante.
--
-- LA REGLA QUE EVITA EL BUG DE SIEMPRE
-- Este proyecto ya se quemó dos veces con lo mismo: dos sitios contando la
-- plata con reglas distintas y el panel diciendo dos cosas de un mismo pedido.
-- Así que el libro NO tiene reglas propias. `recibido_de()` de acá abajo es la
-- traducción literal de `recibidoDe()` de src/lib/dinero.js, y el disparador
-- se limita a anotar la DIFERENCIA entre lo que esa función dice y lo que ya
-- hay anotado.
--
-- Consecuencia buscada: `sum(pagos.monto)` de un pedido es SIEMPRE igual a
-- `recibidoDe()` de ese pedido. No pueden discrepar, porque uno se calcula del
-- otro. Si algún día cambia dinero.js, hay que cambiar esta función — y el
-- invariante lo delata: la comprobación está al final de este archivo.

/* ── 1. Cuánta plata hay dentro de un pedido, según su estado ─────────
   Espejo exacto de recibidoDe() en src/lib/dinero.js. Si tocas una, toca la
   otra. */

CREATE OR REPLACE FUNCTION public.recibido_de(
  p_status         text,
  p_payment_method text,
  p_amount         numeric,
  p_abono_monto    numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status IN ('cancelado', 'pendiente') THEN 0

    /* Pago anticipado: entra completo en cuanto el pedido deja de estar
       pendiente. */
    WHEN p_payment_method IS DISTINCT FROM 'contraentrega' THEN
      CASE WHEN p_status IN ('pagado', 'procesando', 'enviado', 'entregado')
           THEN COALESCE(p_amount, 0) ELSE 0 END

    /* Contraentrega entregado: el mensajero entrega y trae la plata el mismo
       día, así que entregado ya es cobrado. 'pagado' queda como estado
       heredado y cuenta igual. */
    WHEN p_status IN ('entregado', 'pagado') THEN COALESCE(p_amount, 0)

    /* Contraentrega en curso: sólo entró el abono del envío. El resto está en
       el bolsillo de la clienta hasta que le toquen la puerta. */
    WHEN p_status IN ('procesando', 'enviado') THEN COALESCE(p_abono_monto, 0)

    ELSE 0
  END;
$$;

COMMENT ON FUNCTION public.recibido_de(text, text, numeric, numeric) IS
  'Plata que YA entró por un pedido, según su estado. Espejo de recibidoDe() en src/lib/dinero.js: si cambia una, cambia la otra.';

/* ── 2. El libro ──────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.pagos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  /* Qué fue este movimiento. 'reverso' es plata que se deshace: un pedido
     cobrado que se cancela, o un monto corregido a la baja. Va con signo
     negativo y por eso `monto` no lleva CHECK de positivo. */
  concepto    text NOT NULL CHECK (concepto IN ('abono', 'saldo', 'total', 'reverso')),
  monto       numeric NOT NULL CHECK (monto <> 0),

  /* Cómo pagó, copiado del pedido. Sirve para separar lo que llega a la
     cuenta de Mercado Pago —que viene con comisión encima— del efectivo. */
  medio       text,

  /* La fecha que da sentido a todo esto. Para el abono es abono_pagado_en,
     que sí se guarda; para el resto, el momento del cambio de estado. */
  ocurrido_en timestamptz NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_ocurrido ON public.pagos (ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_order    ON public.pagos (order_id);

COMMENT ON TABLE public.pagos IS
  'Cuándo entró cada peso. Lo escribe solo el disparador de orders; no se toca a mano.';

/* Sólo el panel lo lee. Nadie lo escribe desde fuera: lo llena el disparador,
   que corre como dueño de la tabla. */
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "el equipo ve el libro de caja" ON public.pagos;
CREATE POLICY "el equipo ve el libro de caja"
  ON public.pagos FOR SELECT TO authenticated USING (true);

/* ── 3. El disparador ─────────────────────────────────────────────── */
--
-- Va en la base y no en quien llama porque la plata entra por cuatro puertas
-- que no se conocen entre sí: mp-webhook cuando Mercado Pago aprueba, el panel
-- cuando se marca entregado, PedidoModal cuando se carga un pedido ya cobrado,
-- y crear_orden_whatsapp cuando lo toma Valentina. Un día se abre una quinta y
-- nadie se acuerda de anotar el pago. La base sí.

CREATE OR REPLACE FUNCTION public.registrar_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deberia  numeric;
  v_anotado  numeric;
  v_delta    numeric;
  v_concepto text;
  v_cuando   timestamptz;
  v_cod      boolean := NEW.payment_method IS NOT DISTINCT FROM 'contraentrega';
BEGIN
  v_deberia := recibido_de(NEW.status, NEW.payment_method, NEW.amount, NEW.abono_monto);
  SELECT COALESCE(sum(monto), 0) INTO v_anotado FROM pagos WHERE order_id = NEW.id;
  v_delta := v_deberia - v_anotado;

  /* Nada cambió de plata: la inmensa mayoría de los UPDATE. Salir aquí es lo
     que hace que el disparador sea idempotente sin necesitar claves únicas. */
  IF v_delta = 0 THEN
    RETURN NULL;
  END IF;

  /* Cuándo pasó. El abono es el único momento que la base ya sabía fechar; el
     resto ocurre justo ahora, que es de lo que se trataba. */
  IF TG_OP = 'UPDATE'
     AND NEW.abono_pagado_en IS NOT NULL
     AND NEW.abono_pagado_en IS DISTINCT FROM OLD.abono_pagado_en THEN
    v_cuando := NEW.abono_pagado_en;
  ELSIF TG_OP = 'INSERT' THEN
    v_cuando := COALESCE(NEW.abono_pagado_en, NEW.created_at, now());
  ELSE
    v_cuando := now();
  END IF;

  v_concepto := CASE
    WHEN v_delta < 0                                    THEN 'reverso'
    WHEN v_cod AND v_anotado > 0                        THEN 'saldo'
    WHEN v_cod AND v_deberia = COALESCE(NEW.abono_monto, -1) THEN 'abono'
    ELSE 'total'
  END;

  INSERT INTO pagos (order_id, concepto, monto, medio, ocurrido_en)
  VALUES (NEW.id, v_concepto, v_delta, NEW.payment_method, v_cuando);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_pago ON public.orders;
CREATE TRIGGER trg_registrar_pago
  AFTER INSERT OR UPDATE OF status, amount, abono_monto, abono_pagado_en, payment_method
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.registrar_pago();

/* ── 4. Lo único del pasado que sí se puede fechar ────────────────── */
--
-- Al encender el libro, de los 17 pedidos que había sólo UNO tenía plata
-- dentro sin anotar: un contraentrega en camino con su abono de $20.000. Los
-- demás están cancelados o pendientes, así que su libro vacío ya cuadra.
--
-- Y ese abono tiene fecha de verdad —`abono_pagado_en`, que la base sí
-- guardaba—, así que anotarlo no es inventar nada. Si no la tuviera se
-- quedaría fuera: preferible un invariante que señala una fila vieja a un
-- libro con una fecha imaginaria dentro.
--
-- Escrito como regla y no contra un id: así vale igual si esto se reproduce
-- sobre otra base, y no hace nada si se corre dos veces.

INSERT INTO public.pagos (order_id, concepto, monto, medio, ocurrido_en)
SELECT o.id, 'abono', o.abono_monto, o.payment_method, o.abono_pagado_en
  FROM public.orders o
 WHERE o.abono_pagado_en IS NOT NULL
   AND o.abono_monto IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.pagos p WHERE p.order_id = o.id)
   /* Sólo si el abono es TODO lo que entró. Un pedido con más plata dentro
      tendría movimientos sin fecha, y ésos no se inventan. */
   AND recibido_de(o.status, o.payment_method, o.amount, o.abono_monto) = o.abono_monto;

/* ── 5. El invariante, para poder comprobarlo cuando haga falta ────── */
--
--   select o.id, recibido_de(o.status, o.payment_method, o.amount, o.abono_monto) as segun_estado,
--          coalesce(sum(p.monto), 0) as segun_libro
--     from orders o left join pagos p on p.order_id = o.id
--    group by o.id, o.status, o.payment_method, o.amount, o.abono_monto
--   having recibido_de(o.status, o.payment_method, o.amount, o.abono_monto)
--          <> coalesce(sum(p.monto), 0);
--
-- Tiene que devolver cero filas. Si devuelve alguna, el libro y los pedidos se
-- separaron y hay que averiguar por qué antes de fiarse de ningún número.
--
-- NO se rellena la historia vieja a propósito. Los 17 pedidos que hay son
-- pruebas del equipo y sus fechas de cobro no existen en ninguna parte;
-- inventarlas sería justo lo que este archivo viene a evitar. El libro empieza
-- vacío y desde ahora cuadra solo.
