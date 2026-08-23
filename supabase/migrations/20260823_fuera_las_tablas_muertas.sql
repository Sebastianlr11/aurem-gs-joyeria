-- Fuera cuatro tablas que ya no significan nada.
--
-- Tres son restos de la era n8n, anteriores a que las Edge Functions y
-- Valentina existieran. Ninguna tiene una sola referencia en el código:
--
--   message_history   0 filas
--   whatsapp_dedup    0 filas — su trabajo lo hace el índice único de
--                     whatsapp_conversaciones.wa_message_id
--   conversaciones    7 filas, todas del 1 y 2 de marzo de 2026, todas de
--                     prueba ("quiero un anillo"), incluyendo status@broadcast
--                     y un @lid. Guardaba el hilo entero en un jsonb, que es
--                     como lo hacía n8n.
--
-- La cuarta es distinta y merece su párrafo. `whatsapp_conversaciones_respaldo`
-- guardaba 79 mensajes de 6 chats entre el 18 de marzo y el 18 de agosto de
-- 2026, y NINGUNO estaba ya en la tabla viva. No es una de las tres que borró
-- `20260822_quitar_respaldos_de_chats.sql` —esa se llevó respaldo_chats_20260822
-- y sus dos hermanas—: es una cuarta, más vieja, que nadie documentó.
--
-- Se borra por el mismo motivo que se escribió aquel día, y que sigue siendo
-- el bueno: el panel promete "sin vuelta atrás" al eliminar una conversación y
-- la política de privacidad promete que «pasado ese tiempo, o si nos lo pides
-- antes, los eliminamos». Con una copia entera de los chats en otra tabla esas
-- dos promesas eran mentira — se borraba de whatsapp_conversaciones y el hilo
-- seguía completo aquí.
--
-- Confirmado con el usuario el 23 de agosto de 2026: la tabla viva se vació a
-- propósito y esos 79 mensajes los mandó borrar él. Esta copia era justo lo que
-- impedía que ese borrado fuera de verdad.

drop table if exists public.message_history;
drop table if exists public.whatsapp_dedup;
drop table if exists public.conversaciones;
drop table if exists public.whatsapp_conversaciones_respaldo;
