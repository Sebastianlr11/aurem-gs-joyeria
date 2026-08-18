-- De qué anuncio llegó esta persona.
--
-- Meta manda un objeto `referral` en el primer mensaje de quien entra por un
-- anuncio de clic-a-WhatsApp: qué anuncio, qué titular, qué creativo, y un
-- identificador de clic para atribuir la venta después.
--
-- Se guarda ENTERO y no campo por campo: la documentación pública no expone
-- el esquema completo, y desarmarlo según lo que uno cree recordar es la
-- forma de perder justo el dato que después hace falta.
alter table public.whatsapp_conversaciones
  add column if not exists referral jsonb;

comment on column public.whatsapp_conversaciones.referral is
  'Objeto referral crudo de Meta: de qué anuncio vino el mensaje. Sólo llega en el primero.';

-- Para encontrar rápido el origen de una conversación.
create index if not exists idx_wa_conv_referral
  on public.whatsapp_conversaciones (phone_number, created_at)
  where referral is not null;
