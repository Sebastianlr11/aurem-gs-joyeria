/* Borrar de verdad una conversación.
 *
 * Las fotos que manda un cliente —comprobantes, capturas, fotos de su mano—
 * viven en `chat-media`, un bucket privado, y hasta ahora el panel sólo podía
 * leerlas. Eliminar una conversación borraba los mensajes y dejaba las fotos
 * en Storage: el contacto desaparecía de la lista y su correspondencia seguía
 * guardada, que es justo lo que un botón de eliminar promete que no pasa.
 *
 * El bucket no se abre a nadie: sigue siendo privado y sin lectura pública.
 * Esto sólo añade el borrado para quien ya inició sesión en el panel.
 */
drop policy if exists "admins borran chat-media" on storage.objects;

create policy "admins borran chat-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-media');
