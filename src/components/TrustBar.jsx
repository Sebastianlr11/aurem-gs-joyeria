import React from 'react';

const TruckIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="13" height="11" rx="1" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="6" cy="18" r="1.8" />
        <circle cx="17" cy="18" r="1.8" />
    </svg>
);

const CashIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="1.5" />
        <circle cx="12" cy="12" r="2.8" />
        <path d="M5 9.5v5M19 9.5v5" />
    </svg>
);

const CertificateIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3h14v13H5z" />
        <path d="M8.5 19.5 12 17l3.5 2.5V16h-7z" />
        <path d="M8.5 7.5h7M8.5 11h4" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21.5s7.5-3.6 7.5-9.3V5.2L12 2.5 4.5 5.2v7c0 5.7 7.5 9.3 7.5 9.3z" />
        <polyline points="9 12 11 14 15 10" />
    </svg>
);

const items = [
    /* El plazo se parte por ciudad: el taller despacha al día siguiente y en
       Bogotá se entrega en 24 a 48 h, pero al resto del país la transportadora
       tarda 2 a 3 días. Prometerlo a todo el país era prometer de más. */
    { icon: <TruckIcon />, title: 'Envío a toda Colombia', sub: '24 a 48 h en Bogotá · 2 a 3 días al resto' },
    { icon: <CashIcon />, title: 'Pago contra entrega', sub: 'En Bogotá' },
    /* Acá va sólo lo que se cumple SIEMPRE. El certificado salió de esta
       barra porque tiene un costo aparte: prometerlo junto al envío y la
       garantía lo hacía leer como incluido. Vive en la ficha del producto,
       con su precio. */
    { icon: <CertificateIcon />, title: 'Taller propio', sub: 'Piezas a medida' },
    { icon: <ShieldIcon />, title: 'Garantía de por vida', sub: 'En el metal' },
];

const TrustBar = () => (
    <section className="trust-bar" aria-label="Garantías de compra">
        <div className="container">
            <div className="trust-bar-inner">
                {items.map(item => (
                    <div key={item.title} className="trust-item">
                        <span className="trust-icon">{item.icon}</span>
                        <div>
                            <p className="trust-title">{item.title}</p>
                            <p className="trust-sub">{item.sub}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

export default TrustBar;
