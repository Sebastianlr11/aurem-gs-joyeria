-- Lo que Valentina no sabía contestar.
--
-- El 31 de agosto de 2026, primer día de pauta, dos de las seis conversaciones
-- se escalaron a una persona por preguntas que no eran para escalar:
--
--     «En dónde se encuentran ubicados?»      → escaló, la clienta esperó 5 min
--     «Manejan algún sistema de crédito?»     → escaló
--
-- El conocimiento tenía siete temas y ninguno cubría las dos. Un escalado que
-- no hacía falta cuesta el doble: la clienta espera a que haya alguien, y la
-- persona que hay se gasta en algo que el bot podía resolver.
--
-- Las dos respuestas las decidió el joyero.

-- ── Dónde estamos ─────────────────────────────────────────────────────────
--
-- Lo importante acá no es la respuesta, es el límite: **la dirección exacta se
-- escala**, a propósito y por ahora. No hay todavía una dirección estable que
-- se pueda dar por escrito, y una dirección equivocada manda a alguien a
-- pararse frente a una puerta que no es. Decir la ciudad no tiene ese riesgo y
-- resuelve la mayoría de las veces que preguntan.
insert into public.taller_conocimiento (tema, contenido, orden, activo)
values (
  'Dónde estamos',
  'Estamos en Bogotá y trabajamos desde nuestro taller, no desde una tienda: no hay vitrina a la que ir a mirar, las piezas se hacen por encargo y se envían. Eso se puede decir con toda naturalidad, y de ahí se sigue a los envíos, que llegan a todo el país. PERO SI PIDEN LA DIRECCIÓN EXACTA, O DICEN QUE QUIEREN IR, O PREGUNTAN SI PUEDEN RECOGER: no la des ni la deduzcas, usa escalar_a_humano. Todavía no hay una dirección estable que se pueda dar por escrito, y mandar a alguien a una puerta equivocada es peor que hacerlo esperar un momento. Al escalar no te disculpes de más ni lo hagas sonar a que hay algo raro: es un taller, y el joyero le confirma en un momento cómo hacer.',
  100,
  true
)
on conflict do nothing;

-- ── Crédito ───────────────────────────────────────────────────────────────
--
-- Va como tema aparte y no dentro de «Medios de pago» porque la pregunta que
-- llega es otra —«¿manejan crédito?»— y así el joyero la puede editar sola el
-- día que aparezca una financiadora.
--
-- OJO con lo que NO dice: no promete cuotas ni «sin intereses». Que Mercado
-- Pago ofrezca diferido depende de la tarjeta y del banco de cada quien, y
-- prometerlo es prometer algo que no controlamos.
insert into public.taller_conocimiento (tema, contenido, orden, activo)
values (
  'Crédito y financiación',
  'No manejamos crédito propio ni financiación a cuotas con nosotros: no hay Addi, ni Sistecrédito, ni pagos por partes con el taller. Lo que sí se puede es PAGAR CON TARJETA DE CRÉDITO a través de Mercado Pago, con el mismo enlace de pago de siempre. Dilo así de simple y sin rodeos, y sigue ofreciendo. NO prometas cuotas ni «sin intereses»: si la tarjeta permite diferir, eso lo define el banco de cada quien en el momento de pagar, no nosotros, y no es algo que puedas asegurar. Si insisten en financiación, ahí sí escala.',
  110,
  true
)
on conflict do nothing;
