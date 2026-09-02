-- Un índice parcial no sirve para un ON CONFLICT.
--
-- El 1 de septiembre se creó `customers_wa_id_unico` como índice **parcial**
-- (`where wa_id is not null`), pensando en no indexar las filas que no tienen
-- identificador. Parecía lo prolijo y rompió lo importante:
--
--   await db.from('customers').upsert({ name, wa_id }, { onConflict: 'wa_id' })
--
-- Postgres **no puede inferir un índice parcial** en un `ON CONFLICT` a menos
-- que la sentencia repita su mismo predicado, y PostgREST no lo repite. Así
-- que el upsert falló desde el primer contacto — y falló **en silencio**,
-- porque esa línea no miraba el error.
--
-- El efecto, medido el 2 de septiembre: de las catorce conversaciones del día,
-- las once que llegaron con teléfono tenían ficha de cliente y **las dos que
-- llegaron con identificador de Meta, ninguna**. Se perdía su nombre de perfil
-- —lo único que Meta manda de esa persona— y no quedaba ni un registro suyo
-- fuera del hilo de chat.
--
-- Un índice único normal hace exactamente lo que hacía falta: en Postgres los
-- nulos son distintos entre sí, así que muchas filas sin `wa_id` conviven sin
-- chocar, y el `ON CONFLICT` sí lo puede inferir.
--
-- No hay nada que recuperar: el nombre viene en cada mensaje entrante, así que
-- la ficha se crea sola la próxima vez que esa persona escriba.

drop index if exists public.customers_wa_id_unico;

create unique index customers_wa_id_unico
  on public.customers (wa_id);
