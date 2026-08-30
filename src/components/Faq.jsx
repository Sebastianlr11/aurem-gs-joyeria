import React, { useState } from 'react';
import { useAparecer, useAparecerGrupo } from '../lib/aparecer';
import { PREGUNTAS, faqJsonLd } from '../lib/preguntas';

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
            {/* Las mismas seis preguntas, en el formato que leen Google y los
                asistentes. Va acá dentro y no en `Home.jsx` para que no pueda
                quedarse publicando una lista que el acordeón ya no enseña. */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }} />
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
                        {PREGUNTAS.map((faq, index) => (
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
