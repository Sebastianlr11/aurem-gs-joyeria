import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
            setError('Credenciales incorrectas.');
        } else {
            navigate('/admin');
        }
        setLoading(false);
    };

    const fieldVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: (i) => ({
            y: 0,
            opacity: 1,
            transition: { duration: 0.5, delay: 0.4 + i * 0.1, ease: [0.16, 1, 0.3, 1] },
        }),
    };

    return (
        <div className="admin-login">
            {/* Left column — decorative */}
            <div className="admin-login-left">
                <div className="admin-login-left-overlay" />
                <div className="admin-login-left-content">
                    <p className="admin-login-brand-sub">PORTAL EXCLUSIVO</p>
                    <h2 className="admin-login-brand-name">AUREM GS</h2>
                    <div className="admin-login-brand-line" />
                    <p className="admin-login-brand-tagline">Joyería de Alta Gama</p>
                </div>
            </div>

            {/* Right column — form panel */}
            <motion.div
                className="admin-login-right"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="admin-login-panel">
                    {/* Logo */}
                    <motion.div
                        className="admin-login-logo-wrap"
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <img
                            src="/assets/logo1.png"
                            alt="Aurem Gs Logo"
                            className="admin-login-logo"
                        />
                    </motion.div>

                    {/* Header text */}
                    <motion.div
                        className="admin-login-header"
                        custom={0}
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <p className="admin-login-portal-label">PORTAL ADMINISTRATIVO</p>
                        <h1 className="admin-login-welcome">Bienvenido</h1>
                        <p className="admin-login-subtitle">
                            Ingresa tus credenciales para continuar
                        </p>
                        <div className="admin-login-divider" />
                    </motion.div>

                    {/* Form */}
                    <form className="admin-login-form" onSubmit={handleSubmit}>
                        {error && (
                            <motion.p
                                className="admin-login-error"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {error}
                            </motion.p>
                        )}

                        <motion.div
                            className="admin-login-field"
                            custom={1}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <label className="admin-login-label">Correo electrónico</label>
                            <input
                                className="admin-login-input"
                                type="email"
                                placeholder="admin@auremgs.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </motion.div>

                        <motion.div
                            className="admin-login-field"
                            custom={2}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <label className="admin-login-label">Contraseña</label>
                            <input
                                className="admin-login-input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </motion.div>

                        <motion.button
                            className="admin-login-btn"
                            type="submit"
                            disabled={loading}
                            custom={3}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {loading ? (
                                <span className="admin-login-btn-loading">
                                    <span className="admin-login-spinner" />
                                    Entrando...
                                </span>
                            ) : (
                                'Ingresar'
                            )}
                        </motion.button>
                    </form>

                    {/* Footer */}
                    <motion.p
                        className="admin-login-footer"
                        custom={4}
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        © 2026 Aurem Gs Joyería
                    </motion.p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
