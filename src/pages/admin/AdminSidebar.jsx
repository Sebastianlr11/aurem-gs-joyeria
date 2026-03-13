import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { NAV } from './adminNav.jsx';

const AdminSidebar = ({ session, activeId, onNavClick }) => {
    const navigate = useNavigate();

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

    return (
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
    );
};

export default AdminSidebar;
