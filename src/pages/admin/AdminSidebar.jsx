import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { NAV } from './adminNav.jsx';

const BOTTOM_BAR_IDS = ['dashboard', 'orders', 'chat', 'products'];

const AdminSidebar = ({ session, activeId, onNavClick }) => {
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/admin/login');
    };

    const handleNav = (item) => {
        if (item.path) {
            navigate(item.path);
        } else {
            if (onNavClick) onNavClick(item.id);
        }
    };

    const handleMobileNav = (item) => {
        handleNav(item);
        setDrawerOpen(false);
    };

    useEffect(() => {
        if (drawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [drawerOpen]);

    const bottomItems = BOTTOM_BAR_IDS.map(id => NAV.find(n => n.id === id));

    return (
        <>
            <aside className="admin-sidebar">
                <div className="admin-sidebar-logo">
                    <img src="/assets/logo1.png" alt="Aurem GS" className="admin-sidebar-logo-img" />
                    <div className="admin-sidebar-logo-text">
                        <span>AUREM GS</span>
                        <span className="admin-sidebar-logo-sub">Admin Panel</span>
                    </div>
                </div>

                <nav className="admin-sidebar-nav">
                    {NAV.map(item => (
                        <button
                            key={item.id}
                            className={`admin-nav-item ${activeId === item.id ? 'admin-nav-item--active' : ''}`}
                            onClick={() => handleNav(item)}
                        >
                            <span className="admin-nav-icon">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="admin-sidebar-footer">
                    <div className="admin-sidebar-user">
                        <div className="admin-sidebar-avatar">{session.user.email[0].toUpperCase()}</div>
                        <div className="admin-sidebar-user-info">
                            <div className="admin-sidebar-email">{session.user.email}</div>
                            <div className="admin-sidebar-role">Administrador</div>
                        </div>
                    </div>
                    <button className="admin-sidebar-logout" onClick={handleLogout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Cerrar sesion
                    </button>
                </div>
            </aside>

            {/* ── Mobile bottom bar ── */}
            <nav className="admin-mobile-bar">
                {bottomItems.map(item => item && (
                    <button
                        key={item.id}
                        className={`admin-mobile-bar-btn ${activeId === item.id ? 'admin-mobile-bar-btn--active' : ''}`}
                        onClick={() => handleMobileNav(item)}
                    >
                        <span className="admin-mobile-bar-icon">{item.icon}</span>
                        <span className="admin-mobile-bar-label">{item.label}</span>
                    </button>
                ))}
                <button
                    className="admin-mobile-bar-btn"
                    onClick={() => setDrawerOpen(true)}
                >
                    <span className="admin-mobile-bar-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </span>
                    <span className="admin-mobile-bar-label">Más</span>
                </button>
            </nav>

            {/* ── Mobile drawer ── */}
            <div
                className={`admin-mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`}
                onClick={() => setDrawerOpen(false)}
            />
            <div className={`admin-mobile-drawer ${drawerOpen ? 'open' : ''}`}>
                <div className="admin-mobile-drawer-header">
                    <div className="admin-mobile-drawer-brand">
                        <img src="/assets/logo1.png" alt="Aurem GS" className="admin-mobile-drawer-logo" />
                        <span>AUREM GS</span>
                    </div>
                    <button className="admin-mobile-drawer-close" onClick={() => setDrawerOpen(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <nav className="admin-mobile-drawer-nav">
                    {NAV.map(item => (
                        <button
                            key={item.id}
                            className={`admin-nav-item ${activeId === item.id ? 'admin-nav-item--active' : ''}`}
                            onClick={() => handleMobileNav(item)}
                        >
                            <span className="admin-nav-icon">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="admin-mobile-drawer-footer">
                    <div className="admin-sidebar-user">
                        <div className="admin-sidebar-avatar">{session.user.email[0].toUpperCase()}</div>
                        <div className="admin-sidebar-user-info">
                            <div className="admin-sidebar-email">{session.user.email}</div>
                            <div className="admin-sidebar-role">Administrador</div>
                        </div>
                    </div>
                    <button className="admin-sidebar-logout" onClick={handleLogout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Cerrar sesion
                    </button>
                </div>
            </div>
        </>
    );
};

export default AdminSidebar;
