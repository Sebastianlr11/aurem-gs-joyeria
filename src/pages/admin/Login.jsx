import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { waUrl } from '../../lib/whatsapp';
import Isotipo from '../../components/Isotipo';

const MailIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <path d="m2 6 10 7 10-7" />
    </svg>
);

const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="16" height="11" rx="1" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
);

const ArrowIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
    </svg>
);

const stats = [
    { num: '18k', label: 'Oro certificado' },
    { num: '24–48 h', label: 'Envío hábil' },
    { num: '925', label: 'Plata ley' },
];

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mode, setMode] = useState('login'); // 'login' | 'recover'
    const [recoverSent, setRecoverSent] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
            setError('Ese correo y esa contraseña no coinciden. Revísalos e intenta de nuevo.');
        } else {
            navigate('/admin');
        }
        setLoading(false);
    };

    const handleRecover = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) { setError('Escribe tu correo para enviarte el enlace.'); return; }
        setLoading(true);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/admin/reset-password`,
        });
        if (resetError) {
            setError('No se pudo enviar el correo. Intenta de nuevo en un momento.');
        } else {
            setRecoverSent(true);
        }
        setLoading(false);
    };

    const switchMode = (m) => {
        setMode(m);
        setError('');
        setRecoverSent(false);
    };

    const esRecuperar = mode === 'recover';

    return (
        <div className="admin-login">

            {/* Izquierda — la vitrina */}
            <section className="admin-login-left">
                <img
                    className="admin-login-photo"
                    src="/assets/pen-hero.jpg"
                    alt=""
                    aria-hidden="true"
                />
                <div className="admin-login-left-overlay" />
                <div className="admin-login-sweep" aria-hidden="true" />

                <div className="admin-login-left-content">
                    <div className="admin-login-brand">
                        <Isotipo className="admin-login-mark" />
                        <span className="admin-login-brand-sub">Aurem Gs Joyería</span>
                    </div>

                    <div className="admin-login-pitch">
                        <p className="admin-login-eyebrow">Panel interno</p>
                        <h1 className="admin-login-title">
                            Detrás de la vitrina,
                            <em>el taller.</em>
                        </h1>
                        <div className="admin-login-rule" />
                        <p className="admin-login-lead">
                            Pedidos, inventario y conversaciones de WhatsApp en un solo lugar. Cada pieza
                            con su ley, su certificado y su plazo de entrega.
                        </p>
                    </div>

                    <div className="admin-login-stats">
                        {stats.map(s => (
                            <div key={s.label} className="admin-login-stat">
                                <p className="admin-login-stat-num">{s.num}</p>
                                <p className="admin-login-stat-label">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Derecha — el acceso */}
            <motion.section
                className="admin-login-right"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="admin-login-panel">

                    <div className="admin-login-head">
                        <span className="admin-login-badge">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="1" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Acceso autorizado
                        </span>

                        {esRecuperar ? (
                            <h2 className="admin-login-welcome">
                                Recuperar
                                <em>el acceso.</em>
                            </h2>
                        ) : (
                            <h2 className="admin-login-welcome">
                                Bienvenido de
                                <em>vuelta.</em>
                            </h2>
                        )}

                        <p className="admin-login-subtitle">
                            {esRecuperar
                                ? (recoverSent
                                    ? 'Revisa tu bandeja de entrada y sigue el enlace para crear una contraseña nueva.'
                                    : 'Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.')
                                : 'Entra con tu correo y contraseña.'}
                        </p>
                    </div>

                    {recoverSent ? (
                        <div className="admin-login-form">
                            <p className="admin-login-success">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <span>Enviamos el enlace a <strong>{email}</strong></span>
                            </p>
                            <button type="button" className="admin-login-back" onClick={() => switchMode('login')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 12H5" />
                                    <polyline points="11 18 5 12 11 6" />
                                </svg>
                                Volver a entrar
                            </button>
                        </div>
                    ) : (
                        <form className="admin-login-form" onSubmit={esRecuperar ? handleRecover : handleSubmit} noValidate>

                            <div className="admin-login-field">
                                <label className="admin-login-label" htmlFor="admin-correo">Correo</label>
                                <div className="admin-login-input-wrap">
                                    <MailIcon />
                                    <input
                                        id="admin-correo"
                                        className="admin-login-input"
                                        type="email"
                                        autoComplete="username"
                                        placeholder="auremgsjoyeria@gmail.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {!esRecuperar && (
                                <div className="admin-login-field">
                                    <div className="admin-login-label-row">
                                        <label className="admin-login-label" htmlFor="admin-clave">Contraseña</label>
                                        <button type="button" className="admin-login-forgot" onClick={() => switchMode('recover')}>
                                            ¿La olvidaste?
                                        </button>
                                    </div>
                                    <div className="admin-login-input-wrap">
                                        <LockIcon />
                                        <input
                                            id="admin-clave"
                                            className="admin-login-input"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="admin-login-eye"
                                            onClick={() => setShowPassword(s => !s)}
                                            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                        >
                                            {showPassword ? (
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            ) : (
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1.5 12S5.4 5 12 5s10.5 7 10.5 7-3.9 7-10.5 7S1.5 12 1.5 12z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {error && <p className="admin-login-error">{error}</p>}

                            <button type="submit" className="admin-login-btn" disabled={loading}>
                                {loading && <span className="admin-login-spinner" />}
                                {loading
                                    ? (esRecuperar ? 'Enviando…' : 'Entrando…')
                                    : (esRecuperar ? 'Enviar el enlace' : 'Entrar al panel')}
                            </button>

                            {esRecuperar ? (
                                <button type="button" className="admin-login-back" onClick={() => switchMode('login')}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 12H5" />
                                        <polyline points="11 18 5 12 11 6" />
                                    </svg>
                                    Volver a entrar
                                </button>
                            ) : (
                                <div className="admin-login-divider">
                                    <span>Solo personal</span>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="admin-login-help">
                        <p>¿Perdiste el acceso?<br />Escríbele a soporte por WhatsApp.</p>
                        <a
                            href={waUrl({
                                mobile: 'Hola! 🔐 Perdí el acceso al panel de *Aurem Gs Joyería* y necesito ayuda.',
                                desktop: 'Hola! Perdí el acceso al panel de *Aurem Gs Joyería* y necesito ayuda.'
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Abrir chat <ArrowIcon />
                        </a>
                    </div>

                    <p className="admin-login-footer">
                        © {new Date().getFullYear()} Aurem Gs Joyería · Sesión cifrada
                    </p>
                </div>
            </motion.section>
        </div>
    );
};

export default Login;
