import React from 'react';
import { Link } from 'react-router-dom';

const collectionsData = [
    {
        id: 1,
        title: 'Anillos',
        category: 'Anillos',
        description: 'Diamantes finos y engastes perfectos diseñados para durar toda una vida.',
        tags: ['ORO 18K', 'DIAMANTES'],
        image: '/assets/rings.png'
    },
    {
        id: 2,
        title: 'Collares',
        category: 'Collares',
        description: 'Cadenas finas y dijes únicos que elevan cualquier look al instante.',
        tags: ['ZAFIROS', 'PLATINO'],
        image: '/assets/necklaces.png'
    },
    {
        id: 3,
        title: 'Pulseras',
        category: 'Pulseras',
        description: 'Eslabones que capturan la luz con cada movimiento de tu muñeca.',
        tags: ['ORO ROSA', 'ESLABONES FINOS'],
        image: '/assets/bracelets.png'
    }
];

const TagPill = ({ text }) => (
    <div className="col-tag-pill">
        <div className="col-tag-dot"></div>
        {text}
    </div>
);

const Collections = () => {
    return (
        <section id="colecciones" className="section-with-borders collections-section">
            <div className="container">

                {/* Header */}
                <div className="collections-header">
                    <div>
                        <div className="luxury-badge">
                            <span>//</span> Nuestras Colecciones <span>//</span>
                        </div>
                        <h2 className="collections-title">Lo Que<br />Hacemos.</h2>
                    </div>
                    <p className="collections-subtitle">
                        Combinamos delicadeza y artesanía para crear piezas que perduran —
                        cada diseño cuenta una historia.
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="collections-grid">
                    {collectionsData.map((item, index) => (
                        <div key={item.id} className={`collection-card animate-fade-in delay-${index + 1}`}>

                            {/* Image */}
                            <div className="collection-card-image">
                                <img src={item.image} alt={item.title} />
                                <span className="collection-card-number">0{index + 1}</span>
                            </div>

                            {/* Body */}
                            <div className="collection-card-body">
                                <div>
                                    <h3 className="collection-card-title">{item.title}</h3>
                                    <p className="collection-card-desc">{item.description}</p>
                                </div>

                                <div className="collection-card-footer">
                                    <div className="collection-tags">
                                        {item.tags.map(tag => <TagPill key={tag} text={tag} />)}
                                    </div>
                                    <Link
                                        to={`/catalogo?categoria=${item.category}`}
                                        className="collection-cta"
                                    >
                                        <span>Explorar</span>
                                        <div className="cta-circle">→</div>
                                    </Link>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>

            </div>
            <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }}></div>
        </section>
    );
};

export default Collections;
