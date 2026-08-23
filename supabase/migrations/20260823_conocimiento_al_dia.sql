-- El seed de Valentina decía "SIN CONFIRMAR" y la producción no.
--
-- `20260818_taller_conocimiento.sql` sembró los seis temas con esa marca, que
-- era honesta el día que se escribió: los datos del negocio venían del diseño
-- importado y nadie los había verificado con el joyero. Se verificaron el 20 de
-- agosto de 2026 y la base se corrigió a mano, pero **el seed se quedó atrás**.
--
-- Por qué importa aunque la producción esté bien: un entorno nuevo nace desde
-- las migraciones, no desde la base. Levantarlo hoy daría una Valentina que le
-- dice a la clienta que no tiene confirmado si el estuche va incluido — cuando
-- sí va, y hace meses.
--
-- Esta migración deja el conocimiento EXACTAMENTE como está en producción hoy,
-- volcado desde la base y no transcrito a mano. Incluye los dos temas del 23 de
-- agosto (devoluciones y la garantía completa), así que reemplaza también a
-- `20260823_conocimiento_devoluciones.sql` — que se queda porque ya está
-- aplicada y las migraciones no se reescriben.
--
-- Es idempotente: se puede correr sobre la base que ya existe sin romper nada.

insert into public.taller_conocimiento (tema, contenido, orden, activo)
values
  ('Envíos',
   'Enviamos a todo el país por Interrapidísimo. Se manda la guía para que el cliente le haga seguimiento. El envío tiene un costo adicional aproximado de 15.000 pesos. PLAZOS: nada está fabricado esperando comprador — TODAS las piezas del catálogo se hacen por encargo. Desde que se confirma el pedido, el taller se toma 2 a 3 días en tenerla lista y despacharla. Sumando el envío, la clienta la recibe en 3 a 4 días en Bogotá y en 4 a 6 días en el resto del país. NO prometas "24 a 48 horas" a secas: ese es el tiempo que tarda la transportadora en Bogotá DESPUÉS de despachar, no lo que la clienta espera desde que pide, y decirlo suelto es prometer la mitad del plazo real. PIEZAS A MEDIDA —las que se diseñan desde cero a partir de una idea o una foto— son de 5 a 8 días entre fabricación y entrega. Ese plazo es sólo para esas; el catálogo va más rápido.',
   10, true),
  ('Medios de pago',
   'Aceptamos Nequi, Mercado Pago y pago contra entrega. EL CONTRA ENTREGA ES SÓLO PARA BOGOTÁ: al resto del país se le cobra por anticipado, por Nequi o Mercado Pago. Pregunta la ciudad antes de ofrecerlo, y si no es Bogotá no lo menciones siquiera. EL CONTRA ENTREGA PIDE UN ABONO: para confirmar el pedido el cliente abona el valor del envío por Mercado Pago, y ese abono SE DESCUENTA del total — al recibir paga el saldo en efectivo. No es un cobro extra: paga lo mismo, partido en dos. POR QUÉ SE COBRA, si pregunta: cuéntalo de frente y con cercanía, no con una frase de reglamento. Antes no se cobraba. Pasaba que la pieza llegaba hasta la puerta y la persona ya no estaba, o había cambiado de opinión, y el domiciliario la devolvía — pero el envío ya estaba pagado, ida y vuelta, y esa pérdida la asumía el taller. Con el abono eso deja de pasar. Dilo sin reprochar y sin sonar a advertencia, y cierra SIEMPRE con lo mismo: no es plata de más, se descuenta del total, así que termina pagando exactamente el precio de la pieza. Si además duda porque es su primera compra en línea, eso también se responde: el abono es lo único que arriesga hasta tener la pieza en la mano. El monto exacto del abono lo tienes en las reglas de arriba y puedes decirlo cuando te pregunten; el saldo final y el enlace salen de crear_pedido. Si eligen Mercado Pago para el total, el enlace también sale de esa herramienta.',
   20, true),
  ('Piezas a medida: cómo se trabaja',
   'Fabricamos cualquier diseño a medida, incluso a partir de una foto. Se hace primero el diseño y se aprueba antes de fabricar; se empieza con un abono del 50% y el resto se paga al terminar, y ahí se despacha. Se envían fotos de cada proceso. TÚ SÍ puedes dar el precio en oro con cotizar_oro, pero CERRAR el pedido a medida —tomar el abono y arrancar la fabricación— lo hace una persona: cuando lleguen a ese punto, escala.',
   30, true),
  ('Qué va incluido en el precio',
   'Va incluido el estuche: TODAS las piezas —anillos, pulseras, aretes, dijes— se entregan en su cajita. En argollas y anillos va incluida la marcada (grabar un nombre, una fecha o una frase); en otras piezas eso hay que confirmarlo, así que escala. En aretes van incluidas las mariposas. EL CERTIFICADO DE AUTENTICIDAD NO VA INCLUIDO: tiene un costo adicional de 50.000 pesos. Dilo con naturalidad si preguntan, como una opción disponible y no como un cobro sorpresa. Lo emite un laboratorio gemológico y dice: la procedencia de la piedra y si es natural o sintética, el material y la ley del metal (por ejemplo oro 18k, o plata 950 o 925), y las medidas de la piedra. Lleva un código verificable en la página del laboratorio. Nunca digas que va incluido.',
   40, true),
  ('Devoluciones y retracto',
   'DERECHO DE RETRACTO: la clienta tiene 5 DÍAS HÁBILES desde que recibe la pieza para devolverla sin dar ninguna razón, con la pieza sin usar y en su empaque original. Es la Ley 1480 y es el plazo real: NO digas 30 días, ese es otro asunto (la garantía, que es otro tema). En el retracto el envío de vuelta lo paga la clienta — dilo sin rodeos pero sin sonar a letra chica, y sólo si pregunta o si va a devolver. COSA DISTINTA es que la pieza haya llegado defectuosa, dañada o que no sea la que pidió: eso lo cubrimos nosotros, envío de vuelta incluido, y ahí no hay plazo de 5 días que valga. Antes de dar por buena una devolución PIDE FOTOS y escala a una persona: tú no apruebas devoluciones ni prometes reembolsos, ni dices en cuántos días llega la plata. Si la clienta está molesta o el caso no encaja limpio en lo de arriba —una pieza grabada con un nombre, una hecha a medida, algo que ya se usó— NO improvises la respuesta: escala. El detalle completo está en la política de devoluciones del sitio, en auremgsjoyeria.com/politica-de-devoluciones, y puedes mandar ese enlace.',
   45, true),
  ('Garantía',
   'SON DOS GARANTÍAS, no una, y conviene no mezclarlas. DE POR VIDA EN LOS METALES (oro, plata y platino): que una pieza marcada como plata 925 sea plata 925 y un oro 18k sea oro 18k. Ahí entran también el ajuste de talla si el dedo cambia y el pulido o mantenimiento de la pieza, sin costo, siempre. APARTE, 30 DÍAS contra defectos de fabricación: engastes, soldaduras y acabados — el trabajo del taller. Si dentro de ese mes la pieza sale defectuosa, se repara o se reemplaza sin cobrar. NO digas que la garantía de por vida cubre los defectos de fabricación: son cosas distintas y así está escrito en el sitio. Las PIEDRAS no entran en ninguna de las dos: si preguntan por una piedra que se soltó, se rayó o se perdió, no prometas nada y escala a una persona. Y no confundas nada de esto con las devoluciones, que son otro tema y otro plazo.',
   50, true),
  ('Piedras',
   'Además de fabricar, la joyería comercia esmeraldas. Por ahora NO ofrezcas piedras sueltas ni cotices piedras: si preguntan por una esmeralda suelta, por una piedra que ya tienen, o por cuánto suma una piedra a una pieza, escala a una persona.',
   60, true)
on conflict (tema) do update
  set contenido = excluded.contenido,
      orden = excluded.orden,
      activo = excluded.activo,
      actualizado_en = now();
