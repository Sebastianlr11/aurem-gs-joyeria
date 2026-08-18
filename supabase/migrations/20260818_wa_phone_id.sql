-- Por cuál de nuestros números entró cada mensaje.
--
-- Sin esto, responder siempre salía por WA_PHONE_NUMBER_ID: le escribías al
-- número real y el bot contestaba por el de prueba, que además tiene lista de
-- destinatarios permitidos y rechazaba con (#131030).
alter table public.whatsapp_conversaciones
  add column if not exists wa_phone_id text;

comment on column public.whatsapp_conversaciones.wa_phone_id is
  'phone_number_id de Meta: el número NUESTRO por el que va la conversación.';

-- Para resolver rápido "¿por cuál número le respondo a este cliente?".
create index if not exists idx_wa_conv_phone_id
  on public.whatsapp_conversaciones (phone_number, created_at desc)
  where wa_phone_id is not null;
