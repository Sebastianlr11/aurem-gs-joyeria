import React, { useState } from 'react';
import { motion } from 'framer-motion';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
};

const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } }
};

const faqs = [
    {
        question: '¿Qué materiales utilizan en sus joyas?',
        answer: 'Oro 18k, plata 925, platino y piedras certificadas. Todos con certificación de origen.',
    },
    {
        question: '¿Cuánto tarda la entrega?',
        answer: 'Despachamos al día siguiente. En Bogotá llega en 24 horas; al resto del país, de 2 a 3 días, siempre con seguimiento. Las piezas que hacemos desde cero tardan de 5 a 8 días entre fabricación y entrega.',
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
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section id="faqs" className="faq-section">
            <div className="container">
                <div className="faq-layout">

                    {/* Left — sticky title */}
                    <motion.div
                        className="faq-left"
                        variants={fadeUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-80px' }}
                    >
                        <p className="eyebrow">FAQs</p>
                        <h2 className="faq-title">Preguntas <em>frecuentes.</em></h2>
                        <p className="faq-subtitle">
                            Todo lo que necesitas saber antes de elegir tu pieza.
                        </p>
                    </motion.div>

                    {/* Right — accordion */}
                    <motion.div
                        className="faq-right"
                        variants={stagger}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-80px' }}
                    >
                        {faqs.map((faq, index) => (
                            <FaqItem
                                key={index}
                                question={faq.question}
                                answer={faq.answer}
                                isOpen={openIndex === index}
                                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                            />
                        ))}
                    </motion.div>

                </div>
            </div>
        </section>
    );
};

export default Faq;
