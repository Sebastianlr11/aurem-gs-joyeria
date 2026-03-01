import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

    return (
        <div className="admin-login">
            <form className="admin-login-form" onSubmit={handleSubmit}>
                <h1 className="admin-login-title">Admin</h1>
                {error && <p className="admin-login-error">{error}</p>}
                <input
                    className="admin-input"
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <input
                    className="admin-input"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                <button className="admin-btn" type="submit" disabled={loading}>
                    {loading ? 'Entrando...' : 'Ingresar'}
                </button>
            </form>
        </div>
    );
};

export default Login;
