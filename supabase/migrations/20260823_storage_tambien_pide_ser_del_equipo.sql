-- ============================================================================
-- STORAGE TAMBIÉN PIDE SER DEL EQUIPO
-- ============================================================================
-- 23 de agosto de 2026. La otra mitad de
-- `20260823_tener_sesion_no_es_ser_del_equipo.sql`.
--
-- Las fotos tenían exactamente el mismo agujero que las tablas: bastaba con
-- tener una sesión. Y con el registro abierto, eso quería decir que cualquiera
-- podía **borrar las fotos del catálogo entero** —que es la tienda— y las que
-- mandan las clientas por WhatsApp, además de subir lo que quisiera a un bucket
-- público servido desde el dominio de Aurem Gs.
--
-- `product_images_public_read` NO se toca: el catálogo tiene que verlo
-- cualquiera, y sin eso la tienda se queda sin imágenes.
-- ============================================================================

alter policy "product_images_auth_upload" on storage.objects
  to authenticated
  with check (bucket_id = 'product-images' and public.es_del_equipo());

alter policy "product_images_auth_delete" on storage.objects
  to authenticated
  using (bucket_id = 'product-images' and public.es_del_equipo());

alter policy "admins leen chat-media" on storage.objects
  to authenticated
  using (bucket_id = 'chat-media' and public.es_del_equipo());

alter policy "admins borran chat-media" on storage.objects
  to authenticated
  using (bucket_id = 'chat-media' and public.es_del_equipo());
