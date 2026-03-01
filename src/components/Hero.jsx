import React from 'react'
import { Link } from 'react-router-dom'
import { waUrl } from '../lib/whatsapp';

const Hero = () => {
    const column1 = [
        '/assets/hero1.png',
        '/assets/rings.png',
        '/assets/hero3.png',
        '/assets/necklaces.png',
        '/assets/hero2.png',
        '/assets/bracelets.png',
    ];

    const column2 = [
        '/assets/hero2.png',
        '/assets/necklaces.png',
        '/assets/bracelets.png',
        '/assets/hero1.png',
        '/assets/hero3.png',
        '/assets/rings.png',
    ];

    const tickerItems1 = [...column1, ...column1];
    const tickerItems2 = [...column2, ...column2];

    const RedArrow = () => (
        <div className="red-circle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
        </div>
    );

    return (
        <section className="section-with-borders hero-section" style={{ overflow: 'hidden', position: 'relative' }}>
            <div className="container" style={{ width: '100%', position: 'relative' }}>
                <div className="hero-content-grid">

                    {/* Left Column Text */}
                    <div className="hero-left-col">

                        <div className="luxury-badge hero-anim" style={{ '--hero-delay': '0s' }}>
                            <span style={{ color: 'var(--accent-red)' }}>//</span> DISPONIBLE PARA PEDIDOS <span style={{ color: 'var(--accent-red)' }}>//</span>
                        </div>

                        <h1 className="hero-h1">
                            <div className="hero-line" style={{ '--line-delay': '0.1s' }}>
                                <span>Diseño de Joyas</span>
                            </div>
                            <div className="hero-line" style={{ '--line-delay': '0.28s' }}>
                                <span>De Clase <span style={{ color: 'var(--text-muted)' }}>Mundial</span></span>
                            </div>
                        </h1>

                        <p className="hero-anim hero-subtitle" style={{ '--hero-delay': '0.55s' }}>
                            Suscripciones de diseño para piezas artesanales únicas. Joyería de autor para momentos que duran siempre.
                        </p>

                        <div className="hero-anim hero-btns" style={{ '--hero-delay': '0.7s' }}>
                            <Link to="/catalogo" className="btn-pill black">
                                Ver Catálogo <RedArrow />
                            </Link>
                            <a href={waUrl('Hola! Me interesa conocer las joyas de Aurem Gs Joyería. ¿Me pueden asesorar? 💎✨')} target="_blank" rel="noopener noreferrer" className="btn-pill light-fill">
                                Contáctanos <RedArrow />
                            </a>
                        </div>

                        <div className="hero-anim hero-social-proof" style={{ '--hero-delay': '0.88s' }}>
                            <div style={{ display: 'flex' }}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                        width: '45px',
                                        height: '45px',
                                        borderRadius: '50%',
                                        border: '3px solid var(--bg-color)',
                                        marginLeft: i === 1 ? 0 : '-15px',
                                        backgroundColor: '#ddd',
                                        overflow: 'hidden',
                                        zIndex: 5 - i,
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                    }}>
                                        <img src={`/assets/hero${(i % 3) + 1}.png`} alt="Client" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'left', marginLeft: '0.5rem' }}>
                                <div style={{ color: 'var(--accent-red)', fontSize: '1.1rem', letterSpacing: '2px', display: 'flex', gap: '2px', marginBottom: '2px' }}>
                                    ★★★★★
                                </div>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>Confiado por +100 negocios</p>
                                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginTop: '2px', textTransform: 'uppercase' }}>
                                    ELLOS ALCANZARON SUS METAS.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column Ticker */}
                    <div className="animate-fade-in delay-2 hero-right-col">
                        <div className="hero-ticker-container">
                            <div className="ticker-column down" style={{ paddingTop: '-300px' }}>
                                {tickerItems1.map((img, i) => (
                                    <div key={`col1-${i}`} className="ticker-item">
                                        <img src={img} alt="Jewelry Item" />
                                    </div>
                                ))}
                            </div>
                            <div className="ticker-column up">
                                {tickerItems2.map((img, i) => (
                                    <div key={`col2-${i}`} className="ticker-item">
                                        <img src={img} alt="Jewelry Item" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edge to Edge Horizontal Divider */}
            <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }}></div>
        </section>
    )
}

export default Hero
