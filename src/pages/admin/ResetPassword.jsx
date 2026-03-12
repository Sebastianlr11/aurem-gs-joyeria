import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Supabase sets the session from the URL hash automatically
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                // User arrived via recovery link — session is set
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
            setError('Error al actualizar la contraseña. El enlace puede haber expirado.');
        } else {
            setSuccess(true);
            setTimeout(() => navigate('/admin'), 3000);
        }
        setLoading(false);
    };

    return (
        <div className="admin-login">
            <div className="admin-login-left">
                <div className="admin-login-left-overlay" />
                <div className="admin-login-left-content">
                    <p className="admin-login-brand-sub">PORTAL EXCLUSIVO</p>
                    <h2 className="admin-login-brand-name">AUREM GS</h2>
                    <div className="admin-login-brand-line" />
                    <p className="admin-login-brand-tagline">Joyería de Alta Gama</p>
                </div>
            </div>

            <motion.div
                className="admin-login-right"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="admin-login-panel">
                    <motion.div
                        className="admin-login-logo-wrap"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        <img src="/assets/logo1.png" alt="Aurem Gs" className="admin-login-logo" />
                    </motion.div>

                    <div className="admin-login-header">
                        <p className="admin-login-portal-label">SEGURIDAD</p>
                        <h1 className="admin-login-welcome">
                            {success ? 'Contraseña actualizada' : 'Nueva contraseña'}
                        </h1>
                        <p className="admin-login-subtitle">
                            {success
                                ? 'Tu contraseña ha sido actualizada. Redirigiendo al panel...'
                                : 'Ingresa tu nueva contraseña para restablecer el acceso.'}
                        </p>
                    </div>

                    {success ? (
                        <motion.div className="admin-login-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                            <div className="admin-login-success-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                        </motion.div>
                    ) : (
                        <form className="admin-login-form" onSubmit={handleSubmit}>
                            {error && (
                                <motion.div className="admin-login-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {error}
                                </motion.div>
                            )}

                            <div className="admin-login-field">
                                <label className="admin-login-label">Nueva contraseña</label>
                                <div className="admin-login-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                                    <input className="admin-login-input" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
                                    <button type="button" className="admin-login-eye" onClick={() => setShowPassword(s => !s)}>
                                        {showPassword
                                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        }
                                    </button>
                                </div>
                            </div>

                            <div className="admin-login-field">
                                <label className="admin-login-label">Confirmar contraseña</label>
                                <div className="admin-login-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                                    <input className="admin-login-input" type={showPassword ? 'text' : 'password'} placeholder="Repite la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                                </div>
                            </div>

                            <motion.button className="admin-login-btn" type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                {loading ? (
                                    <span className="admin-login-btn-loading"><span className="admin-login-spinner" />Actualizando...</span>
                                ) : 'Actualizar contraseña'}
                            </motion.button>
                        </form>
                    )}

                    <p className="admin-login-footer">© 2026 Aurem Gs Joyería</p>
                </div>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
