import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const links = [
    { label: 'Catálogo',  href: '/catalogo'  },
    { label: 'Nosotros',  id:   'nosotros'   },
    { label: 'Reseñas',   id:   'resenas'    },
    { label: 'FAQs',      id:   'faqs'       },
];

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const navigate  = useNavigate();
    const location  = useLocation();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    const handleNavClick = (e, id) => {
        e.preventDefault();
        if (location.pathname === '/') {
            scrollToSection(id);
        } else {
            navigate('/');
            // Wait for Home to render, then scroll
            setTimeout(() => scrollToSection(id), 150);
        }
    };

    return (
        <div className="navbar-outer">
            <nav className={`navbar-pill ${scrolled ? 'navbar-pill--scrolled' : ''}`}>

                {/* Logo → Home */}
                <Link
                    to="/"
                    className="navbar-logo"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                    <img src="/assets/logo1.png" alt="Aurem Gs Joyería" className="navbar-logo-img" />
                </Link>

                {/* Links */}
                <ul className="navbar-links">
                    {links.map(link => (
                        <li key={link.label}>
                            {link.href
                                ? <Link to={link.href} className="navbar-link">{link.label}</Link>
                                : <a href={`#${link.id}`} className="navbar-link" onClick={e => handleNavClick(e, link.id)}>{link.label}</a>
                            }
                        </li>
                    ))}
                </ul>

                {/* CTA */}
                <a
                    href="#contacto"
                    className="navbar-cta"
                    onClick={e => handleNavClick(e, 'contacto')}
                >
                    Contactar
                    <div className="navbar-cta-circle">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="7" y1="17" x2="17" y2="7" />
                            <polyline points="7 7 17 7 17 17" />
                        </svg>
                    </div>
                </a>

            </nav>
        </div>
    );
};

export default Navbar;
