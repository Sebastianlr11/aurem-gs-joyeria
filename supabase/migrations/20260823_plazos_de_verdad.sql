-- Lo que Valentina promete de plazos, ajustado a cómo trabaja el taller.
--
-- Decía dos cosas que ya no son ciertas:
--
--   "si la pieza ya está fabricada, se despacha al día siguiente"
--       Nada está fabricado esperando comprador. TODAS las piezas del catálogo
--       se hacen por encargo, así que ese camino rápido no existe y ofrecerlo
--       era prometer un despacho imposible.
--
--   "si hay que fabricarla desde cero, son de 5 a 8 días"
--       Ese plazo es de las piezas A MEDIDA —las que se diseñan a partir de
--       una idea o una foto—, no del catálogo. El catálogo sale más rápido:
--       el taller se toma 2 a 3 días.
--
-- El plazo bueno, confirmado por el dueño el 22 de agosto de 2026 describiendo
-- la operación: el pedido llega, se despacha al segundo o tercer día, y en
-- Bogotá la transportadora entrega al siguiente. Total: 3 a 4 días en Bogotá.
-- Al resto del país el envío tarda 2 a 3 días en vez de uno, así que 4 a 6.
--
-- Y queda dicho por qué no se debe soltar "24 a 48 horas" sin más: ese es el
-- tramo de la transportadora en Bogotá DESPUÉS de despachar. Dicho suelto le
-- promete a la clienta la mitad del plazo real, que es como se llega tarde
-- habiendo cumplido.
--
-- Escrito como UPDATE sobre el tema y no como insert: la fila ya existe y esta
-- tabla se edita también desde Ajustes. Correrlo dos veces no hace nada nuevo.

UPDATE public.taller_conocimiento
   SET contenido = 'Enviamos a todo el país por Interrapidísimo. Se manda la guía para que el cliente le haga seguimiento. El envío tiene un costo adicional aproximado de 15.000 pesos. PLAZOS: nada está fabricado esperando comprador — TODAS las piezas del catálogo se hacen por encargo. Desde que se confirma el pedido, el taller se toma 2 a 3 días en tenerla lista y despacharla. Sumando el envío, la clienta la recibe en 3 a 4 días en Bogotá y en 4 a 6 días en el resto del país. NO prometas "24 a 48 horas" a secas: ese es el tiempo que tarda la transportadora en Bogotá DESPUÉS de despachar, no lo que la clienta espera desde que pide, y decirlo suelto es prometer la mitad del plazo real. PIEZAS A MEDIDA —las que se diseñan desde cero a partir de una idea o una foto— son de 5 a 8 días entre fabricación y entrega. Ese plazo es sólo para esas; el catálogo va más rápido.',
       actualizado_en = now()
 WHERE tema = 'Envíos';
