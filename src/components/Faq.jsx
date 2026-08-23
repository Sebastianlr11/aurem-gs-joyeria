import React, { useState } from 'react';
import { useAparecer, useAparecerGrupo } from '../lib/aparecer';



const faqs = [
    {
        question: '¿Qué materiales utilizan en sus joyas?',
        answer: 'Oro 18k, plata 925, platino y piedras certificadas. Todos con certificación de origen.',
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
        answer: 'Cubre el metal de por vida contra defectos de fabricación: ajustes de talla y pulido, sin costo. Las piedras no entran en esa garantía; si se suelta o se daña una, escríbenos y lo revisamos caso por caso.',
    },
    {
        question: '¿Puedo devolver o cambiar una pieza?',
        answer: 'Tienes 30 días desde la recepción, con la pieza en su estado y embalaje original.',
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

const FaqItem = ({ question, answer, isOpen, onToggle }) => (
    <div className={`faq-item ${isOpen ? 'faq-item--open' : ''}`} onClick={onToggle}>
        <div className="faq-header">
            <h3 className="faq-question">{question}</h3>
            <div className={`faq-icon ${isOpen ? 'faq-icon--open' : ''}`}>
                {isOpen
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                }
            </div>
        </div>
        <div className="faq-body">
            <div className="faq-body-inner">
                <div className="faq-divider"></div>
                <p className="faq-answer">{answer}</p>
            </div>
        </div>
    </div>
);

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
