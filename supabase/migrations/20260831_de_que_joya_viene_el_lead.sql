-- De qué joya viene el lead.
--
-- Meta manda en el `referral` el identificador del anuncio, su titular y su
-- cuerpo — pero no qué joya se estaba enseñando. Valentina sabía que alguien
-- venía «del anuncio del taller» y le respondía con el catálogo entero, así
-- que la clienta tenía que volver a explicar lo que ya había visto.
-- Conversación real del 31 de agosto de 2026: llegó por el anuncio del Anillo
-- solitario sencillo y terminó eligiendo entre cinco opciones. Eso es fricción
-- sobre un clic que ya se pagó.
--
-- El puente es esta tabla: id de anuncio de Meta → uuid de pieza.
--
-- ── Por qué vive acá y no en el código ─────────────────────────────────────
--
-- Meta NO deja editar el enlace de un creativo ya publicado: cualquier cambio
-- obliga a crear un anuncio nuevo, con identificador nuevo. Y las campañas
-- cambian cada semana. Con esto dentro de `bot.ts`, cada anuncio nuevo sería
-- un despliegue de una edge function; acá es un UPDATE.
--
-- ── Por qué guarda el uuid y no el nombre ni el precio ─────────────────────
--
-- El nombre lo puede cambiar el joyero desde el panel y el precio cambia
-- cuando sube el oro. Los dos se leen del catálogo en el momento de responder.
-- Una tabla con el precio escrito dentro es una tabla que un día le promete a
-- una clienta un precio que ya no existe.
--
-- ── Cómo se mantiene ───────────────────────────────────────────────────────
--
-- Al publicar un anuncio nuevo de WhatsApp, añadir su id con el uuid de la
-- pieza que enseña. Un id que no esté acá no rompe nada: Valentina cae al
-- flujo de siempre —preguntar qué busca— y deja el `source_id` en el registro
-- de la función, que es la forma de enterarse de que falta una fila.
--
--     update public.ajustes_internos
--        set valor = valor::jsonb || '{"<id del anuncio>": "<uuid de la pieza>"}'::jsonb,
--            actualizado_en = now()
--      where clave = 'anuncios_piezas';

insert into public.ajustes_internos (clave, valor, nota)
values (
  'anuncios_piezas',
  -- Los tres anuncios de WhatsApp activos en la semana 36 (31 ago – 4 sep 2026).
  -- Los uuid están verificados contra el catálogo de producción.
  jsonb_pretty(jsonb_build_object(
    -- Dije redondo con halo
    '120251419397950566', 'adac2d70-e50f-44a5-afe3-5059833c5944',
    -- Anillo solitario sencillo
    '120251419398080566', '91c55f65-27e2-4985-9654-1edb8ccc6ebe',
    -- Juego de dije y topos a bisel
    '120251419398150566', '8c0dfb0b-a1ea-41b4-9415-d0eb5a4498d2'
  )),
  'referral.source_id de Meta → uuid de la pieza que enseña ese anuncio. Lo lee bot.ts para abrir la conversación nombrando la joya en vez de preguntar qué busca.'
)
-- Si ya existe, gana lo que haya en la base: puede tener anuncios más nuevos
-- que este archivo.
on conflict (clave) do nothing;
