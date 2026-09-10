-- ============================================================================
-- LA LLAVE PÚBLICA NO TIENE POR QUÉ NI VER ESTA TABLA
-- ============================================================================
-- 9 de septiembre de 2026, minutos después de crear `certificados`.
--
-- RLS ya le devolvía cero filas a `anon` —comprobado con `set local role anon`
-- antes de escribir esto—, pero el GRANT de SELECT la dejaba asomada en el
-- esquema que publican PostgREST y GraphQL: con la llave anónima se veía que
-- existe una tabla `certificados` y con qué columnas. Es la forma, no los
-- datos, pero `anon` no la necesita para nada — la página pública lee por
-- `certificado_publico()`, que es SECURITY DEFINER y sigue funcionando sin
-- este permiso.
--
-- Lo señaló el linter de Supabase (0026) al aplicar la migración anterior. Las
-- otras dieciocho tablas del proyecto están igual y esto NO las toca: cerrarlas
-- de golpe es otra tarea, con su propia comprobación de qué lee el frontend.
-- Ésta nace bien y se queda bien.
-- ============================================================================

revoke select on public.certificados from anon;
