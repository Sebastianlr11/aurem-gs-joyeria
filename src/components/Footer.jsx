import React from 'react';
import { Link } from 'react-router-dom';
import { useWaUrl } from '../lib/whatsapp';

const Footer = () => {
    const waInfo = useWaUrl({
        mobile: 'Hola! 👋 Vengo de la página de *Aurem Gs Joyería* y quiero más información ✨',
        desktop: 'Hola! Vengo de la página de *Aurem Gs Joyería* y quiero más información.'
    });

    return (
        <footer className="footer">
            <div className="container">

                <div className="footer-top">
                    <p className="footer-intro-text">
                        Piezas hechas a mano en Colombia, para durar generaciones.
                    </p>

                    <div className="footer-nav-columns">

                        <div className="footer-col">
                            <p className="footer-col-label">Navegación</p>
                            <ul className="footer-col-links">
                                <li><Link to="/catalogo">Catálogo</Link></li>
                                <li><a href="#colecciones">Colecciones</a></li>
                                <li><a href="#resenas">Reseñas</a></li>
                                <li><a href="#faqs">FAQs</a></li>
                                <li><a href="#contacto">Contacto</a></li>
                            </ul>
                        </div>

                        <div className="footer-col">
                            <p className="footer-col-label">Ayuda</p>
                            <ul className="footer-col-links">
                                <li><Link to="/guia-de-tallas">Guía de tallas</Link></li>
                                <li><Link to="/politica-de-privacidad">Política de privacidad</Link></li>
                                <li><Link to="/terminos-de-servicio">Términos de servicio</Link></li>
                                <li><Link to="/politica-de-devoluciones">Política de devoluciones</Link></li>
                            </ul>
                        </div>

                        <div className="footer-col">
                            <p className="footer-col-label">Redes</p>
                            <ul className="footer-col-links">
                                <li>
                                    <a href="https://www.instagram.com/auremgsjoyeria" target="_blank" rel="noopener noreferrer">Instagram</a>
                                </li>
                                <li>
                                    <a
                                        href={waInfo}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        WhatsApp
                                    </a>
                                </li>
                                <li><a href="mailto:hola@auremgsjoyeria.com">Correo</a></li>
                            </ul>
                        </div>

                    </div>
                </div>
            </div>

            {/* El cierre en cacao. El logotipo grande se queda, pero paga su
                espacio: la banda cambia de temperatura y hace el corte del
                final de la página en vez de ser una franja de marfil más. */}
            <div className="footer-cierre">
                <div className="container">
                    <span className="footer-brand-text">AUREM GS JOYERÍA</span>
                    <span className="footer-cierre-filete" />
                    <div className="footer-bottom">
                        {/* El año lo pone el build, y el 1 de enero deja de
                            coincidir con el del navegador hasta el siguiente
                            despliegue. `suppressHydrationWarning` es para
                            exactamente esto: React se queda con el del
                            navegador y no da por rota la hidratación —que
                            costaría volver a construir la página entera por
                            cuatro dígitos—. */}
                        <p suppressHydrationWarning>© {new Date().getFullYear()} Aurem Gs Joyería. Todos los derechos reservados.</p>
                        <p className="footer-credit">
                            Web hecha por{' '}
                            <a href="https://www.selffcode.com" target="_blank" rel="noopener noreferrer">
                                selffcode
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
