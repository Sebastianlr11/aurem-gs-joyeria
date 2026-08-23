/**
 * Los componentes que comparten varias secciones del panel: las insignias de
 * estado y canal, y los modales de confirmar, despachar y editar una clienta.
 *
 * Van aparte de `comunes.js` por una razón de herramienta, no de gusto: la
 * regla `react-refresh/only-export-components` prohíbe que un archivo exporte
 * componentes y constantes a la vez, porque entonces el recargado en caliente
 * deja de funcionar y hay que refrescar a mano.
 */
import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { CARRIERS, EMPTY_CUSTOMER, SOURCE_META, STATUS_META, fmt } from './comunes';

export const ConfirmModal = ({ title, text, onClose, onConfirm }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    /* Se mira el error. Antes esto hacía el borrado y cerraba sin comprobar
       nada: si RLS o una clave foránea lo bloqueaban, la fila seguía ahí y el
       panel decía que no. Un borrado que falla en silencio es peor que uno
       que falla, porque nadie lo va a volver a intentar. */
    const confirmar = async () => {
        setLoading(true); setError('');
        try {
            const res = await onConfirm();
            if (res?.error) { setError(res.error.message); return; }
        } catch (e) {
            setError(e?.message || 'No se pudo completar.');
            return;
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="confirm-modal">
                <div className="confirm-modal-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-text">{text}</p>
                {error && <p className="ep-error" style={{ textAlign: 'left' }}>No se pudo eliminar: {error}</p>}
                <div className="confirm-modal-actions">
                    <button className="confirm-modal-btn confirm-modal-btn--cancel" onClick={onClose}>Cancelar</button>
                    <button className="confirm-modal-btn confirm-modal-btn--delete" onClick={confirmar} disabled={loading}>
                        {loading ? 'Eliminando...' : 'Eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   SECTIONS
═══════════════════════════════════════════════════════════════════ */

/* ─── DashboardHome ──────────────────────────────────────────────── */

/* Los días que tiene el taller para despachar, no para entregar: cuando la
   pieza sale por la puerta, el trabajo del taller terminó y lo que queda es
   la transportadora.

   Son 3 porque así trabaja el taller —el pedido llega, y se despacha al
   segundo o tercer día—, y con el envío la clienta la recibe en 3 a 4 días en
   Bogotá. Antes esto decía 8, tomado del "5 a 8 días" que Valentina promete;
   pero ese plazo es de las piezas A MEDIDA, las que se diseñan desde cero, no
   del catálogo. Contar 8 aquí daba cinco días de holgura que no existen y la
   cola no habría avisado hasta que el pedido ya estuviera perdido. */

export const CustomerModal = ({ customer, onClose, onSaved }) => {
    const isEdit = !!customer?.id;
    const [form, setForm] = useState(isEdit ? { ...customer } : { ...EMPTY_CUSTOMER });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault(); setError('');
        if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
        setSaving(true);
        const payload = { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, notes: form.notes.trim() || null };
        let err;
        if (isEdit) ({ error: err } = await supabase.from('customers').update(payload).eq('id', customer.id));
        else ({ error: err } = await supabase.from('customers').insert([payload]));
        setSaving(false);
        if (err) {
            /* El teléfono es único por sus últimos diez dígitos, no por la
               cadena: la misma persona guardada como 3143602930, +573143602930
               y 573143602930 aparecía tres veces en Clientes, y desde el 23 de
               agosto de 2026 la base lo impide. Sin esto, quien intente
               guardarla otra vez lee «duplicate key value violates unique
               constraint», que no le dice ni qué pasó ni qué hacer. */
            const repetido = err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || '');
            setError(repetido
                ? 'Ese teléfono ya está guardado, aunque lo escribas con otro formato. Búscalo en la lista y edítalo.'
                : err.message);
            return;
        }
        onSaved();
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box modal-box--sm">
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    {error && <p className="admin-error">{error}</p>}
                    <div className="modal-field">
                        <label>Nombre *</label>
                        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del cliente" />
                    </div>
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Telefono</label>
                            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+57 300 000 0000" />
                        </div>
                        <div className="modal-field">
                            <label>Email</label>
                            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
                        </div>
                    </div>
                    <div className="modal-field">
                        <label>Notas</label>
                        <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observaciones del cliente..." />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="admin-btn" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Agregar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ─── ConfirmModal ───────────────────────────────────────────────── */

export const ShipModal = ({ order, onClose, onConfirm }) => {
    const [carrier, setCarrier] = useState(order.carrier || '');
    const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        await onConfirm(carrier, trackingNumber);
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box modal-box--sm">
                <div className="modal-header">
                    <h2 className="modal-title">Datos de envio</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Pedido de <strong>{order.customer_name}</strong> — {order.product_name}
                    </p>
                    <div className="modal-field">
                        <label>Transportadora *</label>
                        <select value={carrier} onChange={e => setCarrier(e.target.value)} required>
                            <option value="">— Seleccionar —</option>
                            {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="modal-field">
                        <label>Numero de guia</label>
                        <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Numero de seguimiento" />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="admin-btn" disabled={saving}>{saving ? 'Guardando...' : 'Marcar como enviado'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ─── StatusConfirmModal ─────────────────────────────────────────── */

export const SourceBadge = ({ source }) => {
    const meta = SOURCE_META[source] || SOURCE_META.web;
    return <span className="source-badge">{meta.label}</span>;
};

/* ═══════════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════════ */

/* ─── Ventas por origen ──────────────────────────────────────────────
   El único número honesto de atribución que vas a tener.

   Meta y TikTok se cuelgan medallas de más: si alguien vio anuncios en las
   dos, las dos se atribuyen la misma venta, y sumar sus paneles te da más
   ventas de las que hiciste. Esto se calcula desde tus propios pedidos, con
   el identificador de clic que quedó pegado a cada uno, y por construcción
   suma exactamente lo que vendiste.

   El orden importa: se mira primero lo que es prueba directa —el ctwa_clid
   de un anuncio de WhatsApp, el ttclid de TikTok— y sólo después las UTMs,
   que se pueden perder o pegar a mano. */

export const StatusBadge = ({ status }) => (
    <span className={`status-badge ${STATUS_META[status]?.cls ?? ''}`}>
        {STATUS_META[status]?.label ?? status}
    </span>
);

/* ─── SourceBadge ────────────────────────────────────────────────── */

export const StatusConfirmModal = ({ order, nextStatus, onClose, onConfirm }) => {
    const [loading, setLoading] = useState(false);
    const meta = STATUS_META[nextStatus];
    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box modal-box--sm">
                <div className="modal-header">
                    <h2 className="modal-title">Cambiar estado</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <div style={{ padding: '1.25rem 1.75rem 0' }}>
                    <p style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.6 }}>
                        Cambiar el pedido de <strong>{order.customer_name}</strong> a:
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.75rem' }}>
                        <StatusBadge status={order.status} />
                        <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                        <StatusBadge status={nextStatus} />
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                        Producto: {order.product_name} &middot; ${fmt(order.amount)} COP
                    </p>
                </div>
                <div className="modal-actions" style={{ padding: '1.25rem 1.75rem 1.75rem' }}>
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                    <button className="admin-btn" onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }} disabled={loading}>
                        {loading ? 'Cambiando...' : meta?.label || 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── CustomerModal ──────────────────────────────────────────────── */
