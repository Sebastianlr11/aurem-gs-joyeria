import React from 'react';
import { useAparecer, useAparecerGrupo } from '../lib/aparecer';
import { Link } from 'react-router-dom';



const collectionsData = [
    {
        id: 1,
        title: 'Anillos',
        category: 'Anillos',
        description: 'Diamantes finos y engastes perfectos diseñados para durar toda una vida.',
        metal: 'Oro 18k',
        image: '/assets/pen-anillos.jpg',
        cta: 'Ver anillos',
    },
    {
        id: 2,
        title: 'Collares',
        category: 'Collares',
        description: 'Cadenas finas y dijes únicos que elevan cualquier look al instante.',
        metal: 'Platino',
        image: '/assets/pen-collares.jpg',
        cta: 'Ver collares',
    },
    {
        id: 3,
        title: 'Pulseras',
        category: 'Pulseras',
        description: 'Eslabones que capturan la luz con cada movimiento de tu muñeca.',
        metal: 'Oro rosa',
        image: '/assets/pen-pulseras.jpg',
        cta: 'Ver pulseras',
    }
];

const Arrow = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="13 6 19 12 13 18" />
    </svg>
);

const Collections = () => {
    const cabecera = useAparecer();
    const rejilla = useAparecerGrupo(0.12);

    return (
        <section id="colecciones" className="collections-section">
            <div className="container">

                <div
                    className="collections-header"
                    ref={cabecera}
                >
                    <p className="eyebrow">Nuestras colecciones</p>
                    <h2 className="collections-title">Lo que <em>hacemos.</em></h2>
                    <p className="collections-subtitle">
                        Combinamos delicadeza y artesanía para crear piezas que perduran.
                    </p>
                </div>

                <div
                    className="collections-grid" ref={rejilla}
                >
                    {collectionsData.map(item => (
                        <article key={item.id} className="collection-card">

                            <Link to={`/catalogo?categoria=${item.category}`} className="collection-card-image" aria-label={item.cta}>
                                <img src={item.image} alt={`${item.title} de Aurem Gs Joyería`} />
                                <span className="punzon collection-card-mark">{item.metal}</span>
                            </Link>

                            <div className="collection-card-body">
                                <h3 className="collection-card-title">{item.title}</h3>
                                <p className="collection-card-desc">{item.description}</p>
                                <Link to={`/catalogo?categoria=${item.category}`} className="link-action">
                                    {item.cta} <Arrow />
                                </Link>
                            </div>

                        </article>
                    ))}
                </div>

                <div className="collections-cta">
                    <Link to="/catalogo" className="btn-pill black">Ver el catálogo</Link>
                </div>

            </div>
        </section>
    );
};

export default Collections;
