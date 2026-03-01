import React from 'react';

const PackageIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const MedalIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        <polyline points="10 8 11.5 10 14 7" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </svg>
);

const pillars = [
    {
        icon: <PackageIcon />,
        number: '01',
        title: 'Envío Seguro',
        description: 'Cada pieza viaja en embalaje de lujo con seguro incluido y rastreo en tiempo real hasta tu puerta.',
    },
    {
        icon: <MedalIcon />,
        number: '02',
        title: 'Certificación de Autenticidad',
        description: 'Cada joya incluye certificado de materiales, quilataje y procedencia firmado por nuestros expertos.',
    },
    {
        icon: <ShieldIcon />,
        number: '03',
        title: 'Garantía de Por Vida',
        description: 'Respaldamos cada pieza con garantía vitalicia contra defectos de fabricación y ajuste sin costo.',
    },
];

const WhyUs = () => {
    return (
        <section id="nosotros" className="section-with-borders why-us-section">
            <div className="container">

                {/* Header */}
                <div className="why-us-header">
                    <div>
                        <div className="luxury-badge">
                            <span>//</span> Por Qué Nosotros <span>//</span>
                        </div>
                        <h2 className="why-us-title">Calidad Que<br />Se Siente.</h2>
                    </div>
                    <p className="why-us-subtitle">
                        Cada detalle importa — desde el origen de los materiales hasta el momento en que la pieza llega a tus manos.
                    </p>
                </div>

                {/* Pillars */}
                <div className="why-us-pillars">
                    {pillars.map((pillar, index) => (
                        <div key={index} className={`why-us-pillar animate-fade-in delay-${index + 1}`}>
                            <div className="pillar-icon-wrap">
                                {pillar.icon}
                            </div>
                            <span className="pillar-number">{pillar.number}</span>
                            <h3 className="pillar-title">{pillar.title}</h3>
                            <p className="pillar-desc">{pillar.description}</p>
                            <div className="pillar-accent-line"></div>
                        </div>
                    ))}
                </div>

            </div>
            <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }}></div>
        </section>
    );
};

export default WhyUs;
