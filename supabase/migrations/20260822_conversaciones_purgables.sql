-- Qué conversaciones se pueden borrar sin remordimiento.
--
-- La política de privacidad promete que las conversaciones y las fotos se
-- conservan «mientras sigas siendo cliente y durante el tiempo en que puedas
-- presentar un reclamo o hacer valer la garantía», y que pasado ese tiempo se
-- eliminan. Hasta hoy nadie borraba nada: no hay retención en ninguna tabla del
-- proyecto, así que esa frase era una promesa que el panel no podía cumplir.
--
-- El criterio lo fija la propia garantía. La del metal es **de por vida**, así
-- que quien alguna vez hizo un pedido de verdad no prescribe nunca: su hilo no
-- aparece aquí por muchos años que pasen. Lo que sí se puede soltar es lo de
-- quien preguntó, no compró, y lleva un año sin volver.
--
-- Esto sólo *propone*. No borra nada, no corre solo, y no hay cron detrás: el
-- panel lo enseña, se revisa, y quien decide es una persona. Una purga
-- automática de correspondencia de clientas no se enciende sin mirarla.

create or replace function public.conversaciones_purgables(p_meses int default 12)
returns table (
  phone_number   text,
  ultimo_mensaje timestamptz,
  mensajes       bigint,
  fotos          bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with hilos as (
    select c.phone_number,
           max(c.created_at) as ultimo_mensaje,
           count(*)          as mensajes,
           count(*) filter (
             where c.message_type = 'image' and c.media_url is not null
           ) as fotos,
           -- Los diez de siempre. `orders.customer_phone` guarda el mismo
           -- número como '+573143602930' y como '3143602930', así que cruzar
           -- las columnas tal cual no encuentra al comprador la mitad de las
           -- veces — y no encontrarlo aquí significa ofrecer borrar el hilo de
           -- una clienta con garantía viva.
           right(regexp_replace(c.phone_number, '\D', '', 'g'), 10) as clave
      from public.whatsapp_conversaciones c
     group by c.phone_number
  ),
  compradores as (
    -- Los pedidos de prueba del equipo no protegen a nadie: si contaran, los
    -- hilos de las pruebas nunca se podrían limpiar.
    select distinct right(regexp_replace(o.customer_phone, '\D', '', 'g'), 10) as clave
      from public.orders o
     where o.es_prueba = false
       and o.customer_phone is not null
  )
  select h.phone_number, h.ultimo_mensaje, h.mensajes, h.fotos
    from hilos h
   where h.ultimo_mensaje < now() - make_interval(months => greatest(p_meses, 1))
     and not exists (
       select 1 from compradores k where k.clave = h.clave
     )
     -- Si alguien la tiene tomada a mano ahora mismo, está viva por definición.
     and not exists (
       select 1 from public.chat_takeover t
        where t.phone_number = h.phone_number and t.is_active
     )
   order by h.ultimo_mensaje asc;
$$;

comment on function public.conversaciones_purgables(int) is
  'Conversaciones de quien nunca compró y lleva N meses en silencio. Sólo propone: el borrado lo confirma una persona desde el panel.';

-- Devuelve teléfonos y fechas de clientas, así que no va para anon como las
-- funciones de analítica.
revoke all on function public.conversaciones_purgables(int) from public, anon;
grant execute on function public.conversaciones_purgables(int) to authenticated, service_role;
