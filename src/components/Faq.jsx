import React, { useState } from 'react';
import { useAparecer, useAparecerGrupo } from '../lib/aparecer';



const faqs = [
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

/**
 * Una pregunta del acordeón.
 *
 * El `onToggle` estaba en el `<div>` de fuera: se abría con el ratón y con
 * nada más. Sin foco de teclado, sin `aria-expanded`, y un lector de pantalla
 * leía seis titulares sueltos sin manera de saber que se despliegan ni cuál
 * está abierto. Contrasta con el resto del sitio, que sí tiene ese cuidado
 * —`Catalog.jsx` implementa un focus trap entero a mano—.
 *
 * La anidación es `h3 > button` y no al revés: el contenido de un `<button>`
 * sólo admite texto y elementos de línea, así que un `<h3>` dentro es marcado
 * inválido. Así el titular sigue siendo titular para quien navega por
 * encabezados, y lo que se pulsa es un botón de verdad.
 */
const FaqItem = ({ question, answer, isOpen, onToggle, id }) => {
    const idBoton = `faq-b-${id}`;
    const idPanel = `faq-p-${id}`;

    return (
        <div className={`faq-item ${isOpen ? 'faq-item--open' : ''}`}>
            <h3 className="faq-question-h">
                <button
                    type="button"
                    id={idBoton}
                    className="faq-header"
                    aria-expanded={isOpen}
                    aria-controls={idPanel}
                    onClick={onToggle}
                >
                    <span className="faq-question">{question}</span>
                    <span className={`faq-icon ${isOpen ? 'faq-icon--open' : ''}`}>
                        {isOpen
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        }
                    </span>
                </button>
            </h3>
            {/* Cerrado sigue en el DOM para que la transición de altura tenga
                de dónde animar, así que hay que decirle al lector de pantalla
                que no está: si no, lee las seis respuestas de corrido. */}
            <div
                className="faq-body"
                id={idPanel}
                role="region"
                aria-labelledby={idBoton}
                aria-hidden={!isOpen}
            >
                <div className="faq-body-inner">
                    <div className="faq-divider"></div>
                    <p className="faq-answer">{answer}</p>
                </div>
            </div>
        </div>
    );
};

const Faq = () => {
    const cabecera = useAparecer();
    const rejilla = useAparecerGrupo(0.1);

    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section id="faqs" className="faq-section">
            <div className="container">
                <div className="faq-layout">

                    {/* Left — sticky title */}
                    <div className="faq-left" ref={cabecera}>
                        <p className="eyebrow">FAQs</p>
                        <h2 className="faq-title">Preguntas <em>frecuentes.</em></h2>
                        <p className="faq-subtitle">
                            Todo lo que necesitas saber antes de elegir tu pieza.
                        </p>
                    </div>

                    {/* Right — accordion */}
                    <div className="faq-right" ref={rejilla}>
                        {faqs.map((faq, index) => (
                            <FaqItem
                                key={index}
                                id={index}
                                question={faq.question}
                                answer={faq.answer}
                                isOpen={openIndex === index}
                                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                            />
                        ))}
                    </div>

                </div>
            </div>
        </section>
    );
};

export default Faq;
