import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    const [email, setEmail] = useState('');

    return (
        <footer className="footer">
            <div className="container">

                {/* Top grid: newsletter + nav columns */}
                <div className="footer-top">

                    {/* Newsletter */}
                    <div className="footer-newsletter">
                        <h3 className="footer-newsletter-title">Newsletter</h3>
                        <p className="footer-newsletter-desc">
                            Suscríbete y recibe primero las nuevas colecciones, ofertas exclusivas y cuidado de joyas.
                        </p>
                        <form className="footer-email-form" onSubmit={e => e.preventDefault()}>
                            <input
                                type="email"
                                placeholder="Tu correo electrónico"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="footer-email-input"
                            />
                            <button type="submit" className="footer-email-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </button>
                        </form>
                    </div>

                    {/* Nav columns */}
                    <div className="footer-nav-columns">

                        <div className="footer-col">
                            <p className="footer-col-label">/Navegación</p>
                            <ul className="footer-col-links">
                                <li><a href="#">Colecciones</a></li>
                                <li><a href="#">Por Qué Nosotros</a></li>
                                <li><a href="#">Reseñas</a></li>
                                <li><a href="#">FAQs</a></li>
                                <li><a href="#">Contacto</a></li>
                            </ul>
                        </div>

                        <div className="footer-col">
                            <p className="footer-col-label">/Legal</p>
                            <ul className="footer-col-links">
                                <li><Link to="/politica-de-privacidad">Política de Privacidad</Link></li>
                                <li><Link to="/terminos-de-servicio">Términos de Servicio</Link></li>
                                <li><Link to="/politica-de-devoluciones">Política de Devoluciones</Link></li>
                            </ul>
                        </div>

                        <div className="footer-col">
                            <p className="footer-col-label">/Redes</p>
                            <ul className="footer-col-links">
                                <li><a href="#">Instagram</a></li>
                                <li><a href="#">Facebook</a></li>
                                <li><a href="#">Pinterest</a></li>
                                <li><a href="#">WhatsApp</a></li>
                            </ul>
                        </div>

                    </div>
                </div>
            </div>

            {/* Giant brand name */}
            <div className="footer-brand-wrap">
                <span className="footer-brand-text">AUREM GS JOYERÍA</span>
            </div>

            {/* Copyright bar */}
            <div className="container">
                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} Aurem Gs Joyería. Todos los derechos reservados.</p>
                    <p>Diseñado con precisión artesanal.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
