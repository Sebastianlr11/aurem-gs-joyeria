import React from 'react'
import { Link } from 'react-router-dom'
import { waUrl } from '../lib/whatsapp';
import { motion } from 'framer-motion';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }
    })
};

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

                        <motion.div
                            className="luxury-badge hero-anim"
                            style={{ '--hero-delay': '0s' }}
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            custom={0}
                            viewport={{ once: true, margin: '-80px' }}
                        >
                            <span style={{ color: 'var(--accent-red)' }}>//</span> DISPONIBLE PARA PEDIDOS <span style={{ color: 'var(--accent-red)' }}>//</span>
                        </motion.div>

                        <motion.h1
                            className="hero-h1"
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            custom={0}
                            viewport={{ once: true, margin: '-80px' }}
                        >
                            <div className="hero-line" style={{ '--line-delay': '0.1s' }}>
                                <span>Diseño de Joyas</span>
                            </div>
                            <div className="hero-line" style={{ '--line-delay': '0.28s' }}>
                                <span>De Clase <span style={{ color: 'var(--text-muted)' }}>Mundial</span></span>
                            </div>
                        </motion.h1>

                        <motion.p
                            className="hero-anim hero-subtitle"
                            style={{ '--hero-delay': '0.55s' }}
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            custom={0.1}
                            viewport={{ once: true, margin: '-80px' }}
                        >
                            Suscripciones de diseño para piezas artesanales únicas. Joyería de autor para momentos que duran siempre.
                        </motion.p>

                        <motion.div
                            className="hero-anim hero-btns"
                            style={{ '--hero-delay': '0.7s' }}
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            custom={0.2}
                            viewport={{ once: true, margin: '-80px' }}
                        >
                            <Link to="/catalogo" className="btn-pill black">
                                Ver Catálogo <RedArrow />
                            </Link>
                            <a href={waUrl({ mobile: 'Hola! 👋 Estoy interesado/a en las joyas de *Aurem Gs Joyería*. Me encantaría recibir asesoría personalizada ✨', desktop: 'Hola! Estoy interesado/a en las joyas de *Aurem Gs Joyería*. Me encantaría recibir asesoría personalizada.' })} target="_blank" rel="noopener noreferrer" className="btn-pill light-fill">
                                Contáctanos <RedArrow />
                            </a>
                        </motion.div>

                        <motion.div
                            className="hero-anim hero-social-proof"
                            style={{ '--hero-delay': '0.88s' }}
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="visible"
                            custom={0.3}
                            viewport={{ once: true, margin: '-80px' }}
                        >
                            <div style={{ display: 'flex' }}>
                                {[
                                    { letter: 'M', bg: '#111' },
                                    { letter: 'C', bg: '#111' },
                                    { letter: 'L', bg: '#111' },
                                    { letter: 'A', bg: '#111' },
                                ].map((client, i) => (
                                    <div key={i} style={{
                                        width: '45px',
                                        height: '45px',
                                        borderRadius: '50%',
                                        border: '3px solid var(--bg-color)',
                                        marginLeft: i === 0 ? 0 : '-15px',
                                        backgroundColor: client.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 5 - i,
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                    }}>
                                        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1 }}>{client.letter}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'left', marginLeft: '0.5rem' }}>
                                <div style={{ color: 'var(--accent-red)', fontSize: '1.1rem', letterSpacing: '2px', display: 'flex', gap: '2px', marginBottom: '2px' }}>
                                    ★★★★★
                                </div>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>Confiado por +100 clientes</p>
                                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginTop: '2px', textTransform: 'uppercase' }}>
                                    ELLOS ALCANZARON SUS METAS.
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column Ticker */}
                    <div className="animate-fade-in delay-2 hero-right-col">
                        <div className="hero-ticker-container">
                            <motion.div
                                className="ticker-column down"
                                style={{ paddingTop: '-300px' }}
                                initial={{ opacity: 0, x: -40 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                viewport={{ once: true, margin: '-80px' }}
                            >
                                {tickerItems1.map((img, i) => (
                                    <div key={`col1-${i}`} className="ticker-item">
                                        <img src={img} alt="Jewelry Item" />
                                    </div>
                                ))}
                            </motion.div>
                            <motion.div
                                className="ticker-column up"
                                initial={{ opacity: 0, x: 40 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                                viewport={{ once: true, margin: '-80px' }}
                            >
                                {tickerItems2.map((img, i) => (
                                    <div key={`col2-${i}`} className="ticker-item">
                                        <img src={img} alt="Jewelry Item" />
                                    </div>
                                ))}
                            </motion.div>
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
