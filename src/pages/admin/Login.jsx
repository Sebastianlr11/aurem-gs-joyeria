import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

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
            setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
        } else {
            navigate('/admin');
        }
        setLoading(false);
    };

    const handleRecover = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) { setError('Ingresa tu correo electrónico.'); return; }
        setLoading(true);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/admin/reset-password`,
        });
        if (resetError) {
            setError('Error al enviar el correo. Intenta de nuevo.');
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

    const anim = {
        hidden: { y: 16, opacity: 0 },
        visible: (i) => ({
            y: 0, opacity: 1,
            transition: { duration: 0.5, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] },
        }),
    };

    return (
        <div className="admin-login">
            {/* Left — hero */}
            <div className="admin-login-left">
                <div className="admin-login-left-overlay" />
                <div className="admin-login-left-content">
                    <p className="admin-login-brand-sub">PORTAL EXCLUSIVO</p>
                    <h2 className="admin-login-brand-name">AUREM GS</h2>
                    <div className="admin-login-brand-line" />
                    <p className="admin-login-brand-tagline">Joyería de Alta Gama</p>
                </div>
            </div>

            {/* Right — form */}
            <motion.div
                className="admin-login-right"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="admin-login-panel">
                    {/* Logo */}
                    <motion.div
                        className="admin-login-logo-wrap"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        <img src="/assets/logo1.png" alt="Aurem Gs" className="admin-login-logo" />
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {mode === 'login' ? (
                            <motion.div
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                style={{ width: '100%' }}
                            >
                                {/* Header */}
                                <motion.div className="admin-login-header" custom={0} variants={anim} initial="hidden" animate="visible">
                                    <p className="admin-login-portal-label">PORTAL ADMINISTRATIVO</p>
                                    <h1 className="admin-login-welcome">Bienvenido</h1>
                                    <p className="admin-login-subtitle">Ingresa tus credenciales para continuar</p>
                                </motion.div>

                                {/* Form */}
                                <form className="admin-login-form" onSubmit={handleSubmit}>
                                    {error && (
                                        <motion.div className="admin-login-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                            {error}
                                        </motion.div>
                                    )}

                                    <motion.div className="admin-login-field" custom={1} variants={anim} initial="hidden" animate="visible">
                                        <label className="admin-login-label">Correo electrónico</label>
                                        <div className="admin-login-input-wrap">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                            <input className="admin-login-input" type="email" placeholder="admin@auremgs.com" value={email} onChange={e => setEmail(e.target.value)} required />
                                        </div>
                                    </motion.div>

                                    <motion.div className="admin-login-field" custom={2} variants={anim} initial="hidden" animate="visible">
                                        <div className="admin-login-label-row">
                                            <label className="admin-login-label">Contraseña</label>
                                            <button type="button" className="admin-login-forgot" onClick={() => switchMode('recover')}>
                                                ¿Olvidaste tu contraseña?
                                            </button>
                                        </div>
                                        <div className="admin-login-input-wrap">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                                            <input className="admin-login-input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                                            <button type="button" className="admin-login-eye" onClick={() => setShowPassword(s => !s)}>
                                                {showPassword
                                                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                }
                                            </button>
                                        </div>
                                    </motion.div>

                                    <motion.button className="admin-login-btn" type="submit" disabled={loading} custom={3} variants={anim} initial="hidden" animate="visible" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                        {loading ? (
                                            <span className="admin-login-btn-loading"><span className="admin-login-spinner" />Ingresando...</span>
                                        ) : 'Ingresar'}
                                    </motion.button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="recover"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                style={{ width: '100%' }}
                            >
                                <motion.div className="admin-login-header" custom={0} variants={anim} initial="hidden" animate="visible">
                                    <p className="admin-login-portal-label">RECUPERAR ACCESO</p>
                                    <h1 className="admin-login-welcome">
                                        {recoverSent ? 'Correo enviado' : 'Recuperar contraseña'}
                                    </h1>
                                    <p className="admin-login-subtitle">
                                        {recoverSent
                                            ? 'Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.'
                                            : 'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.'}
                                    </p>
                                </motion.div>

                                {!recoverSent ? (
                                    <form className="admin-login-form" onSubmit={handleRecover}>
                                        {error && (
                                            <motion.div className="admin-login-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                {error}
                                            </motion.div>
                                        )}
                                        <motion.div className="admin-login-field" custom={1} variants={anim} initial="hidden" animate="visible">
                                            <label className="admin-login-label">Correo electrónico</label>
                                            <div className="admin-login-input-wrap">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                                <input className="admin-login-input" type="email" placeholder="admin@auremgs.com" value={email} onChange={e => setEmail(e.target.value)} required />
                                            </div>
                                        </motion.div>
                                        <motion.button className="admin-login-btn" type="submit" disabled={loading} custom={2} variants={anim} initial="hidden" animate="visible" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                            {loading ? (
                                                <span className="admin-login-btn-loading"><span className="admin-login-spinner" />Enviando...</span>
                                            ) : 'Enviar enlace'}
                                        </motion.button>
                                    </form>
                                ) : (
                                    <motion.div className="admin-login-success" custom={1} variants={anim} initial="hidden" animate="visible">
                                        <div className="admin-login-success-icon">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                        </div>
                                        <p>Se envió un correo a <strong>{email}</strong></p>
                                    </motion.div>
                                )}

                                <motion.button className="admin-login-back" custom={3} variants={anim} initial="hidden" animate="visible" onClick={() => switchMode('login')}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                                    Volver al inicio de sesión
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.p className="admin-login-footer" custom={5} variants={anim} initial="hidden" animate="visible">
                        © 2026 Aurem Gs Joyería
                    </motion.p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
