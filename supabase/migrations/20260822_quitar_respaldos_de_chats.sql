-- Fuera las tres tablas de respaldo del 22 de agosto.
--
-- Se levantaron al investigar el borrado de conversaciones y quedaron ahí.
-- `20260822_cerrar_conversaciones_a_anon.sql` les encendió RLS para sacarlas
-- del alcance de la llave pública, y dejó escrito por qué no las borraba:
-- «son el respaldo de alguien y borrar el respaldo de otro no se hace sin
-- preguntar». Preguntado y respondido: el usuario pidió borrarlas.
--
-- El motivo de fondo no es el espacio. El panel ya sabe eliminar una
-- conversación y purgar las viejas, y las dos cosas prometen que el hilo se va
-- —el diálogo dice «sin vuelta atrás» y la política de privacidad promete
-- «pasado ese tiempo, o si nos lo pides antes, los eliminamos»—. Con una copia
-- entera de los chats en otra tabla, esa promesa era falsa: se borraba de
-- `whatsapp_conversaciones` y el hilo seguía completo en `respaldo_chats`.
--
-- Comprobado antes de borrar: sólo había dos números, los dos del equipo
-- (573143602930 y 573167414801), sin ningún pedido real asociado, y los dos
-- conservan su conversación viva. Lo que la copia guardaba de más eran 87
-- mensajes de las pruebas con Valentina entre el 18 y el 22 de agosto.

drop table if exists public.respaldo_chats_20260822;
drop table if exists public.respaldo_takeover_20260822;
drop table if exists public.respaldo_chatstatus_20260822;
