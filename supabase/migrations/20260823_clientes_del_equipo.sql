-- Los contactos del equipo también son clientes de mentira.
--
-- `orders` ya se defendía: el disparador `marcar_pedido_de_prueba` compara el
-- correo y los últimos diez dígitos del teléfono contra
-- `ajustes_internos.contactos_equipo` y marca `es_prueba`. `customers` no tenía
-- nada equivalente.
--
-- Y sí hace falta, porque a `customers` se entra por otra puerta: basta con
-- escribirle a Valentina por WhatsApp. No hay que hacer un pedido.
--
-- Cómo se notó: el 22 de agosto de 2026 el usuario le mostró el bot a un amigo
-- desde el número de ese amigo. La conversación creó una fila en `customers`
-- con `es_prueba = false`, y el panel pasó a enseñar un cliente real entre
-- siete — el único. Yo mismo lo leí como "llegó la primera clienta" y se lo
-- reporté así al usuario, que tuvo que corregirme: era una demostración.
--
-- El número ya estaba en `contactos_equipo`. El dato estaba; lo que faltaba era
-- que alguien lo mirara al crear un cliente.

/* ── El disparador, hermano del de pedidos ────────────────────────── */

CREATE OR REPLACE FUNCTION public.marcar_cliente_de_prueba()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contactos  text[];
  tel_limpio text;
BEGIN
  -- Si ya viene marcado a mano, se respeta.
  IF new.es_prueba THEN
    RETURN new;
  END IF;

  SELECT string_to_array(lower(valor), ',') INTO contactos
    FROM ajustes_internos WHERE clave = 'contactos_equipo';

  IF contactos IS NULL THEN
    RETURN new;
  END IF;

  /* Mismo criterio que en pedidos, y a propósito: el mismo número aparece como
     3224847819, +573224847819 y 573224847819 según por dónde entre. Se
     comparan sólo los dígitos, y los últimos diez, que es el número colombiano
     sin indicativo. */
  tel_limpio := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10);

  IF lower(coalesce(new.email, '')) = ANY(contactos)
     OR (tel_limpio <> '' AND EXISTS (
           SELECT 1 FROM unnest(contactos) c
            WHERE right(regexp_replace(c, '\D', '', 'g'), 10) = tel_limpio
         ))
  THEN
    new.es_prueba := true;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_cliente_de_prueba ON public.customers;
CREATE TRIGGER trg_marcar_cliente_de_prueba
  BEFORE INSERT OR UPDATE OF phone, email ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.marcar_cliente_de_prueba();

/* ── Y los que ya estaban ─────────────────────────────────────────── */
--
-- Escrito como regla y no contra un id: hace lo mismo si se corre dos veces y
-- vale sobre cualquier base. Sólo marca; nunca desmarca, igual que el
-- disparador — desmarcar a alguien que se puso a mano sería peor que el
-- problema que arregla.

UPDATE public.customers c
   SET es_prueba = true
  FROM public.ajustes_internos a
 WHERE a.clave = 'contactos_equipo'
   AND c.es_prueba = false
   AND (
        lower(coalesce(c.email, '')) = ANY(string_to_array(lower(a.valor), ','))
        OR (
             right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) <> ''
             AND EXISTS (
               SELECT 1 FROM unnest(string_to_array(lower(a.valor), ',')) x
                WHERE right(regexp_replace(x, '\D', '', 'g'), 10)
                    = right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10)
             )
           )
       );
