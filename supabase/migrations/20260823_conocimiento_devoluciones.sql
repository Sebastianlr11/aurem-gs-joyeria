-- Valentina no tenía nada que decir sobre devoluciones.
--
-- Al decidir el plazo de devolución (5 días hábiles, 23 de agosto de 2026) se
-- corrigieron el FAQ y la política del sitio. Pero Valentina no lee esos
-- archivos: lee `taller_conocimiento`, y ahí el tema no existía. La regla 1
-- del prompt le prohíbe inventar plazos, así que escalaba en vez de mentir
-- —bien— pero una pregunta tan común no debería llegar a una persona.
--
-- Y la garantía decía la mitad: sólo la de por vida en los metales. El sitio
-- promete dos, y la de 30 días contra defectos de fabricación faltaba. Un bot
-- que promete de menos también desinforma.
--
-- Se escribe como migración y no sólo en la base porque esta tabla SÍ está
-- versionada, y el seed original quedaría mintiendo. Ver pendientes #4 y #12.

insert into public.taller_conocimiento (tema, contenido, orden, activo)
values (
  'Devoluciones y retracto',
  'DERECHO DE RETRACTO: la clienta tiene 5 DÍAS HÁBILES desde que recibe la pieza para devolverla sin dar ninguna razón, con la pieza sin usar y en su empaque original. Es la Ley 1480 y es el plazo real: NO digas 30 días, ese es otro asunto (la garantía, que es otro tema). En el retracto el envío de vuelta lo paga la clienta — dilo sin rodeos pero sin sonar a letra chica, y sólo si pregunta o si va a devolver. COSA DISTINTA es que la pieza haya llegado defectuosa, dañada o que no sea la que pidió: eso lo cubrimos nosotros, envío de vuelta incluido, y ahí no hay plazo de 5 días que valga. Antes de dar por buena una devolución PIDE FOTOS y escala a una persona: tú no apruebas devoluciones ni prometes reembolsos, ni dices en cuántos días llega la plata. Si la clienta está molesta o el caso no encaja limpio en lo de arriba —una pieza grabada con un nombre, una hecha a medida, algo que ya se usó— NO improvises la respuesta: escala. El detalle completo está en la política de devoluciones del sitio, en auremgsjoyeria.com/politica-de-devoluciones, y puedes mandar ese enlace.',
  45,
  true
)
on conflict (tema) do update
  set contenido = excluded.contenido,
      orden = excluded.orden,
      activo = excluded.activo,
      actualizado_en = now();

-- La garantía, completa: son dos y no hay que mezclarlas.
update public.taller_conocimiento
set contenido = 'SON DOS GARANTÍAS, no una, y conviene no mezclarlas. DE POR VIDA EN LOS METALES (oro, plata y platino): que una pieza marcada como plata 925 sea plata 925 y un oro 18k sea oro 18k. Ahí entran también el ajuste de talla si el dedo cambia y el pulido o mantenimiento de la pieza, sin costo, siempre. APARTE, 30 DÍAS contra defectos de fabricación: engastes, soldaduras y acabados — el trabajo del taller. Si dentro de ese mes la pieza sale defectuosa, se repara o se reemplaza sin cobrar. NO digas que la garantía de por vida cubre los defectos de fabricación: son cosas distintas y así está escrito en el sitio. Las PIEDRAS no entran en ninguna de las dos: si preguntan por una piedra que se soltó, se rayó o se perdió, no prometas nada y escala a una persona. Y no confundas nada de esto con las devoluciones, que son otro tema y otro plazo.',
    actualizado_en = now()
where tema = 'Garantía';
