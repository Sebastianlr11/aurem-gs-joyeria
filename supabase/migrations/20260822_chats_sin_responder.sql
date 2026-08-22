-- Conversaciones cuyo último mensaje es de la clienta: nadie ha respondido.
--
-- Existe porque el panel lo calculaba en el navegador: traía los 300 mensajes
-- más recientes, se quedaba con el último de cada teléfono y recortaba la
-- lista a 3. Ese recorte era el único consumidor del dato, así que el contador
-- "Sin responder" del dashboard no podía pasar de 3 por más clientas que
-- estuvieran esperando — y con él el titular "Hoy tienes N cosas por atender".
-- El límite de 300 era el segundo techo: una conversación cuyo último mensaje
-- quedara fuera de esos 300 desaparecía del conteo sin avisar.
--
-- La base no tiene ninguno de los dos techos y ya tiene el índice que hace
-- falta: idx_wa_conv_phone (phone_number, created_at DESC).
--
-- OJO con los permisos: esto devuelve teléfonos y texto de las clientas, así
-- que no va para anon como las otras funciones de analítica. Sólo el panel,
-- que entra autenticado.

CREATE OR REPLACE FUNCTION public.chats_sin_responder()
RETURNS TABLE (
  phone_number text,
  content      text,
  message_type text,
  created_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.phone_number, u.content, u.message_type, u.created_at
    FROM (
      SELECT DISTINCT ON (c.phone_number)
             c.phone_number, c.role, c.content, c.message_type, c.created_at
        FROM public.whatsapp_conversaciones c
       ORDER BY c.phone_number, c.created_at DESC
    ) u
   WHERE u.role = 'user'
   ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.chats_sin_responder() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chats_sin_responder() TO authenticated, service_role;
