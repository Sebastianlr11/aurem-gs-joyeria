-- No todo el que escribe trae número.
--
-- Desde el 31 de agosto de 2026, con la pauta encendida, Meta empezó a mandar
-- contactos identificados así:
--
--     CO.1287538963396593
--     CO.1570757771396735
--
-- Es un identificador de alcance de negocio: pasa cuando el clic viene de
-- Instagram o de Facebook y no hay teléfono por ningún lado. Responderle
-- funciona —`wa.ts` lo manda en `recipient` y no en `to`—, pero `wa-webhook`
-- lo estaba guardando en `customers.phone`, que es donde va un teléfono.
--
-- ── Por qué eso rompe cosas en silencio ───────────────────────────────────
--
-- Los clientes se deduplican por los últimos diez dígitos
-- (`customers_telefono_diez_unico`, del 23 de agosto). Con el identificador
-- metido ahí:
--
--     CO.1287538963396593  →  clave  8963396593
--     CO.1570757771396735  →  clave  7771396735
--
-- Hoy no chocan con nadie porque los móviles colombianos empiezan por 3 y esas
-- dos claves no. **Es suerte, no diseño.** El día que llegue un identificador
-- que termine en diez dígitos empezando por 3, esa persona se funde con una
-- clienta real y quedan las dos en una sola ficha, sin error y sin aviso.
--
-- ── La forma ──────────────────────────────────────────────────────────────
--
-- El identificador pasa a su propia columna y `phone` se queda para teléfonos
-- de verdad. Los dos índices de `customers` se quedan como están: el parcial
-- ya excluye `phone is null`, así que un contacto sin número simplemente no
-- entra en la deduplicación por diez dígitos. Es la razón de no tocarlos —
-- `sync_customer_from_order` infiere ese índice en su `ON CONFLICT`, y cambiar
-- el predicado obligaría a cambiar el disparador al mismo tiempo.
--
-- Cuando esa persona da su número —hoy el asesor tuvo que pedírselo a mano y
-- costó cuatro mensajes—, se llena `phone` en ESTA misma fila y queda una sola
-- ficha con las dos formas de encontrarla.

alter table public.customers add column if not exists wa_id text;

comment on column public.customers.wa_id is
  'Identificador de alcance de negocio de Meta, cuando el contacto llega sin teléfono. Nunca va en phone: ahí rompe la deduplicación por diez dígitos.';

-- Parcial: la inmensa mayoría de los clientes no tiene identificador, y varios
-- nulos no pueden chocar entre sí.
create unique index if not exists customers_wa_id_unico
  on public.customers (wa_id)
  where wa_id is not null;

-- Las dos filas que ya entraron mal. El criterio es el mismo que aplica
-- `esTelefono()` en el bot: si no es un número, no va en `phone`.
update public.customers
   set wa_id = phone,
       phone = null,
       updated_at = now()
 where phone is not null
   and phone !~ '^[0-9+][0-9 ()+-]*$';
