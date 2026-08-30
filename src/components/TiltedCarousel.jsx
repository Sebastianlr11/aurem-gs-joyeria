import React, { useMemo } from 'react';
import { fotoProducto } from '../lib/fotoProducto';
import { piezasDelCarrusel } from '../lib/portada';
import { usePiezasPublicadas } from '../lib/piezasPublicadas';
import './TiltedCarousel.css';

/* Cuántas piezas distintas van en la cinta. Seis a 240px con 1,5rem de hueco
   son ~1.585px, y duplicadas pasan de tres mil: más de dos pantallas anchas,
   que es lo que hace falta para que el bucle no se note. */
const CUANTAS = 6;

const TiltedCarousel = () => {
    const piezas = usePiezasPublicadas();

    /* Duplicada, porque la animación del CSS va a `-50%`: las dos mitades
       tienen que ser iguales o la cinta pega un salto al reiniciar. */
    const cinta = useMemo(() => {
        const elegidas = piezasDelCarrusel(piezas, CUANTAS);
        return [...elegidas, ...elegidas];
    }, [piezas]);

    /* Sin piezas no hay cinta: antes eran cinco fotos de banco en
       `public/assets` y la sección estaba siempre, dijera lo que dijera el
       catálogo. Si la consulta falla, la portada se salta la sección entera en
       vez de enseñar piezas que no son de la casa. */
    if (!cinta.length) return null;

    return (
        <section className="tilted-carousel-section">
            <p className="carousel-label">Piezas seleccionadas</p>
            <div className="tilted-carousel-wrapper">
                <div className="tilted-carousel-track">
                    {cinta.map((pieza, index) => (
                        <div key={`${pieza.id}-${index}`} className="tilted-carousel-slide">
                            <img
                                {...fotoProducto(pieza.image_url)}
                                sizes="(max-width: 768px) 176px, 240px"
                                alt={pieza.name}
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
