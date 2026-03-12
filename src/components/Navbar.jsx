import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const links = [
    { label: 'Catálogo',        href: '/catalogo'        },
    { label: 'Guía de Tallas',  href: '/guia-de-tallas'  },
    { label: 'Nosotros',        id:   'nosotros'         },
    { label: 'Reseñas',         id:   'resenas'          },
    { label: 'FAQs',            id:   'faqs'             },
    { label: 'Contacto',        id:   'contacto'         },
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

    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const scrollToSection = useCallback((id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const handleNavClick = useCallback((e, id) => {
        e.preventDefault();
        setMenuOpen(false);

        if (location.pathname === '/') {
            // Small delay so menu closes first, then scroll
            setTimeout(() => scrollToSection(id), 100);
        } else {
            navigate('/');
            setTimeout(() => scrollToSection(id), 400);
        }
    }, [location.pathname, navigate, scrollToSection]);

    return (
        <>
            <div className="navbar-outer">
                <nav className={`navbar-pill ${scrolled ? 'navbar-pill--scrolled' : ''}`}>

                    {/* Logo */}
                    <Link
                        to="/"
                        className="navbar-logo"
                        onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    >
                        <img src="/assets/logo1.png" alt="Aurem Gs Joyería" className="navbar-logo-img" />
                        <span className="navbar-logo-text">Aurem Gs</span>
                    </Link>

                    {/* Desktop Links */}
                    <ul className="navbar-links">
                        {links.filter(l => l.label !== 'Contacto').map(link => (
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

                    {/* Hamburger (mobile) */}
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
            </div>

            {/* ── Mobile fullscreen menu ── */}
            <div
                className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}
                onClick={(e) => { if (e.target === e.currentTarget) closeMenu(); }}
            >
                <div className="mobile-menu-panel">
                    {/* Close button */}
                    <button className="mobile-menu-close" onClick={closeMenu} aria-label="Cerrar menú">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    {/* Brand */}
                    <div className="mobile-menu-brand">
                        <img src="/assets/logo1.png" alt="Aurem Gs" className="mobile-menu-logo" />
                        <span className="mobile-menu-brand-name">Aurem Gs</span>
                    </div>

                    {/* Links */}
                    <ul className="mobile-menu-links">
                        {links.map(link => (
                            <li key={link.label}>
                                {link.href
                                    ? <Link to={link.href} className="mobile-menu-link" onClick={closeMenu}>
                                        {link.label}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                      </Link>
                                    : <a href={`#${link.id}`} className="mobile-menu-link" onClick={e => handleNavClick(e, link.id)}>
                                        {link.label}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                      </a>
                                }
                            </li>
                        ))}
                    </ul>

                    {/* Footer */}
                    <div className="mobile-menu-footer">
                        <p className="mobile-menu-footer-text">auremgsjoyeria@gmail.com</p>
                        <p className="mobile-menu-footer-text">+57 311 576 1896</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Navbar;
