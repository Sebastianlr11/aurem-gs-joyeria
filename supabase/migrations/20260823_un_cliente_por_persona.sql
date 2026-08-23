-- Un cliente por persona, no uno por formato de teléfono.
--
-- El mismo número se guarda de tres formas según por dónde entre —`3143602930`
-- desde el panel, `+573143602930` desde el checkout, `573143602930` desde
-- WhatsApp— y `sync_customer_from_order` resolvía el conflicto con
-- `ON CONFLICT (phone)`, que compara la cadena cruda. Resultado: **la misma
-- persona aparecía tres veces** en Clientes.
--
-- Descubierto el 23 de agosto de 2026 al revisar el pago real de prueba.
--
-- Por qué importa más de lo que parece. Hoy son pruebas del equipo, pero con
-- clientas de verdad significa que:
--
--   · el conteo de Clientes infla;
--   · `clientes_nuevos_vs_recurrentes` MIENTE — quien compra por la web y
--     luego por WhatsApp cuenta como dos clientas nuevas y nunca como una
--     recurrente, que es justo la cifra que dice si el negocio retiene;
--   · la ficha de una clienta enseña un pedazo de su historia.
--
-- Todo el resto del sistema ya compara por los **últimos diez dígitos**
-- —`marcar_pedido_de_prueba`, `conversaciones_purgables`, `coincideTelefono`
-- en el panel—. La tabla de clientes era la única excepción.

-- ── 1. Fusionar lo que ya está duplicado ────────────────────────────
-- Se conserva la fila más antigua de cada persona y se le rellenan los huecos
-- con lo que tuvieran las otras. Nada apunta a `customers.id` —comprobado, no
-- hay ninguna clave foránea— así que borrar las sobrantes no deja nada colgando.
with grupos as (
  select right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10) as clave,
         id,
         row_number() over (partition by right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)
                            order by created_at) as puesto
  from public.customers
  where phone is not null and phone <> ''
),
completo as (
  select g.clave,
         min(c.created_at) as created_at,
         -- El nombre más largo suele ser el más completo: "Sebastian torres"
         -- gana a "Sebastian" y a ".".
         (array_agg(c.name order by length(coalesce(c.name,'')) desc))[1] as name,
         (array_agg(c.email) filter (where c.email is not null))[1] as email,
         (array_agg(c.city) filter (where c.city is not null))[1] as city,
         (array_agg(c.address) filter (where c.address is not null))[1] as address,
         (array_agg(c.department) filter (where c.department is not null))[1] as department,
         (array_agg(c.notes) filter (where c.notes is not null))[1] as notes,
         -- Un pedido real redime: si alguna fila no es prueba, la persona no lo es.
         bool_and(c.es_prueba) as es_prueba,
         -- Y si en alguna pidió que no le escribieran, se respeta.
         bool_or(c.no_escribir) as no_escribir
  from grupos g join public.customers c on c.id = g.id
  group by g.clave
)
update public.customers c
set name = coalesce(nullif(x.name,''), c.name),
    email = coalesce(c.email, x.email),
    city = coalesce(c.city, x.city),
    address = coalesce(c.address, x.address),
    department = coalesce(c.department, x.department),
    notes = coalesce(c.notes, x.notes),
    es_prueba = x.es_prueba,
    no_escribir = x.no_escribir,
    created_at = x.created_at,
    updated_at = now()
from completo x, grupos g
where g.id = c.id and g.puesto = 1 and g.clave = x.clave;

delete from public.customers c
using (select id from (
         select id, row_number() over (partition by right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)
                                       order by created_at) as puesto
         from public.customers where phone is not null and phone <> ''
       ) t where puesto > 1) sobrantes
where c.id = sobrantes.id;

-- ── 2. Que no vuelva a pasar ────────────────────────────────────────
-- La unicidad pasa a ser sobre los diez dígitos. Se conserva también el índice
-- sobre la cadena cruda: no estorba y documenta que el campo sigue siendo el
-- teléfono tal como llegó.
create unique index if not exists customers_telefono_diez_unico
  on public.customers (right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10))
  where phone is not null and phone <> '';

-- ── 3. El trigger resuelve el conflicto por los diez dígitos ────────
-- Nota: NO se toca el valor guardado en `phone`. Se sigue almacenando tal como
-- llega, porque media docena de sitios lo leen y normalizarlo aquí sería
-- cambiarles el dato bajo los pies. Lo que cambia es con qué se compara.
create or replace function public.sync_customer_from_order()
returns trigger
language plpgsql
security definer
as $$
BEGIN
  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone <> '' THEN
    INSERT INTO public.customers (phone, name, email, city, es_prueba, updated_at)
    VALUES (
      NEW.customer_phone,
      COALESCE(NULLIF(NEW.customer_name, ''), ''),
      NULLIF(NEW.customer_email, 'noreply@auremgs.com'),
      NEW.shipping_city,
      COALESCE(NEW.es_prueba, false),
      now()
    )
    ON CONFLICT (right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)) WHERE phone is not null and phone <> ''
    DO UPDATE SET
      name = CASE WHEN EXCLUDED.name <> '' AND (customers.name IS NULL OR customers.name = '')
        THEN EXCLUDED.name ELSE customers.name END,
      email = COALESCE(NULLIF(EXCLUDED.email, ''), customers.email),
      city = COALESCE(EXCLUDED.city, customers.city),
      -- Sólo baja: un pedido real redime a un cliente marcado como prueba,
      -- pero un pedido de prueba no puede ensuciar a un cliente real.
      es_prueba = customers.es_prueba AND EXCLUDED.es_prueba,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
