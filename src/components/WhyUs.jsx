import React from 'react';
import { useAparecer, useAparecerGrupo } from '../lib/aparecer';



const PackageIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const MedalIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        <polyline points="10 8 11.5 10 14 7" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </svg>
);

const pillars = [
    {
        icon: <PackageIcon />,
        title: 'Envío seguro',
        description: 'Cada pieza viaja en embalaje de lujo con seguro incluido y rastreo hasta tu puerta.',
    },
    {
        icon: <MedalIcon />,
        title: 'Certificación de autenticidad',
        description: 'Certificamos materiales, quilataje y procedencia. El certificado tiene un costo adicional de $50.000.',
    },
    {
        icon: <ShieldIcon />,
        title: 'Garantía de por vida',
        description: 'Respaldamos el metal de por vida contra defectos de fabricación, con ajuste de talla sin costo.',
    },
];

const WhyUs = () => {
    const cabecera = useAparecer();
    const rejilla = useAparecerGrupo(0.15);

    return (
        <section id="nosotros" className="why-us-section">
            <div className="container">

                <div
                    className="why-us-header"
                    ref={cabecera}
                >
                    <p className="eyebrow">Por qué nosotros</p>
                    <h2 className="why-us-title">Calidad que <em>se siente.</em></h2>
                </div>

                <div
                    className="why-us-pillars" ref={rejilla}
                >
                    {pillars.map(pillar => (
                        <div key={pillar.title} className="why-us-pillar">
                            <div className="pillar-icon-wrap">{pillar.icon}</div>
                            <h3 className="pillar-title">{pillar.title}</h3>
                            <p className="pillar-desc">{pillar.description}</p>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};

export default WhyUs;
