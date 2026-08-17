import React from 'react';
import './TiltedCarousel.css';

const carouselImages = [
    '/assets/pen-pieza-1.jpg',
    '/assets/pen-pieza-2.jpg',
    '/assets/pen-pieza-3.jpg',
    '/assets/pen-pieza-4.jpg',
    '/assets/pen-pieza-5.jpg',
    // Duplicadas para que el bucle sea continuo
    '/assets/pen-pieza-1.jpg',
    '/assets/pen-pieza-2.jpg',
    '/assets/pen-pieza-3.jpg',
    '/assets/pen-pieza-4.jpg',
    '/assets/pen-pieza-5.jpg',
];

const TiltedCarousel = () => {
    return (
        <section className="tilted-carousel-section">
            <p className="carousel-label">Piezas seleccionadas</p>
            <div className="tilted-carousel-wrapper">
                <div className="tilted-carousel-track">
                    {carouselImages.map((src, index) => (
                        <div key={index} className="tilted-carousel-slide">
                            <img src={src} alt={`Jewelry showcase ${index + 1}`} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default TiltedCarousel;
