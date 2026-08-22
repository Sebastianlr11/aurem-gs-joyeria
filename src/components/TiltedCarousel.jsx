import React from 'react';
import Foto from './Foto'
import './TiltedCarousel.css';

const carouselImages = [
    'pen-pieza-1',
    'pen-pieza-2',
    'pen-pieza-3',
    'pen-pieza-4',
    'pen-pieza-5',
    // Duplicadas para que el bucle sea continuo
    'pen-pieza-1',
    'pen-pieza-2',
    'pen-pieza-3',
    'pen-pieza-4',
    'pen-pieza-5',
];

const TiltedCarousel = () => {
    return (
        <section className="tilted-carousel-section">
            <p className="carousel-label">Piezas seleccionadas</p>
            <div className="tilted-carousel-wrapper">
                <div className="tilted-carousel-track">
                    {carouselImages.map((src, index) => (
                        <div key={index} className="tilted-carousel-slide">
                            <Foto
                                nombre={src}
                                anchos={[640, 1280]}
                                tamanos="(max-width: 768px) 45vw, 22vw"
                                alt={`Pieza de Aurem Gs Joyería ${index + 1}`}
                                loading="lazy"
                                decoding="async"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default TiltedCarousel;
