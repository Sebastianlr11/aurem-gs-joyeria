import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container">

                {/* Top grid: nav columns */}
                <div className="footer-top">

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
