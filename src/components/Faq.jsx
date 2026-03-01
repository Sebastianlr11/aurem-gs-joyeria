import React, { useState } from 'react';

const faqs = [
    {
        question: '¿Cómo puedo personalizar una pieza?',
        answer: 'Contáctanos con tu idea y nuestros artesanos te guiarán en el proceso. Podemos adaptar materiales, tamaños, grabados y diseños exclusivos. Cada pieza personalizada incluye renders previos para tu aprobación antes de la producción.',
    },
    {
        question: '¿Qué materiales utilizan en sus joyas?',
        answer: 'Trabajamos exclusivamente con oro 18k, plata 925, platino y piedras preciosas certificadas — diamantes, zafiros, esmeraldas y rubíes. Todos los materiales cuentan con certificación de origen y son verificados por nuestros gemólogos.',
    },
    {
        question: '¿Cuánto tiempo tarda la entrega?',
        answer: 'Las piezas del catálogo se envían en 24–48 horas hábiles con seguimiento en tiempo real. Las piezas personalizadas tienen un plazo de 2 a 4 semanas según la complejidad. Ofrecemos envío express disponible para fechas especiales.',
    },
    {
        question: '¿Cómo funciona la garantía de por vida?',
        answer: 'Nuestra garantía cubre cualquier defecto de fabricación sin costo adicional. Esto incluye ajustes de talla, reparación de engastes y pulido de la pieza. Solo debes enviarnos la joya con el certificado de garantía adjunto.',
    },
    {
        question: '¿Puedo devolver o cambiar una pieza?',
        answer: 'Aceptamos devoluciones dentro de los 30 días posteriores a la recepción, siempre que la pieza esté en su estado original y con el embalaje de lujo. Las piezas personalizadas no son elegibles para devolución, pero sí para ajustes sin costo.',
    },
    {
        question: '¿Ofrecen grabados personalizados?',
        answer: 'Sí, ofrecemos grabado láser de alta precisión en la mayoría de nuestras piezas — texto, fechas, coordenadas o símbolos. El grabado está incluido sin costo adicional en todos los pedidos. El proceso agrega 2–3 días hábiles al tiempo de entrega.',
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
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section id="faqs" className="section-with-borders faq-section">
            <div className="container">
                <div className="faq-layout">

                    {/* Left — sticky title */}
                    <div className="faq-left">
                        <div className="luxury-badge">
                            <span>//</span> FAQs <span>//</span>
                        </div>
                        <h2 className="faq-title">Preguntas<br />Frecuentes.</h2>
                        <p className="faq-subtitle">
                            Todo lo que necesitas saber antes de elegir tu pieza perfecta.
                        </p>
                    </div>

                    {/* Right — accordion */}
                    <div className="faq-right">
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
            <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }}></div>
        </section>
    );
};

export default Faq;
