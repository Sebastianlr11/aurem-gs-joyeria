import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ProtectedRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);

    /* getSession() una sola vez al montar no bastaba: preguntaba si hay
       sesión al entrar y nunca volvía a preguntar. Si el token caducaba —o si
       cerrabas sesión en otra pestaña— el panel seguía montado, enseñando los
       datos que ya tenía y fallando en cada consulta nueva sin decir por qué.
       Se salía sólo al recargar a mano.

       onAuthStateChange avisa de las dos cosas, y también de la renovación
       silenciosa del token, que es lo que pasa la mayoría de las veces. */
    useEffect(() => {
        let vigente = true;

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!vigente) return;
            setSession(session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sesion) => {
            if (!vigente) return;
            setSession(sesion);
            setLoading(false);
        });

        return () => { vigente = false; subscription.unsubscribe(); };
    }, []);

    if (loading) return null;
    if (!session) return <Navigate to="/admin/login" replace />;
    return children;
};

export default ProtectedRoute;
