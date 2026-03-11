import React from 'react';
import { waUrl } from '../lib/whatsapp';

const reviews = [
    {
        rating: '4.9',
        quote: 'La calidad del anillo superó todas mis expectativas. Un diseño impecable que enamora desde el primer vistazo.',
        name: 'María González',
        role: 'NOVIA',
        initials: 'MG',
    },
    {
        rating: '5.0',
        quote: 'Recibí el collar en un embalaje de lujo precioso. Se nota la atención al detalle en cada aspecto del producto.',
        name: 'Carlos Ruiz',
        role: 'CLIENTE',
        initials: 'CR',
    },
    {
        rating: '4.9',
        quote: 'La certificación de autenticidad me dio total confianza. Sin duda la mejor joyería que he comprado online.',
        name: 'Ana Martínez',
        role: 'COLECCIONISTA',
        initials: 'AM',
    },
    {
        rating: '5.0',
        quote: 'Las pulseras son exactamente como en las fotos, incluso más bonitas en persona. Envío rapidísimo y seguro.',
        name: 'Laura Sánchez',
        role: 'CLIENTE FRECUENTE',
        initials: 'LS',
    },
];

const StarIcon = ({ filled = true, size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const Reviews = () => {
    return (
        <section id="resenas" className="section-with-borders reviews-section">
            <div className="container">

                {/* Header */}
                <div className="reviews-header">
                    <div>
                        <div className="luxury-badge">
                            <span>//</span> Reseñas <span>//</span>
                        </div>
                        <h2 className="reviews-title">Lo Que<br />Dicen.</h2>
                    </div>
                    <p className="reviews-subtitle">
                        Cada pieza entregada es una historia — esto es lo que nuestros clientes nos comparten.
                    </p>
                </div>

                {/* Main grid */}
                <div className="reviews-grid">

                    {/* Left dark card */}
                    <div className="reviews-score-card">
                        <div className="score-top">
                            <div className="score-number">4.9<span>/5</span></div>
                            <p className="score-description">
                                Más de <strong>500 piezas</strong> entregadas con satisfacción garantizada.
                            </p>
                        </div>

                        <div className="score-bottom">
                            <div className="score-avatars">
                                {['MG', 'CR', 'AM', 'LS'].map((initials, i) => (
                                    <div key={i} className="score-avatar avatar-initials" style={{ zIndex: 4 - i }}>
                                        {initials}
                                    </div>
                                ))}
                            </div>
                            <div className="score-stars">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <span key={i} className="score-star"><StarIcon size={16} /></span>
                                ))}
                            </div>
                            <p className="score-trust">Confiado por +100 clientes</p>
                            <p className="score-tagline">ELLOS ELIGIERON CALIDAD — TÚ TAMBIÉN PUEDES.</p>

                            <a
                                href={waUrl('Hola! Quiero compartir mi experiencia con Aurem Gs Joyería. Estoy muy feliz con mi compra! 🌟✨')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="score-cta"
                            >
                                Dejar una Reseña
                            </a>
                        </div>
                    </div>

                    {/* Right review cards 2x2 */}
                    <div className="reviews-cards-grid">
                        {reviews.map((review, index) => (
                            <div key={index} className={`review-card animate-fade-in delay-${(index % 2) + 1}`}>
                                <div className="review-rating-badge">
                                    <span className="review-rating-num">{review.rating}</span>
                                    <span className="review-star"><StarIcon size={11} /></span>
                                    <span className="review-rating-label">RATING</span>
                                </div>

                                <p className="review-quote">"{review.quote}"</p>

                                <div className="review-author">
                                    <div className="review-avatar avatar-initials">
                                        {review.initials}
                                    </div>
                                    <div>
                                        <p className="review-name">{review.name}</p>
                                        <p className="review-role">{review.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
            <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }}></div>
        </section>
    );
};

export default Reviews;
