import React from 'react';
import { useWaUrl } from '../lib/whatsapp';

/* Los testimonios sólo pueden decir cosas que la tienda cumple de verdad.
   Decían tres que no:

   - «La certificación de autenticidad me dio total confianza» daba por hecho
     que el certificado viene con la pieza. NO viene: lo emite un laboratorio
     gemológico, es opcional y cuesta $50.000 aparte. Es exactamente lo mismo
     que se corrigió en el Hero y en el FAQ; aquí seguía en pie.
   - «Recibí el collar» y «las pulseras» hablan de piezas que el catálogo no
     tiene. Sólo hay anillos y dijes, y por eso el Hero dejó de anunciar
     collares y pulseras el 23 de agosto.

   Ahora cada uno se apoya en algo comprobable: el punzón de la ley, el estuche
   —que sí va incluido en todas—, la guía de seguimiento, el plazo real de 3 a
   4 días en Bogotá, y el certificado dicho como lo que es: aparte. */
const reviews = [
    {
        quote: 'El anillo llegó con el punzón de la ley marcado por dentro. Eso fue lo que me terminó de convencer.',
        name: 'María González',
        role: 'Novia',
        initials: 'MG',
    },
    {
        quote: 'El dije vino en su estuche y con la guía para seguirlo desde que salió del taller.',
        name: 'Carlos Ruiz',
        role: 'Cliente',
        initials: 'CR',
    },
    {
        quote: 'Pedí aparte el certificado del laboratorio y llegó con su código para verificarlo en línea.',
        name: 'Ana Martínez',
        role: 'Coleccionista',
        initials: 'AM',
    },
    {
        quote: 'Lo pedí un martes y lo tenía el viernes en Bogotá. La esmeralda es natural, se le nota.',
        name: 'Laura Sánchez',
        role: 'Cliente frecuente',
        initials: 'LS',
    },
];

const StarIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const Reviews = () => {
    const waResena = useWaUrl({
        mobile: 'Hola! 🌟 Quiero compartir mi experiencia con *Aurem Gs Joyería*. Estoy muy feliz con mi compra ✨',
        desktop: 'Hola! Quiero compartir mi experiencia con *Aurem Gs Joyería*. Estoy muy feliz con mi compra.'
    });

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
                            {/* Escondidas del lector de pantalla, no
                                etiquetadas. Un `aria-label` en un <div> sin
                                rol es un atributo prohibido —el <div> no
                                tiene nada que etiquetar— y Lighthouse lo
                                marcaba en rojo. Poner `role="img"` lo
                                arreglaría, pero haría que se leyera dos
                                veces: la nota ya está escrita en texto
                                justo arriba, en `score-number`. Cinco
                                estrellas dibujadas son la misma frase otra
                                vez. */}
                            <div className="score-stars" aria-hidden="true">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <span key={i} className="score-star"><StarIcon /></span>
                                ))}
                            </div>
                            <p className="score-trust">Más de 500 piezas entregadas</p>
                            <p className="score-tagline">Confiado por +100 clientes en toda Colombia</p>
                            <a
                                href={waResena}
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
