/**
 * Panel · Ajustes — precios del taller y lo que Valentina puede afirmar.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026, con las dos tarjetas que
 * sólo usa esta pantalla. Nada cambió de comportamiento: el código se movió
 * tal cual, y se comprobó midiendo 24 propiedades calculadas de cada elemento
 * de la pantalla, antes y después.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { CLAVE_RESPUESTAS, RESPUESTAS_POR_DEFECTO, comoTexto } from '../../../lib/respuestasRapidas';
import GuiaDelCircuito from './GuiaDelCircuito';
import { fmtDate } from './comunes';

const PrecioOroCard = () => {
    /* El reloj leído una sola vez, al montar. Llamar a Date.now() mientras
       React renderiza es impuro; y para "hace cuántos días se actualizó el
       precio del oro" no hace falta minutero: nadie deja esta tarjeta abierta
       de un día para otro. */
    const [ahora] = useState(() => Date.now());
    const [precios, setPrecios] = useState(null);
    const [gramo, setGramo] = useState('');
    const [recargoTxt, setRecargoTxt] = useState('');
    const [minimoTxt, setMinimoTxt] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState({ tipo: '', msg: '' });

    const cargar = useCallback(() => {
        supabase.from('taller_precios')
            .select('precio_gramo_oro, recargo_por_gramo, gramos_minimos, actualizado_en, actualizado_por')
            .maybeSingle()
            .then(({ data }) => {
                if (!data) return;
                setPrecios(data);
                setGramo(String(Math.round(Number(data.precio_gramo_oro))));
                setRecargoTxt(String(Math.round(Number(data.recargo_por_gramo))));
                setMinimoTxt(String(Number(data.gramos_minimos)));
            });
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const guardar = async () => {
        const valor = Number(String(gramo).replace(/[^\d]/g, ''));
        const recargoNuevo = Number(String(recargoTxt).replace(/[^\d]/g, ''));
        const minimoNuevo = Number(String(minimoTxt).replace(/[^\d.,]/g, '').replace(',', '.'));

        if (!valor || valor <= 0) {
            setAviso({ tipo: 'error', msg: 'Escribe el precio del gramo, sólo números.' });
            return;
        }
        if (!recargoNuevo || recargoNuevo <= 0) {
            setAviso({ tipo: 'error', msg: 'El recargo por gramo no puede quedar vacío ni en cero.' });
            return;
        }
        if (!minimoNuevo || minimoNuevo <= 0) {
            setAviso({ tipo: 'error', msg: 'El mínimo de gramos no puede quedar vacío ni en cero.' });
            return;
        }

        setGuardando(true);
        setAviso({ tipo: '', msg: '' });

        const { data: sesion } = await supabase.auth.getUser();
        const { error } = await supabase.from('taller_precios')
            .update({
                precio_gramo_oro: valor,
                recargo_por_gramo: recargoNuevo,
                gramos_minimos: minimoNuevo,
                actualizado_en: new Date().toISOString(),
                actualizado_por: sesion?.user?.email ?? null,
            })
            .eq('id', true);

        setGuardando(false);
        if (error) {
            setAviso({ tipo: 'error', msg: `No se pudo guardar: ${error.message}` });
            return;
        }
        setAviso({ tipo: 'ok', msg: 'Precio actualizado. Valentina ya cotiza con este valor.' });
        cargar();
    };

    if (!precios) return null;

    const recargo = Number(String(recargoTxt).replace(/[^\d]/g, '')) || 0;
    const minimo = Number(String(minimoTxt).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const porGramo = (Number(String(gramo).replace(/[^\d]/g, '')) || 0) + recargo;
    const dias = Math.floor((ahora - new Date(precios.actualizado_en).getTime()) / 86400000);
    const viejo = dias >= 3;
    const pesos = n => `$${Math.round(n).toLocaleString('es-CO')}`;

    return (
        <div className="admin-card" style={{ maxWidth: 600 }}>
            <div className="admin-card-head">
                <h3 className="admin-card-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Precio del oro
                    </span>
                </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Lo que Valentina usa para cotizar piezas a medida en oro. Míralo en
                goldprice.org y cámbialo sólo cuando el movimiento lo amerite: subidas
                o bajadas pequeñas no cambian la cotización.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="modal-field">
                    <label>Precio del gramo hoy (COP)</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={gramo}
                        onChange={e => setGramo(e.target.value)}
                        placeholder="437668"
                    />
                </div>

                <div style={{
                    background: 'var(--bg-arena, #F2EAE0)', borderRadius: 2,
                    padding: '0.85rem 1rem', fontSize: '0.85rem', lineHeight: 1.7,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Precio del gramo</span>
                        <strong>{pesos(Number(String(gramo).replace(/[^\d]/g, '')) || 0)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>+ diseño, fundición y terminado</span>
                        <span>{pesos(recargo)}</span>
                    </div>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        borderTop: '1px solid var(--hairline, #E6DED3)', marginTop: '0.4rem', paddingTop: '0.4rem',
                    }}>
                        <span><strong>Se cotiza a</strong></span>
                        <strong>{pesos(porGramo)} el gramo</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                        Un anillo de 10 gramos saldría en {pesos(porGramo * 10)}.
                        Desde {minimo} gramos; por debajo lo cotiza una persona.
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setAbierto(!abierto)}
                    style={{
                        background: 'none', border: 0, padding: 0, cursor: 'pointer',
                        font: 'inherit', fontSize: '0.82rem', color: 'var(--oro-ink, #7A5F26)',
                        textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3,
                    }}
                >
                    {abierto ? 'Ocultar' : 'Cambiar'} el recargo del taller y el mínimo de gramos
                </button>

                {abierto && (
                    <div style={{ display: 'grid', gap: '0.85rem' }}>
                        <div className="modal-field">
                            <label>Recargo por gramo (COP)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={recargoTxt}
                                onChange={e => setRecargoTxt(e.target.value)}
                                placeholder="118000"
                            />
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
                                Cubre diseño, fundición, terminado y la ganancia del taller.
                                Cambia pocas veces: sólo si cambia cómo se cobra el trabajo.
                            </p>
                        </div>
                        <div className="modal-field">
                            <label>Mínimo de gramos para cotizar por peso</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={minimoTxt}
                                onChange={e => setMinimoTxt(e.target.value)}
                                placeholder="5"
                            />
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
                                Por debajo de este peso la merma se come la ganancia, así que
                                Valentina no cotiza: pasa la conversación a una persona.
                            </p>
                        </div>
                    </div>
                )}

                <div>
                    <button className="admin-btn" onClick={guardar} disabled={guardando}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>

                <p style={{ fontSize: '0.8rem', color: viejo ? 'var(--oro-ink)' : 'var(--text-secondary)', margin: 0 }}>
                    {dias === 0 ? 'Actualizado hoy' : dias === 1 ? 'Actualizado ayer' : `Actualizado hace ${dias} días`}
                    {precios.actualizado_por ? ` por ${precios.actualizado_por}` : ''}
                    {viejo ? ' — conviene revisarlo.' : '.'}
                </p>

                {aviso.msg && (
                    <p style={{ fontSize: '0.85rem', color: aviso.tipo === 'error' ? 'var(--error-ink)' : 'var(--oro-ink)', margin: 0 }}>
                        {aviso.msg}
                    </p>
                )}
            </div>
        </div>
    );
};

/* ─── Lo que Valentina sabe del negocio ──────────────────────────────
   Envíos, pagos, garantía, proceso. Vivía escrito dentro del prompt y se
   desincronizó de la operación: llegó a prometer "Mercado Pago con 2% de
   descuento, envíos en 24 a 48 horas" cuando el taller cobra por Nequi y
   despacha por Interrapidísimo. Acá se corrige sin desplegar nada.
   ─────────────────────────────────────────────────────────────────── */
const ConocimientoCard = () => {
    const [temas, setTemas] = useState([]);
    const [borradores, setBorradores] = useState({});
    const [guardando, setGuardando] = useState(null);
    const [aviso, setAviso] = useState({ tipo: '', msg: '' });

    const cargar = useCallback(() => {
        supabase.from('taller_conocimiento')
            .select('id, tema, contenido, activo, orden')
            .order('orden')
            .then(({ data }) => {
                if (!data) return;
                setTemas(data);
                setBorradores(Object.fromEntries(data.map(t => [t.id, t.contenido])));
            });
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const guardar = async (t) => {
        const texto = (borradores[t.id] ?? '').trim();
        if (!texto) {
            setAviso({ tipo: 'error', msg: `"${t.tema}" no puede quedar vacío. Si no aplica, desactívalo.` });
            return;
        }
        setGuardando(t.id);
        setAviso({ tipo: '', msg: '' });
        const { error } = await supabase.from('taller_conocimiento')
            .update({ contenido: texto, actualizado_en: new Date().toISOString() })
            .eq('id', t.id);
        setGuardando(null);
        setAviso(error
            ? { tipo: 'error', msg: `No se pudo guardar: ${error.message}` }
            : { tipo: 'ok', msg: `"${t.tema}" actualizado. Valentina ya lo dice así.` });
        if (!error) cargar();
    };

    const alternar = async (t) => {
        await supabase.from('taller_conocimiento').update({ activo: !t.activo }).eq('id', t.id);
        cargar();
    };

    if (!temas.length) return null;

    const sinConfirmar = temas.filter(t => t.contenido.includes('SIN CONFIRMAR')).length;

    return (
        <div className="admin-card" style={{ maxWidth: 720 }}>
            <div className="admin-card-head">
                <h3 className="admin-card-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        Lo que Valentina sabe del negocio
                    </span>
                </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                Es lo único que puede afirmar sobre envíos, pagos, garantía y plazos.
                Lo que no esté acá, lo consulta con una persona en vez de inventarlo.
                Se aplica al siguiente mensaje, sin desplegar nada.
            </p>

            {sinConfirmar > 0 && (
                <p style={{
                    fontSize: '0.82rem', color: 'var(--oro-ink)', lineHeight: 1.5,
                    background: 'rgba(180,83,9,0.07)', borderRadius: 2,
                    padding: '0.7rem 0.9rem', margin: '0 0 1.25rem',
                }}>
                    {sinConfirmar === 1 ? 'Hay 1 tema' : `Hay ${sinConfirmar} temas`} con
                    “SIN CONFIRMAR”. Los redacté a partir de conversaciones reales, pero
                    nadie los verificó: revísalos y borra esa marca al confirmarlos.
                </p>
            )}

            <div style={{ display: 'grid', gap: '1.25rem' }}>
                {temas.map(t => (
                    <div key={t.id} style={{ opacity: t.activo ? 1 : 0.5 }}>
                        <div style={{
                            display: 'flex', alignItems: 'baseline',
                            justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem',
                        }}>
                            <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.tema}</label>
                            <button
                                type="button"
                                onClick={() => alternar(t)}
                                style={{
                                    background: 'none', border: 0, padding: 0, cursor: 'pointer',
                                    font: 'inherit', fontSize: '0.78rem', color: 'var(--text-secondary)',
                                    textDecoration: 'underline', textUnderlineOffset: 3,
                                }}
                            >
                                {t.activo ? 'No usar este tema' : 'Volver a usarlo'}
                            </button>
                        </div>
                        <textarea
                            value={borradores[t.id] ?? ''}
                            onChange={e => setBorradores({ ...borradores, [t.id]: e.target.value })}
                            rows={3}
                            style={{
                                width: '100%', padding: '0.7rem 0.85rem',
                                border: '1px solid var(--hairline, #E6DED3)', borderRadius: 2,
                                font: 'inherit', fontSize: '0.88rem', lineHeight: 1.55,
                                resize: 'vertical', background: 'var(--bg-color, #fff)',
                                color: 'var(--ink, #1C1714)',
                            }}
                        />
                        {borradores[t.id] !== t.contenido && (
                            <button
                                className="admin-btn"
                                style={{ marginTop: '0.5rem' }}
                                onClick={() => guardar(t)}
                                disabled={guardando === t.id}
                            >
                                {guardando === t.id ? 'Guardando…' : `Guardar ${t.tema.toLowerCase()}`}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {aviso.msg && (
                <p style={{
                    fontSize: '0.85rem', marginTop: '1rem', marginBottom: 0,
                    color: aviso.tipo === 'error' ? 'var(--error-ink)' : 'var(--oro-ink)',
                }}>
                    {aviso.msg}
                </p>
            )}
        </div>
    );
};

/* ─── SettingsSection ────────────────────────────────────────────── */
const SettingsSection = () => {
    const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('admin_webhook_url') || '');
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState('');
    /* Las de fábrica salen de src/lib/respuestasRapidas.js, que es donde viven
       ahora. Antes estaban escritas aquí otra vez, en formato de cadena, y en
       ChatPanel.jsx en formato de array: las dos copias apuntaban a un dominio
       que no existe y había que acordarse de los dos sitios para arreglarlo. */
    const [quickReplies, setQuickReplies] = useState(
        () => localStorage.getItem(CLAVE_RESPUESTAS) || comoTexto(RESPUESTAS_POR_DEFECTO)
    );
    const [qrSaved, setQrSaved] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('admin_sound_enabled') !== 'false');

    // Admin users
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [adminCreating, setAdminCreating] = useState(false);
    const [adminResult, setAdminResult] = useState({ type: '', msg: '' });
    const [adminUsers, setAdminUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    /* Administrar cuentas es sólo del dueño. Sin esto, quien no lo es veía
       "No se pudieron cargar los usuarios" y quedaba pensando que algo falló. */
    const [sinPermiso, setSinPermiso] = useState(false);

    const adminApiCall = async (body) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { error: 'No hay sesión activa' };
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text || `Error del servidor (${res.status})` }; }
        // 403: la sesión es válida, pero no es la del dueño.
        if (res.status === 403) data.sinPermiso = true;
        return data;
    };

    const fetchAdminUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await adminApiCall({ action: 'list' });
            if (data && data.users) {
                setAdminUsers(data.users);
                setSinPermiso(false);
            } else if (data && data.sinPermiso) {
                setSinPermiso(true);
                setAdminUsers([]);
            }
        } catch (err) {
            console.error('Error fetching admin users:', err);
        }
        setLoadingUsers(false);
    };

    useEffect(() => {
        fetchAdminUsers();
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user) setCurrentUserId(session.user.id);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAdminUsers no está memorizada y esto tiene que correr una sola vez, al montar.
    }, []);

    const handleDeleteAdmin = async (userId) => {
        setDeletingId(userId);
        try {
            const data = await adminApiCall({ action: 'delete', userId });
            if (data.error) {
                setAdminResult({ type: 'error', msg: data.error });
            } else {
                fetchAdminUsers();
            }
        } catch (e) {
            setAdminResult({ type: 'error', msg: e.message });
        }
        setDeletingId(null);
        setConfirmDelete(null);
    };

    const handleSave = () => {
        localStorage.setItem('admin_webhook_url', webhookUrl.trim());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleSaveQuickReplies = () => {
        localStorage.setItem(CLAVE_RESPUESTAS, quickReplies);
        setQrSaved(true);
        setTimeout(() => setQrSaved(false), 2000);
    };

    const handleToggleSound = () => {
        const newVal = !soundEnabled;
        setSoundEnabled(newVal);
        localStorage.setItem('admin_sound_enabled', String(newVal));
    };

    const handleTest = async () => {
        const url = webhookUrl.trim();
        if (!url) { setTestResult('Ingresa una URL primero.'); return; }
        setTesting(true); setTestResult('');
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'test',
                    message: 'Test webhook from Aurem Gs Admin Panel',
                    timestamp: new Date().toISOString(),
                }),
            });
            setTestResult(res.ok ? 'Webhook enviado correctamente.' : `Error: HTTP ${res.status}`);
        } catch (e) {
            setTestResult(`Error: ${e.message}`);
        }
        setTesting(false);
    };

    const handleCreateAdmin = async () => {
        if (!adminEmail.trim() || !adminPass.trim()) {
            setAdminResult({ type: 'error', msg: 'Email y contraseña son obligatorios.' });
            return;
        }
        if (adminPass.length < 6) {
            setAdminResult({ type: 'error', msg: 'La contraseña debe tener al menos 6 caracteres.' });
            return;
        }
        setAdminCreating(true);
        setAdminResult({ type: '', msg: '' });
        try {
            const data = await adminApiCall({ email: adminEmail.trim(), password: adminPass });
            if (data.error) {
                setAdminResult({ type: 'error', msg: data.error });
            } else {
                setAdminResult({ type: 'success', msg: `Administrador ${data.user.email} creado correctamente.` });
                setAdminEmail('');
                setAdminPass('');
                fetchAdminUsers();
            }
        } catch (e) {
            setAdminResult({ type: 'error', msg: `Error de conexión: ${e.message}` });
        }
        setAdminCreating(false);
    };

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <div>
                    <h1 className="admin-section-title">Ajustes</h1>
                    <p className="admin-section-sub">Configuración del panel de administración</p>
                </div>
            </div>

            <GuiaDelCircuito />

            <PrecioOroCard />

            <ConocimientoCard />

            {/* Alta de administradores — sólo la ve quien puede usarla */}
            {!sinPermiso && (
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            Agregar administrador
                        </span>
                    </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                    Crea una cuenta para un empleado o colaborador. Tendrá acceso completo al panel de administración.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="modal-field">
                        <label>Correo electrónico</label>
                        <input
                            type="email"
                            value={adminEmail}
                            onChange={e => setAdminEmail(e.target.value)}
                            placeholder="empleado@email.com"
                        />
                    </div>
                    <div className="modal-field">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            value={adminPass}
                            onChange={e => setAdminPass(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                    <div>
                        <button className="admin-btn" onClick={handleCreateAdmin} disabled={adminCreating || sinPermiso}>
                            {adminCreating ? 'Creando...' : 'Crear administrador'}
                        </button>
                    </div>
                    {adminResult.msg && (
                        <p style={{ fontSize: '0.85rem', color: adminResult.type === 'error' ? 'var(--error-ink)' : 'var(--oro-ink)', margin: 0 }}>
                            {adminResult.msg}
                        </p>
                    )}
                </div>
            </div>
            )}

            {/* Admin users list */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                            Administradores
                        </span>
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{adminUsers.length}{' '}usuarios</span>
                </div>
                {loadingUsers ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Cargando...</p>
                ) : sinPermiso ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0', lineHeight: 1.5 }}>
                        Las cuentas del panel las administra el dueño.<br />
                        Si necesitas dar de alta a alguien, pídeselo.
                    </p>
                ) : adminUsers.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No se pudieron cargar los usuarios.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {adminUsers.map(u => (
                            <div key={u.id} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.75rem 0.85rem', borderRadius: '12px', background: 'var(--bg-marfil)',
                                transition: 'background 0.15s',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: u.id === currentUserId ? 'linear-gradient(135deg, var(--ink), var(--ink-soft))' : 'var(--bg-arena)',
                                    color: u.id === currentUserId ? '#fff' : 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.82rem', fontWeight: 800, flexShrink: 0,
                                }}>
                                    {(u.email || '?')[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' }}>
                                        {u.email}
                                        {u.id === currentUserId && (
                                            <span style={{
                                                marginLeft: '0.5rem', fontSize: '0.62rem', fontWeight: 700,
                                                background: 'var(--bg-arena)', color: 'var(--oro-ink)', padding: '2px 7px',
                                                borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                            }}>Tú</span>
                                        )}
                                        {u.esDueno && (
                                            <span style={{
                                                marginLeft: '0.5rem', fontSize: '0.62rem', fontWeight: 700,
                                                background: 'var(--oro-velo, #f3ead6)', color: 'var(--oro-ink, #7A5F26)',
                                                padding: '2px 7px', borderRadius: '100px',
                                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                            }}>Dueño</span>
                                        )}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        Desde {fmtDate(u.created_at)}
                                    </p>
                                </div>
                                {/* Ni a uno mismo ni al dueño: el servidor también los rechaza,
                                    pero ofrecer un botón que siempre falla no es ofrecer nada. */}
                                {u.id !== currentUserId && !u.esDueno && (
                                    <button
                                        className="admin-action-btn admin-action-btn--delete"
                                        onClick={() => setConfirmDelete(u)}
                                        disabled={deletingId === u.id}
                                    >
                                        {deletingId === u.id ? '...' : 'Eliminar'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Confirm delete admin modal */}
            {confirmDelete && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
                    <div className="modal-box" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Eliminar administrador</h2>
                            <button className="modal-close" onClick={() => setConfirmDelete(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.6 }}>
                                ¿Estás seguro de eliminar a <strong>{confirmDelete.email}</strong>? Ya no podrá acceder al panel de administración.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="admin-btn admin-btn--outline" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                            <button className="admin-btn admin-btn--danger" onClick={() => handleDeleteAdmin(confirmDelete.id)} disabled={deletingId === confirmDelete.id}>
                                {deletingId === confirmDelete.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Webhook */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                            Webhook URL
                        </span>
                    </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Recibe notificaciones cuando cambia el estado de un pedido. Se enviará un POST con los datos del pedido.
                </p>
                <div className="modal-field">
                    <label>URL del webhook</label>
                    <input
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="http://localhost:5678/webhook/notificacion-estado-pedido"
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
                    <button className="admin-btn" onClick={handleSave}>
                        {saved ? 'Guardado!' : 'Guardar'}
                    </button>
                    <button className="admin-btn admin-btn--outline" onClick={handleTest} disabled={testing}>
                        {testing ? 'Enviando...' : 'Probar webhook'}
                    </button>
                </div>
                {testResult && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: testResult.startsWith('Error') ? 'var(--error-ink)' : 'var(--oro-ink)' }}>
                        {testResult}
                    </p>
                )}
            </div>

            {/* Chat webhook */}
                        {/* Quick replies */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            Respuestas rapidas
                        </span>
                    </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Plantillas para responder rapido en el chat. Formato: <code>emoji label|texto de respuesta</code>, una por linea.
                </p>
                <div className="modal-field">
                    <label>Plantillas</label>
                    <textarea
                        value={quickReplies}
                        onChange={e => setQuickReplies(e.target.value)}
                        rows={8}
                        style={{ fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.5 }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
                    <button className="admin-btn" onClick={handleSaveQuickReplies}>
                        {qrSaved ? 'Guardado!' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Sound notification */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
                            Notificaciones
                        </span>
                    </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 500 }}>Sonido de notificacion</p>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Reproducir sonido al recibir mensaje nuevo</p>
                    </div>
                    <button
                        onClick={handleToggleSound}
                        style={{
                            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                            background: soundEnabled ? 'var(--oro)' : 'var(--hairline)', position: 'relative',
                            transition: 'background 0.2s',
                        }}
                    >
                        <span style={{
                            position: 'absolute', top: 3, left: soundEnabled ? 25 : 3,
                            width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-color)',
                            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsSection;
