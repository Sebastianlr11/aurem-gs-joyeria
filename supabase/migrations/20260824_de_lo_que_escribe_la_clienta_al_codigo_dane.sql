-- De lo que escribió la clienta al código que pide 99envios.
--
-- 24 de agosto de 2026. Fase 1 de la integración con 99envios.
--
-- El checkout guarda la ciudad como texto libre. Esta función la traduce, y
-- **prefiere no responder antes que adivinar**: 80 nombres se repiten en
-- departamentos distintos —«Santa Rosa» son varios municipios— y una guía
-- emitida a la ciudad equivocada es un paquete perdido y un flete pagado.
--
-- El orden de preferencia:
--   1. Nombre y departamento, los dos.
--   2. Sólo el nombre, si en todo el país no hay más que uno con ese nombre.
--   3. Nada. Que lo elija una persona.

create or replace function public.codigo_dane(p_ciudad text, p_departamento text default null)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  WITH c AS (SELECT public.clave_de_ciudad(p_ciudad) AS ciudad,
                    public.clave_de_ciudad(p_departamento) AS depto)
  SELECT codigo FROM (
    -- 1. Nombre + departamento.
    SELECT ce.codigo, 1 AS prioridad
      FROM public.ciudades_envio ce, c
     WHERE c.ciudad IS NOT NULL AND ce.clave = c.ciudad
       AND c.depto IS NOT NULL AND ce.clave_departamento = c.depto
    UNION ALL
    -- 2. Sólo el nombre, y sólo si es inequívoco en todo el país.
    SELECT ce.codigo, 2
      FROM public.ciudades_envio ce, c
     WHERE c.ciudad IS NOT NULL AND ce.clave = c.ciudad
       AND (SELECT count(DISTINCT c2.codigo) FROM public.ciudades_envio c2
             WHERE c2.clave = c.ciudad) = 1
  ) x
  ORDER BY prioridad
  LIMIT 1;
$$;

comment on function public.codigo_dane(text, text) is
  'Codigo DANE de una ciudad escrita a mano. Devuelve null si es ambigua o desconocida: mejor que lo elija una persona a mandar un paquete a otro municipio.';

revoke all on function public.codigo_dane(text, text) from public, anon;
grant execute on function public.codigo_dane(text, text) to authenticated, service_role;

-- ── Los nombres que la gente sí escribe ─────────────────────────────────────
--
-- La lista de 99envios llama a la capital «BOGOTA D.C.», y nadie escribe eso en
-- un formulario: los 18 pedidos de la base dicen «Bogotá», «BOGOTA» o «bogota»,
-- y **ninguno resolvía**. Como la tabla ya guarda alias por diseño —siete
-- códigos vienen con dos nombres de fábrica—, los que faltan se añaden igual.
--
-- Sólo se añade lo inequívoco. Un alias que se pueda confundir con otro
-- municipio no se pone: es preferible que elija una persona a que salga una
-- guía al municipio equivocado.
insert into public.ciudades_envio (codigo, nombre, departamento, clave, clave_departamento) values
  ('11001000', 'BOGOTA',               'BOGOTA D.C.',  'BOGOTA',             'BOGOTA D C'),
  ('11001000', 'BOGOTA DC',            'BOGOTA D.C.',  'BOGOTA DC',          'BOGOTA D C'),
  ('11001000', 'SANTA FE DE BOGOTA',   'BOGOTA D.C.',  'SANTA FE DE BOGOTA', 'BOGOTA D C'),
  -- Y que la capital se reconozca aunque le pongan «Cundinamarca» de departamento.
  ('11001000', 'BOGOTA (CUNDINAMARCA)', 'CUNDINAMARCA', 'BOGOTA',            'CUNDINAMARCA')
on conflict (codigo, nombre) do nothing;
