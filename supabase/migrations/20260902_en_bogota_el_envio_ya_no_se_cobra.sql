-- En Bogotá el envío ya no se cobra, y Valentina seguía cobrándolo.
--
-- Al quitar el abono se actualizó «Medios de pago» y se dejó atrás «Envíos».
-- Resultado, la noche del 1 de septiembre de 2026, en una conversación real:
--
--     bot: «El envío por Interrapidísimo cuesta aproximadamente $15.000 COP»
--
-- Le estaba poniendo un costo que ya no existe justo encima del argumento que
-- se acababa de construir: en Bogotá la entrega la hace el taller y la clienta
-- paga el precio publicado, ni un peso más.
--
-- Los plazos NO se tocan: se quedan como están, tal como decidió el taller.

update public.taller_conocimiento
   set contenido = 'EN BOGOTÁ LA ENTREGA LA HACEMOS NOSOTROS Y NO SE COBRA: la clienta paga exactamente el precio publicado de la pieza, sin envío aparte y sin nada por adelantado. No menciones costos de envío ni transportadoras a alguien de Bogotá — no hay ninguno. AL RESTO DEL PAÍS enviamos por Interrapidísimo, con un costo adicional aproximado de 15.000 pesos, y se manda la guía para que le haga seguimiento. PLAZOS: nada está fabricado esperando comprador — TODAS las piezas del catálogo se hacen por encargo. Desde que se confirma el pedido, el taller se toma 2 a 3 días en tenerla lista y despacharla. Sumando el envío, la clienta la recibe en 3 a 4 días en Bogotá y en 4 a 6 días en el resto del país. NO prometas "24 a 48 horas" a secas: ese es el tiempo que tarda la transportadora en Bogotá DESPUÉS de despachar, no lo que la clienta espera desde que pide, y decirlo suelto es prometer la mitad del plazo real. PIEZAS A MEDIDA —las que se diseñan desde cero a partir de una idea o una foto— son de 5 a 8 días entre fabricación y entrega. Ese plazo es sólo para esas; el catálogo va más rápido.',
       actualizado_en = now()
 where tema = 'Envíos';
