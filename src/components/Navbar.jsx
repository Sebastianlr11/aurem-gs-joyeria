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
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate  = useNavigate();
    const location  = useLocation();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Lock body scroll when menu is open
    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    // Close menu on route change
    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    const handleNavClick = (e, id) => {
        e.preventDefault();
        setMenuOpen(false);
        if (location.pathname === '/') {
            scrollToSection(id);
        } else {
            navigate('/');
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
                    onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                    <img src="/assets/logo1.png" alt="Aurem Gs Joyería" className="navbar-logo-img" />
                    <span className="navbar-logo-text">Aurem Gs</span>
                </Link>

                {/* Desktop Links */}
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

                {/* CTA (desktop) */}
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

                {/* Hamburger button (mobile) */}
                <button
                    className={`navbar-hamburger ${menuOpen ? 'navbar-hamburger--open' : ''}`}
                    onClick={() => setMenuOpen(o => !o)}
                    aria-label="Menú"
                >
                    <span />
                    <span />
                    <span />
                </button>
            </nav>

            {/* Mobile menu overlay */}
            {menuOpen && <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} />}
            <div className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}>
                <ul className="mobile-menu-links">
                    {links.map(link => (
                        <li key={link.label}>
                            {link.href
                                ? <Link to={link.href} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>{link.label}</Link>
                                : <a href={`#${link.id}`} className="mobile-menu-link" onClick={e => handleNavClick(e, link.id)}>{link.label}</a>
                            }
                        </li>
                    ))}
                </ul>
                <a
                    href="#contacto"
                    className="mobile-menu-cta"
                    onClick={e => handleNavClick(e, 'contacto')}
                >
                    Contactar
                </a>
            </div>
        </div>
    );
};

export default Navbar;
