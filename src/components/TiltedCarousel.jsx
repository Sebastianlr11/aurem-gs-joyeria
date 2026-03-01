import React from 'react';
import './TiltedCarousel.css';

const carouselImages = [
    '/assets/hero1.png',
    '/assets/hero2.png',
    '/assets/hero3.png',
    '/assets/rings.png',
    '/assets/necklaces.png',
    '/assets/bracelets.png',
    // Duplicate for seamless infinite loop
    '/assets/hero1.png',
    '/assets/hero2.png',
    '/assets/hero3.png',
    '/assets/rings.png',
    '/assets/necklaces.png',
    '/assets/bracelets.png',
];

const TiltedCarousel = () => {
    return (
        <section className="tilted-carousel-section">
            <div className="carousel-bg-band"></div>
            <p className="carousel-label"><span>✦</span> PIEZAS SELECCIONADAS <span>✦</span></p>
            <div className="tilted-carousel-wrapper">
                <div className="tilted-carousel-track">
                    {carouselImages.map((src, index) => (
                        <div key={index} className="tilted-carousel-slide">
                            <img src={src} alt={`Jewelry showcase ${index + 1}`} />
                        </div>
                    ))}
                </div>
            </div>
            {/* Edge to Edge Horizontal Divider */}
            <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }}></div>
        </section>
    );
};

export default TiltedCarousel;
