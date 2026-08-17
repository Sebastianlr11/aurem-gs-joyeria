import React from 'react';
import { waUrl } from '../lib/whatsapp';

const reviews = [
    {
        quote: 'La calidad del anillo superó todas mis expectativas. Un diseño impecable.',
        name: 'María González',
        role: 'Novia',
        initials: 'MG',
    },
    {
        quote: 'Recibí el collar en un embalaje precioso. Se nota la atención al detalle.',
        name: 'Carlos Ruiz',
        role: 'Cliente',
        initials: 'CR',
    },
    {
        quote: 'La certificación de autenticidad me dio total confianza.',
        name: 'Ana Martínez',
        role: 'Coleccionista',
        initials: 'AM',
    },
    {
        quote: 'Las pulseras son incluso más bonitas en persona. Envío rapidísimo.',
        name: 'Laura Sánchez',
        role: 'Clienta frecuente',
        initials: 'LS',
    },
];

const StarIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const Reviews = () => {
    return (
        <section id="resenas" className="reviews-section">
            <div className="container">

                <div className="reviews-header">
                    <p className="eyebrow">Reseñas</p>
                    <h2 className="reviews-title">Lo que <em>dicen.</em></h2>
                </div>

                <div className="reviews-grid">

                    <div className="reviews-score-card">
                        <div className="score-inner">
                            <p className="score-number">4.9/5</p>
                            <div className="score-stars" aria-label="4.9 de 5 estrellas">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <span key={i} className="score-star"><StarIcon /></span>
                                ))}
                            </div>
                            <p className="score-trust">Más de 500 piezas entregadas</p>
                            <p className="score-tagline">Confiado por +100 clientas en toda Colombia</p>
                            <a
                                href={waUrl({
                                    mobile: 'Hola! 🌟 Quiero compartir mi experiencia con *Aurem Gs Joyería*. Estoy muy feliz con mi compra ✨',
                                    desktop: 'Hola! Quiero compartir mi experiencia con *Aurem Gs Joyería*. Estoy muy feliz con mi compra.'
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="score-cta"
                            >
                                Dejar una reseña
                            </a>
                        </div>
                    </div>

                    <div className="reviews-cards-grid">
                        {reviews.map((review, index) => (
                            <figure key={index} className="review-card">
                                <blockquote className="review-quote">«{review.quote}»</blockquote>
                                <figcaption className="review-author">
                                    <div className="review-avatar">{review.initials}</div>
                                    <div>
                                        <p className="review-name">{review.name}</p>
                                        <p className="review-role">{review.role}</p>
                                    </div>
                                </figcaption>
                            </figure>
                        ))}
                    </div>

                </div>
            </div>
        </section>
    );
};

export default Reviews;
