import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Isotipo from '../../components/Isotipo';

/* El panel entero, incluida esta pantalla, se pinta con `panel.css`. Se
   importa aquí y no sólo en Dashboard/ChatPanel porque **a esta se llega
   por la URL, sin haber pasado por el panel**: es la primera pantalla, no
   una más. Del 23 al 24 de agosto de 2026 quien abría /admin/login de
   entrada veía la página cruda —enlaces azules, el isotipo a tamaño
   natural—; desde dentro se veía bien, porque la hoja ya estaba cargada. */
import '../../panel.css';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    /* Aquí había un onAuthStateChange con el cuerpo vacío, escuchando
       PASSWORD_RECOVERY para no hacer nada con él. Supabase toma la sesión del
       hash de la URL por su cuenta antes de que esta pantalla se monte, así que
       la suscripción sólo servía para desuscribirse. Fuera. */

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
            {/* Esta pantalla es la segunda mitad del camino que empieza en
                Login: se llega desde el correo de recuperación. Se había
                quedado con el diseño anterior —"PORTAL EXCLUSIVO", el isotipo
                como <img>— mientras Login ya estaba en la dirección nueva, así
                que el enlace del correo te dejaba en una tienda distinta. Es
                la misma columna de Login, sin las cifras: aquí ya entraste,
                no hay nada que convencer. */}
            <div className="admin-login-left">
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
                            Una contraseña
                            <em>nueva.</em>
                        </h1>
                        <div className="admin-login-rule" />
                        <p className="admin-login-lead">
                            El enlace del correo abre esta pantalla una sola vez y caduca solo.
                            Elige una contraseña que no uses en ningún otro sitio.
                        </p>
                    </div>
                </div>
            </div>

            <div className="admin-login-right monta monta--der">
                <div className="admin-login-panel">

                    <div className="admin-login-head">
                        <span className="admin-login-badge">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="1" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Enlace de recuperación
                        </span>

                        {success ? (
                            <h2 className="admin-login-welcome">
                                Contraseña
                                <em>actualizada.</em>
                            </h2>
                        ) : (
                            <h2 className="admin-login-welcome">
                                Elige la
                                <em>nueva.</em>
                            </h2>
                        )}

                        <p className="admin-login-subtitle">
                            {success
                                ? 'Listo. Te llevamos al panel en un momento.'
                                : 'Mínimo 6 caracteres. Se aplica en cuanto la guardes.'}
                        </p>
                    </div>

                    {success ? (
                        <div className="admin-login-success">
                            <div className="admin-login-success-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                        </div>
                    ) : (
                        <form className="admin-login-form" onSubmit={handleSubmit}>
                            {error && (
                                <div className="admin-login-error">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {error}
                                </div>
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

                            <button className="admin-login-btn" type="submit" disabled={loading}>
                                {loading ? (
                                    <span className="admin-login-btn-loading"><span className="admin-login-spinner" />Actualizando...</span>
                                ) : 'Actualizar contraseña'}
                            </button>
                        </form>
                    )}

                    <p className="admin-login-footer">© 2026 Aurem Gs Joyería</p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
