-- Las conversaciones con las clientas estaban abiertas con la llave pública.
--
-- La llave `anon` va dentro del bundle de JavaScript del sitio: es pública por
-- diseño, cualquiera la saca del navegador en diez segundos. Y estas cinco
-- tablas tenían políticas `[public ALL] using=true`, que incluye a anon. O sea
-- que cualquiera podía leer toda la correspondencia con las clientas —nombres,
-- teléfonos, fotos, lo que preguntaron y lo que se les contestó— y también
-- BORRARLA.
--
-- Quién toca de verdad cada tabla, verificado sobre el repo entero:
--
--   whatsapp_conversaciones  navegador: sólo src/pages/admin/* y
--                            src/lib/chatArchivo.js, autenticados.
--   chat_takeover            navegador: sólo ChatPanel y el dashboard,
--                            autenticados.
--   message_history          NADIE. Cero referencias, cero filas.
--   whatsapp_dedup           NADIE. Cero referencias, cero filas.
--   conversaciones           NADIE. Cero referencias, cero filas.
--
-- Las edge functions no se enteran de este cambio: usan admin() de
-- _shared/wa.ts, que es SERVICE_ROLE_KEY y se salta RLS por completo. El bot
-- sigue leyendo y escribiendo igual.
--
-- Las dos primeras quedan abiertas para `authenticated`, que es el panel. Las
-- tres muertas quedan sin ninguna política: con RLS encendido eso significa
-- que sólo las alcanza service_role. Si algún día se usan, se les escribe la
-- política que corresponda; mientras tanto no tiene sentido que estén
-- accesibles.

/* ── Las dos que el panel sí usa ─────────────────────────────────────── */

DROP POLICY IF EXISTS "whatsapp_full_access" ON public.whatsapp_conversaciones;

CREATE POLICY "el equipo ve y escribe las conversaciones"
  ON public.whatsapp_conversaciones
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for chat_takeover" ON public.chat_takeover;

CREATE POLICY "el equipo maneja el control manual"
  ON public.chat_takeover
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

/* ── Las tres muertas: se cierran del todo ───────────────────────────── */

DROP POLICY IF EXISTS "service_full_access" ON public.message_history;
DROP POLICY IF EXISTS "Allow all for anon"  ON public.whatsapp_dedup;
DROP POLICY IF EXISTS "conversaciones_anon" ON public.conversaciones;

/* ── Los respaldos de hoy, que quedaron con RLS apagado ──────────────── */
--
-- Tres tablas creadas el 22 de agosto de 2026 como red de seguridad al
-- trabajar el borrado de conversaciones. Con RLS apagado están expuestas
-- enteras a la llave pública, y entre las tres guardan 104 filas de
-- conversaciones reales.
--
-- No se borran: son el respaldo de alguien y borrar el respaldo de otro no se
-- hace sin preguntar. Se les enciende RLS sin políticas, que las deja
-- alcanzables sólo por service_role y por el editor SQL — que es como se
-- usan— y fuera del alcance de la llave pública. Nada del código las lee.

-- Nota del 22 de agosto, más tarde: el usuario dio permiso y las tres tablas
-- se borraron en `20260822_quitar_respaldos_de_chats.sql`. Estas tres líneas
-- se quedan porque son el registro de lo que se hizo aquel día, pero pasan a
-- ser condicionales: sin guarda, cualquier reejecución de las migraciones
-- reventaba al llegar a una tabla que ya no existe —y que, de hecho, nunca
-- llegó a crearla ninguna migración de este repo—.
DO $$
BEGIN
  IF to_regclass('public.respaldo_chats_20260822') IS NOT NULL THEN
    ALTER TABLE public.respaldo_chats_20260822      ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.respaldo_takeover_20260822') IS NOT NULL THEN
    ALTER TABLE public.respaldo_takeover_20260822   ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.respaldo_chatstatus_20260822') IS NOT NULL THEN
    ALTER TABLE public.respaldo_chatstatus_20260822 ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
