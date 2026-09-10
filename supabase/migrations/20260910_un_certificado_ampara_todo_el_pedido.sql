-- ============================================================================
-- UN CERTIFICADO AMPARA TODO EL PEDIDO, NO SU PRIMERA PIEZA
-- ============================================================================
-- 9 de septiembre de 2026, horas después de estrenar el certificado.
--
-- La decisión era «uno por pedido», y estaba bien. Lo que estaba mal era la
-- implementación: `datos` guardaba UNA pieza en la raíz, porque cuando se
-- escribió un pedido llevaba una. El mismo día el formulario aprendió a llevar
-- varias, y el primer certificado de un pedido de dos amparó sólo el anillo.
-- La clienta se queda con un papel que no cubre la mitad de lo que compró.
--
-- Ahora `datos.piezas` es una lista.
--
-- ── Los que ya se emitieron NO se migran ────────────────────────────────────
--
-- Y no es pereza: un certificado es un documento con fecha, y reescribirle los
-- datos a uno que ya está impreso en la casa de alguien es exactamente lo que
-- congelarlos viene a impedir. El código lee los dos formatos —`piezasDe()` en
-- `src/lib/certificado.js`, en un solo sitio— y este CHECK acepta los dos.
-- ============================================================================

alter table public.certificados
  drop constraint if exists certificados_datos_con_pieza;

alter table public.certificados
  add constraint certificados_datos_con_pieza check (
    jsonb_typeof(datos) = 'object'
    and (
      -- El formato nuevo: una lista con al menos una pieza con nombre.
      (jsonb_typeof(datos->'piezas') = 'array'
        and jsonb_array_length(datos->'piezas') > 0
        and coalesce(datos->'piezas'->0->>'nombre', '') <> '')
      -- El de antes del 9 de septiembre de 2026: una pieza en la raíz.
      or coalesce(datos->>'pieza', '') <> ''
    )
  );

comment on table public.certificados is
  'Certificados de autenticidad emitidos. `datos.piezas` es la copia congelada de las piezas el día que se emitió: no se recalcula nunca. Los anteriores al 9-sep-2026 guardan una sola pieza en la raíz y se leen igual.';
