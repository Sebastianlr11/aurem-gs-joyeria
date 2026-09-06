-- En qué va cada conversación.
--
-- El panel tenía tres formas de marcar un chat —resuelto, archivado y
-- etiquetas de colores— y el 6 de septiembre de 2026, con cuarenta chats
-- encima, **ninguna se había usado ni una sola vez**: cero resueltos, cero
-- archivados, cero etiquetas.
--
-- No fue por falta de ganas. «Marcar resuelta» vive detrás de un menú de tres
-- puntos, uno por fila, y nadie abre un menú treinta veces al día. Y aunque se
-- abriera, «resuelto» no dice lo que hace falta: el joyero necesita distinguir
-- «ya le hablé y está en proceso» de «esto terminó», y eso no cabe en un sí/no.
--
-- Esto es lo segundo: un estado con los pasos por los que pasa una venta de
-- verdad. Lo primero —que se marque en un toque y desde donde él está
-- mirando— va en el panel.
--
-- No hay nada que migrar, y por eso se pudo hacer bien: sin filas viejas que
-- encajar, el estado nace limpio.
--
-- `nuevo` es el de por defecto y significa «nadie lo ha tocado todavía», que
-- es exactamente en lo que están los cuarenta.

alter table public.chat_status
  add column if not exists estado text not null default 'nuevo';

alter table public.chat_status
  drop constraint if exists chat_status_estado_valido;

/* Con CHECK y no con texto libre: es el vocabulario del embudo y el panel
   pinta un color por cada valor. Un estado escrito a mano en la base saldría
   sin color y sin filtro, y nadie sabría por qué. Al revés que
   `orders.status`, que quedó sin restricción y hay que sostener a pulso. */
alter table public.chat_status
  add constraint chat_status_estado_valido
  check (estado in ('nuevo', 'atendiendo', 'cotizado', 'vendido', 'perdido'));

comment on column public.chat_status.estado is
  'En qué va la conversación: nuevo (nadie la ha tocado) · atendiendo (alguien está hablando con esa persona) · cotizado (se le pasó precio y está pensándolo) · vendido · perdido.';

/* Para la lista del panel, que filtra por estado y ordena por lo último que
   pasó. Sin esto son cuarenta filas hoy y un escaneo completo el día que sean
   cuatro mil. */
create index if not exists chat_status_estado_idx
  on public.chat_status (estado);
