/**
 * Las preguntas frecuentes de la portada, y su versión para las máquinas.
 *
 * Viven acá y no dentro de `Faq.jsx` por dos motivos. El primero es que el
 * acordeón ahora las publica también como `FAQPage` de schema.org, que es lo
 * que hace que un asistente o el propio Google respondan «¿cuánto tarda un
 * anillo de Aurem Gs?» citando a la tienda en vez de a un foro. El segundo es
 * la regla de `react-refresh`: un archivo de componentes no puede exportar
 * otra cosa, y para que el dato tenga una sola fuente hay que exportarlo.
 *
 * **Lo que se publica es exactamente lo que se ve.** Marcar una respuesta que
 * la página no enseña —o enseñarla recortada— es lo que Google llama
 * contenido oculto, y cuesta la ficha enriquecida entera. Por eso el JSON-LD
 * se arma de esta misma lista y no de un texto aparte.
 */

export const PREGUNTAS = [
    {
        question: '¿Qué materiales utilizan en sus joyas?',
        /* Decía "Todos con certificación de origen", y no van todos: el
           certificado lo emite un laboratorio gemológico, es opcional y cuesta
           $50.000 aparte. Así lo dice ya WhyUs.jsx y así se lo dice Valentina a
           la clienta; esta respuesta se había quedado atrás y prometía incluido
           lo que se cobra.

           El platino se queda, pero dicho como lo que es: un metal que el
           taller trabaja por encargo, no algo que haya publicado. */
        answer: 'Oro 18k, oro blanco 18k y plata 925, con esmeralda colombiana natural. También trabajamos platino por encargo. El certificado del laboratorio gemológico —procedencia de la piedra, material y ley del metal— es opcional y cuesta $50.000.',
    },
    {
        question: '¿Cuánto tarda la entrega?',
        /* Decía "despachamos al día siguiente", y no es así: nada está
           fabricado esperando comprador, cada pieza se hace por encargo y el
           taller se toma dos o tres días. Sumar el envío da 3 a 4 días en
           Bogotá — que es lo que la clienta de verdad espera desde que pide,
           y lo que hay que decirle. */
        answer: 'Cada pieza se hace por encargo: el taller se toma 2 a 3 días en tenerla lista. Con el envío, en Bogotá la recibes en 3 a 4 días y en el resto del país en 4 a 6, siempre con número de guía. Una pieza diseñada desde cero, a partir de tu idea o una foto, toma de 5 a 8 días.',
    },
    {
        question: '¿Cómo funciona la garantía de por vida?',
        /* Decía que la garantía de por vida cubría los defectos de
           fabricación, y eso choca de frente con los 30 días que prometen los
           Términos y la política. Son dos garantías distintas y así están
           escritas allá: de por vida responde por LA LEY DEL METAL —que una
           plata 925 sea plata 925—, y los 30 días por el trabajo del taller.
           Aquí se decía en una sola frase y quedaba pareciendo la misma. */
        answer: 'Son dos. De por vida respondemos por el metal: que una pieza marcada como plata 925 sea plata 925 y un oro 18k sea oro 18k, y los ajustes de talla y el pulido van sin costo siempre. Aparte, 30 días contra defectos de fabricación —engastes, soldaduras y acabados—. Las piedras no entran en ninguna de las dos; si se suelta o se daña una, escríbenos y lo revisamos caso por caso.',
    },
    {
        question: '¿Puedo devolver o cambiar una pieza?',
        /* Decía "30 días" y la política de devoluciones decía 5 días hábiles.
           Dos pantallas del mismo sitio prometiendo plazos distintos, y por
           escrito obliga el más generoso: el sitio se estaba comprometiendo a
           30 días sin quererlo. Aquí se confundían el retracto (Ley 1480, 5
           días hábiles) con la garantía (30 días, y sólo si la pieza salió
           defectuosa). El plazo real, decidido el 23 de agosto de 2026, es el
           legal. */
        answer: 'Tienes 5 días hábiles desde que la recibes para retractarte sin darnos ninguna razón, con la pieza sin usar y en su empaque original —es tu derecho de retracto—. El envío de retorno en ese caso corre por tu cuenta. Cosa distinta es que la pieza llegue defectuosa o no sea la que pediste: eso lo cubrimos nosotros, envío incluido.',
    },
    {
        question: '¿Ofrecen grabados personalizados?',
        answer: 'En argollas y anillos va incluido sin costo. En otras piezas, escríbenos y te confirmamos. Suma 2 a 3 días hábiles al tiempo de entrega.',
    },
    {
        question: '¿Cómo puedo personalizar una pieza?',
        answer: 'Escríbenos tu idea y recibirás renders para aprobar antes de producir.',
    },
];

const RAIZ = 'https://www.auremgsjoyeria.com'

/** El `FAQPage` de schema.org, armado de la lista de arriba. */
export function faqJsonLd(preguntas = PREGUNTAS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${RAIZ}/#faqs`,
    mainEntity: preguntas.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: { '@type': 'Answer', text: p.answer },
    })),
  }
}
