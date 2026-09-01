-- El contraentrega de Bogotá ya no pide abono.
--
-- Hasta hoy, para confirmar un contraentrega la clienta abonaba $20.000 por
-- Mercado Pago y pagaba el resto en la puerta. Con la pauta encendida se vio
-- el efecto: entraban a la ficha desde el anuncio y se echaban atrás justo al
-- ver que había que pagar algo por adelantado.
--
-- Lo que cambió para poder quitarlo: **las entregas de Bogotá las hace el
-- taller**. El abono cubría el envío de ida y vuelta de un domiciliario cuando
-- la persona no estaba o cambiaba de opinión — ese costo ya no existe, y la
-- pieza vuelve al inventario.
--
-- Lo que NO cambia y sigue protegiendo el riesgo: el tope de $500.000. Es la
-- línea entre lo que hay en stock y lo que se fabrica por encargo, y por eso
-- se queda donde está.
--
-- ── Cero es una decisión, no un dato que falta ────────────────────────────
--
-- `abono_envio = 0` significa «no se cobra nada por adelantado» y así lo leen
-- `create-preference`, el prompt de Valentina y la ficha del producto. `null`
-- seguiría significando «no lo sé», y ahí nadie inventa una cifra. La
-- maquinaria del abono se queda entera: el día que se quiera volver a cobrar,
-- o cobrarlo fuera de Bogotá, es este mismo UPDATE al revés.

update public.taller_precios
   set abono_envio = 0
 where abono_envio is distinct from 0;

-- ── Y lo que Valentina cuenta ─────────────────────────────────────────────
--
-- El texto viejo explicaba por qué se cobraba el abono, con el incidente y
-- todo. Eso ya no aplica y dejarlo era garantizar que se lo contara a alguien.
update public.taller_conocimiento
   set contenido = 'Aceptamos Nequi, Mercado Pago y pago contra entrega. EL CONTRA ENTREGA ES SÓLO PARA BOGOTÁ: al resto del país se le cobra por anticipado, por Nequi o Mercado Pago. Pregunta la ciudad antes de ofrecerlo, y si no es Bogotá no lo menciones siquiera. EN BOGOTÁ NO SE ABONA NADA: la clienta paga el precio publicado, completo y en efectivo, cuando recibe la pieza. No hay abono, no hay envío aparte, no hay nada «para confirmar». Dilo como argumento y no como un dato administrativo — «pagas cuando la tengas en la mano» es lo que hace confiar a quien compra por primera vez y no nos conoce. SI PREGUNTA POR QUÉ NO COBRAMOS NADA ANTES: porque en Bogotá la entrega la hacemos nosotros, así de simple. Eso vale sólo para Bogotá; fuera de la ciudad el pago va por anticipado y ahí no lo prometas. Si eligen Mercado Pago para pagar en línea, el enlace sale de crear_pedido.',
       actualizado_en = now()
 where tema = 'Medios de pago';
