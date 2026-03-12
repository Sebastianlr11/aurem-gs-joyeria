import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/* ─── Constants ──────────────────────────────────────────────────── */
const CATEGORIES = ['Anillos', 'Collares', 'Aretes', 'Pulseras'];
const ORDER_STATUSES = ['pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado'];
const STATUS_META = {
    pendiente:  { label: 'Pendiente',   cls: 'badge--yellow' },
    pagado:     { label: 'Pagado',      cls: 'badge--green'  },
    procesando: { label: 'Procesando',  cls: 'badge--orange' },
    enviado:    { label: 'Enviado',     cls: 'badge--purple' },
    entregado:  { label: 'Entregado',   cls: 'badge--blue'   },
    cancelado:  { label: 'Cancelado',   cls: 'badge--red'    },
    confirmado: { label: 'Confirmado',  cls: 'badge--blue'   }, // legacy
};

/* Flujo pago anticipado: pendiente → pagado → procesando → enviado → entregado */
const NEXT_ACTION_PREPAID = {
    pendiente:  { next: 'pagado',     label: 'Confirmar pago',    cls: 'action--green' },
    pagado:     { next: 'procesando', label: 'Procesar',          cls: 'action--blue' },
    procesando: { next: 'enviado',    label: 'Marcar enviado',    cls: 'action--purple' },
    enviado:    { next: 'entregado',  label: 'Marcar entregado',  cls: 'action--teal' },
};

/* Flujo contraentrega: pendiente → procesando → enviado → entregado → pagado */
const NEXT_ACTION_COD = {
    pendiente:  { next: 'procesando', label: 'Procesar',          cls: 'action--blue' },
    procesando: { next: 'enviado',    label: 'Marcar enviado',    cls: 'action--purple' },
    enviado:    { next: 'entregado',  label: 'Marcar entregado',  cls: 'action--teal' },
    entregado:  { next: 'pagado',     label: 'Confirmar pago',    cls: 'action--green' },
};

const isCOD = (order) => order.payment_method === 'contraentrega';
const getNextAction = (order) => (isCOD(order) ? NEXT_ACTION_COD : NEXT_ACTION_PREPAID)[order.status];

const WA_MESSAGES = {
    pagado: (o) => `Hola ${o.customer_name}! \u{1F389} Tu pedido de "${o.product_name}" en Aurem Gs Joyeria fue recibido con exito. Estamos preparandolo. Te mantendremos informado!`,
    procesando: (o) => `Hola ${o.customer_name}! Tu pedido de "${o.product_name}" esta siendo procesado. Pronto te enviaremos los detalles del envio. \u2728`,
    enviado: (o) => `Hola ${o.customer_name}! Tu pedido de "${o.product_name}" fue enviado${o.carrier ? ` por ${o.carrier}` : ''}${o.tracking_number ? `. Numero de guia: ${o.tracking_number}` : ''}. Pronto lo recibiras! \u{1F4E6}`,
    entregado: (o) => `Hola ${o.customer_name}! Esperamos que estes disfrutando tu "${o.product_name}" de Aurem Gs Joyeria. Gracias por tu compra! \u{1F48E}`,
    pendiente: (o) => `Hola ${o.customer_name}! Vimos que tienes un pedido pendiente de "${o.product_name}" en Aurem Gs Joyeria. Podemos ayudarte a completarlo?`,
    cancelado: (o) => `Hola ${o.customer_name}, tu pedido de "${o.product_name}" ha sido cancelado. Si tienes alguna duda o quieres hacer un nuevo pedido, escribenos con gusto.`,
};

const SOURCE_META = {
    web:      { label: 'Web',      cls: 'source--blue' },
    whatsapp: { label: 'WhatsApp', cls: 'source--green' },
    tiktok:   { label: 'TikTok',   cls: 'source--pink' },
    manual:   { label: 'Manual',   cls: 'source--gray' },
};

const CARRIERS = ['Servientrega', 'Interrapidisimo', 'Coordinadora', 'Otro'];

const REVENUE_STATUSES = ['pagado', 'procesando', 'enviado', 'entregado'];

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const fmtDate = d => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const EMPTY_PRODUCT  = { name:'', category:'Anillos', price:'', compare_price:'', description:'', image_url:'', is_new:false, is_featured:false };
const EMPTY_ORDER    = { customer_name:'', customer_phone:'', customer_email:'', product_id:'', product_name:'', amount:'', status:'pendiente', payment_method:'', notes:'', carrier:'', tracking_number:'', shipping_address:'', shipping_city:'', shipping_department:'' };
const PAYMENT_METHODS = ['MercadoPago', 'Nequi', 'Daviplata', 'Transferencia', 'Efectivo', 'Contraentrega'];
const EMPTY_CUSTOMER = { name:'', phone:'', email:'', notes:'' };

/* ─── Webhook helper ─────────────────────────────────────────────── */
const fireWebhook = async (order, newStatus) => {
    const url = localStorage.getItem('admin_webhook_url');
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'order_status_changed', order: { ...order, status: newStatus }, timestamp: new Date().toISOString() }),
        });
    } catch (e) { console.error('Webhook error:', e); }
};

/* ─── Sidebar nav items ──────────────────────────────────────────── */
const NAV = [
    {
        id: 'dashboard', label: 'Dashboard',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
    },
    {
        id: 'products', label: 'Productos',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    },
    {
        id: 'orders', label: 'Pedidos',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
    },
    {
        id: 'customers', label: 'Clientes',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    },
    {
        id: 'reports', label: 'Reportes',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    },
    {
        id: 'notes', label: 'Anotaciones',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    },
    {
        id: 'settings', label: 'Ajustes',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    },
];

/* ─── StatusBadge ────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => (
    <span className={`status-badge ${STATUS_META[status]?.cls ?? ''}`}>
        {STATUS_META[status]?.label ?? status}
    </span>
);

/* ─── SourceBadge ────────────────────────────────────────────────── */
const SourceBadge = ({ source }) => {
    const meta = SOURCE_META[source] || SOURCE_META.web;
    return <span className={`source-badge ${meta.cls}`}>{meta.label}</span>;
};

/* ═══════════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════════ */

/* ─── ProductModal ───────────────────────────────────────────────── */
const ProductModal = ({ product, onClose, onSaved }) => {
    const isEdit = !!product?.id;
    const [form, setForm] = useState(isEdit ? { ...product } : { ...EMPTY_PRODUCT });
    const [images, setImages] = useState(isEdit ? (product.images || []) : []);
    const [urlInput, setUrlInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const uploadFile = async (file) => {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('product-images').getPublicUrl(path);
        return data.publicUrl;
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setError(''); setUploadingCount(files.length);
        const results = await Promise.allSettled(files.map(f => uploadFile(f)));
        const urls = [], failed = [];
        results.forEach((r, i) => r.status === 'fulfilled' ? urls.push(r.value) : failed.push(files[i].name));
        if (urls.length) setImages(prev => [...prev, ...urls]);
        if (failed.length) setError(`Error al subir: ${failed.join(', ')}`);
        setUploadingCount(0); e.target.value = '';
    };

    const addUrl = () => {
        const url = urlInput.trim();
        if (!url) return;
        setImages(prev => [...prev, url]); setUrlInput('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError('');
        if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
        if (!form.price || isNaN(Number(form.price))) { setError('El precio debe ser un numero.'); return; }
        setSaving(true);
        const payload = {
            name: form.name.trim(), category: form.category,
            price: Number(form.price),
            compare_price: form.compare_price && Number(form.compare_price) > Number(form.price) ? Number(form.compare_price) : null,
            description: form.description.trim() || null,
            images, image_url: images[0] || form.image_url.trim() || null,
            is_new: form.is_new, is_featured: form.is_featured,
        };
        let err;
        if (isEdit) ({ error: err } = await supabase.from('products').update(payload).eq('id', product.id));
        else ({ error: err } = await supabase.from('products').insert([payload]));
        setSaving(false);
        if (err) { setError(err.message); return; }
        onSaved();
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    {error && <p className="admin-error">{error}</p>}
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Nombre *</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Anillo Solitario Oro" required />
                        </div>
                        <div className="modal-field">
                            <label>Categoria *</label>
                            <select value={form.category} onChange={e => set('category', e.target.value)}>
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Precio oferta (COP) *</label>
                            <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" required />
                        </div>
                        <div className="modal-field">
                            <label>Precio anterior — opcional</label>
                            <input type="number" min="0" step="0.01" value={form.compare_price || ''} onChange={e => set('compare_price', e.target.value)} placeholder="Dejar vacio si no hay oferta" />
                        </div>
                    </div>
                    <div className="modal-field">
                        <label>Descripcion</label>
                        <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripcion breve de la pieza..." />
                    </div>
                    <div className="modal-field">
                        <label>Imagenes del producto</label>
                        <p className="modal-img-hint">Sube al menos 3 fotos. La primera es la portada.</p>
                        <div className="modal-images-grid">
                            {images.map((url, idx) => (
                                <div key={idx} className="modal-img-thumb">
                                    <img src={url} alt="" onError={e => { e.currentTarget.style.opacity = '0.3'; }} />
                                    <button type="button" className="modal-img-thumb-remove" onClick={() => setImages(p => p.filter((_, i) => i !== idx))}>&#x2715;</button>
                                    {idx === 0 && <span className="modal-img-cover-badge">PORTADA</span>}
                                </div>
                            ))}
                            {Array.from({ length: uploadingCount }).map((_, i) => <div key={`up-${i}`} className="modal-img-thumb modal-img-thumb--uploading" />)}
                            <label className="modal-img-add" title="Agregar fotos">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} disabled={uploadingCount > 0} />
                            </label>
                        </div>
                        <div className="modal-img-row" style={{ marginTop: '0.75rem' }}>
                            <input className="modal-img-url-input" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="O pegar URL de imagen..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())} />
                            <button type="button" className="admin-btn admin-btn--outline" onClick={addUrl} style={{ whiteSpace: 'nowrap' }}>+ Agregar</button>
                        </div>
                    </div>
                    <div className="modal-checks">
                        <label className="modal-check-label"><input type="checkbox" checked={form.is_new} onChange={e => set('is_new', e.target.checked)} /> Nuevo</label>
                        <label className="modal-check-label"><input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} /> Destacado</label>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="admin-btn" disabled={saving || uploadingCount > 0}>{saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ─── OrderModal ─────────────────────────────────────────────────── */
const OrderModal = ({ order, products, onClose, onSaved }) => {
    const isEdit = !!order?.id;
    const [form, setForm] = useState(isEdit ? { ...order, product_id: order.product_id || '', carrier: order.carrier || '', tracking_number: order.tracking_number || '' } : { ...EMPTY_ORDER });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleProductSelect = (e) => {
        const pid = e.target.value;
        if (!pid) { setForm(f => ({ ...f, product_id: '', product_name: '', amount: '' })); return; }
        const p = products.find(x => x.id === pid);
        if (p) setForm(f => ({ ...f, product_id: pid, product_name: p.name, amount: String(p.price) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError('');
        if (!form.customer_name.trim()) { setError('Nombre del cliente obligatorio.'); return; }
        if (!form.product_name.trim())  { setError('Nombre del producto obligatorio.'); return; }
        if (!form.amount || isNaN(Number(form.amount))) { setError('Monto invalido.'); return; }
        setSaving(true);
        const payload = {
            customer_name: form.customer_name.trim(),
            customer_phone: form.customer_phone.trim() || null,
            customer_email: form.customer_email?.trim() || null,
            product_id: form.product_id || null,
            product_name: form.product_name.trim(),
            amount: Number(form.amount),
            status: form.status,
            payment_method: form.payment_method || null,
            notes: form.notes.trim() || null,
            carrier: form.carrier?.trim() || null,
            tracking_number: form.tracking_number?.trim() || null,
            shipping_address: form.shipping_address?.trim() || null,
            shipping_city: form.shipping_city?.trim() || null,
            shipping_department: form.shipping_department?.trim() || null,
        };
        if (!isEdit) {
            payload.order_source = 'manual';
        }
        let err;
        if (isEdit) ({ error: err } = await supabase.from('orders').update(payload).eq('id', order.id));
        else ({ error: err } = await supabase.from('orders').insert([payload]));
        setSaving(false);
        if (err) { setError(err.message); return; }
        onSaved();
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    {error && <p className="admin-error">{error}</p>}
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Cliente *</label>
                            <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Nombre del cliente" />
                        </div>
                        <div className="modal-field">
                            <label>Telefono / WhatsApp</label>
                            <input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="+57 300 000 0000" />
                        </div>
                    </div>
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Seleccionar producto</label>
                            <select value={form.product_id} onChange={handleProductSelect}>
                                <option value="">— Buscar en catalogo —</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="modal-field">
                            <label>Producto *</label>
                            <input value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="Nombre del producto" />
                        </div>
                    </div>
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Monto COP *</label>
                            <input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
                        </div>
                        <div className="modal-field">
                            <label>Estado</label>
                            <select value={form.status} onChange={e => set('status', e.target.value)}>
                                {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="modal-field">
                        <label>Método de pago</label>
                        <select value={form.payment_method || ''} onChange={e => set('payment_method', e.target.value)}>
                            <option value="">— Seleccionar —</option>
                            {PAYMENT_METHODS.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                        </select>
                    </div>
                    {!isEdit ? (
                        <>
                            <div className="modal-field">
                                <label>Correo electrónico</label>
                                <input value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="cliente@email.com" />
                            </div>
                            <div className="modal-field">
                                <label>Dirección de envío</label>
                                <input value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} placeholder="Calle, número, barrio..." />
                            </div>
                            <div className="modal-row">
                                <div className="modal-field">
                                    <label>Ciudad</label>
                                    <input value={form.shipping_city} onChange={e => set('shipping_city', e.target.value)} placeholder="Ej: Bogotá" />
                                </div>
                                <div className="modal-field">
                                    <label>Departamento</label>
                                    <input value={form.shipping_department} onChange={e => set('shipping_department', e.target.value)} placeholder="Ej: Cundinamarca" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="modal-field">
                                <label>Correo electrónico</label>
                                <input value={form.customer_email || ''} onChange={e => set('customer_email', e.target.value)} placeholder="cliente@email.com" />
                            </div>
                            <div className="modal-field">
                                <label>Dirección de envío</label>
                                <input value={form.shipping_address || ''} onChange={e => set('shipping_address', e.target.value)} placeholder="Calle, número, barrio..." />
                            </div>
                            <div className="modal-row">
                                <div className="modal-field">
                                    <label>Ciudad</label>
                                    <input value={form.shipping_city || ''} onChange={e => set('shipping_city', e.target.value)} placeholder="Ej: Bogotá" />
                                </div>
                                <div className="modal-field">
                                    <label>Departamento</label>
                                    <input value={form.shipping_department || ''} onChange={e => set('shipping_department', e.target.value)} placeholder="Ej: Cundinamarca" />
                                </div>
                            </div>
                            <div className="modal-row">
                                <div className="modal-field">
                                    <label>Transportadora</label>
                                    <select value={form.carrier} onChange={e => set('carrier', e.target.value)}>
                                        <option value="">— Sin transportadora —</option>
                                        {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="modal-field">
                                    <label>Número de guía</label>
                                    <input value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} placeholder="Número de seguimiento" />
                                </div>
                            </div>
                        </>
                    )}
                    <div className="modal-field">
                        <label>Notas</label>
                        <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas del pedido..." />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="admin-btn" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear pedido'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ─── ShipModal ──────────────────────────────────────────────────── */
const ShipModal = ({ order, onClose, onConfirm }) => {
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
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
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
const StatusConfirmModal = ({ order, nextStatus, onClose, onConfirm }) => {
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
                    <p style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
                        Cambiar el pedido de <strong>{order.customer_name}</strong> a:
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.75rem' }}>
                        <StatusBadge status={order.status} />
                        <span style={{ color: '#94a3b8' }}>&rarr;</span>
                        <StatusBadge status={nextStatus} />
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.75rem' }}>
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
const CustomerModal = ({ customer, onClose, onSaved }) => {
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
        if (err) { setError(err.message); return; }
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
const ConfirmModal = ({ title, text, onClose, onConfirm }) => {
    const [loading, setLoading] = useState(false);
    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box modal-box--sm">
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <p className="modal-delete-text">{text}</p>
                <div className="modal-actions">
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                    <button className="admin-btn admin-btn--danger" onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }} disabled={loading}>
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
const DashboardHome = ({ products, orders, customers, onNavigate }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const ordersMonth  = orders.filter(o => new Date(o.created_at) >= monthStart);
    const revenue      = ordersMonth.filter(o => REVENUE_STATUSES.includes(o.status)).reduce((s, o) => s + Number(o.amount), 0);
    const recentOrders = orders.slice(0, 6);

    const metrics = [
        {
            label: 'Productos', value: products.length, color: '#6366f1',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
        },
        {
            label: 'Pedidos este mes', value: ordersMonth.length, color: '#f59e0b',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
        },
        {
            label: 'Ingresos (pagados)', value: `$${fmt(revenue)}`, color: '#10b981', sub: 'COP este mes',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
        },
        {
            label: 'Clientes', value: customers.length, color: '#3b82f6',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
        },
    ];

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <h1 className="admin-section-title">Dashboard</h1>
                <p className="admin-section-sub">Bienvenido al panel de administracion de Aurem Gs Joyeria</p>
            </div>

            <div className="admin-metrics">
                {metrics.map(m => (
                    <div key={m.label} className="admin-metric-card" style={{ '--mc-color': m.color }}>
                        <div className="admin-metric-icon" style={{ background: m.color + '15', color: m.color }}>{m.icon}</div>
                        <div className="admin-metric-body">
                            <div className="admin-metric-value">{m.value}</div>
                            <div className="admin-metric-label">{m.label}</div>
                            {m.sub && <div className="admin-metric-sub">{m.sub}</div>}
                        </div>
                    </div>
                ))}
            </div>

            <div className="admin-home-grid">
                {/* Recent orders */}
                <div className="admin-card">
                    <div className="admin-card-head">
                        <h3 className="admin-card-title">Pedidos recientes</h3>
                        <button className="admin-card-link" onClick={() => onNavigate('orders')}>Ver todos &rarr;</button>
                    </div>
                    {recentOrders.length === 0 ? (
                        <p className="admin-empty-text">No hay pedidos aun.</p>
                    ) : (
                        <table className="admin-table">
                            <thead><tr><th>Cliente</th><th>Producto</th><th>Monto</th><th>Estado</th></tr></thead>
                            <tbody>
                                {recentOrders.map(o => (
                                    <tr key={o.id}>
                                        <td className="admin-td-name">{o.customer_name}</td>
                                        <td>{o.product_name}</td>
                                        <td className="admin-td-price">${fmt(o.amount)}</td>
                                        <td><StatusBadge status={o.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Status breakdown */}
                <div className="admin-card">
                    <div className="admin-card-head">
                        <h3 className="admin-card-title">Estado de pedidos</h3>
                    </div>
                    <div className="admin-status-list">
                        {ORDER_STATUSES.map(s => {
                            const count = orders.filter(o => o.status === s).length;
                            const pct = orders.length ? Math.round(count / orders.length * 100) : 0;
                            return (
                                <div key={s} className="admin-status-row">
                                    <StatusBadge status={s} />
                                    <div className="admin-status-bar-wrap">
                                        <div className="admin-status-bar" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="admin-status-count">{count}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="admin-card-head" style={{ marginTop: '1.5rem' }}>
                        <h3 className="admin-card-title">Productos por categoria</h3>
                    </div>
                    <div className="admin-status-list">
                        {CATEGORIES.map(cat => {
                            const count = products.filter(p => p.category === cat).length;
                            const pct = products.length ? Math.round(count / products.length * 100) : 0;
                            return (
                                <div key={cat} className="admin-status-row">
                                    <span className="admin-category-pill">{cat}</span>
                                    <div className="admin-status-bar-wrap">
                                        <div className="admin-status-bar admin-status-bar--gold" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="admin-status-count">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── ProductsSection ────────────────────────────────────────────── */
const ProductsSection = ({ products, loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('Todos');
    const [modal, setModal] = useState(null);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    const visible = products.filter(p => {
        const matchCat = filterCat === 'Todos' || p.category === filterCat;
        const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <div>
                    <h1 className="admin-section-title">Productos</h1>
                    <p className="admin-section-sub">{products.length} productos en el catalogo</p>
                </div>
                <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo producto
                </button>
            </div>

            <div className="admin-card">
                <div className="admin-toolbar">
                    <div className="admin-filters">
                        {['Todos', ...CATEGORIES].map(c => (
                            <button key={c} className={`filter-btn ${filterCat === c ? 'filter-btn--active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
                        ))}
                    </div>
                    <div className="admin-search-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="admin-search" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {loading ? <div className="admin-loading">Cargando productos...</div>
                : visible.length === 0 ? (
                    <div className="admin-empty">
                        <p>No hay productos{filterCat !== 'Todos' ? ` en "${filterCat}"` : ''}.</p>
                        <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>Agregar el primero</button>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Imagen</th><th>Nombre</th><th>Categoria</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {visible.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="admin-thumb">
                                                {p.image_url ? <img src={p.image_url} alt={p.name} onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }} /> : null}
                                                <div className="admin-thumb-placeholder" style={p.image_url ? { display:'none' } : {}}>&#x2726;</div>
                                            </div>
                                        </td>
                                        <td className="admin-td-name">{p.name}</td>
                                        <td><span className="admin-category-pill">{p.category}</span></td>
                                        <td className="admin-td-price">${fmt(p.price)}</td>
                                        <td>
                                            <div className="admin-badges">
                                                {p.is_new      && <span className="admin-badge admin-badge--new">Nuevo</span>}
                                                {p.is_featured && <span className="admin-badge admin-badge--featured">Destacado</span>}
                                                {p.compare_price && <span className="admin-badge admin-badge--offer">Oferta</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-actions">
                                                <button className="admin-action-btn admin-action-btn--edit" onClick={() => setModal({ type: 'edit', product: p })}>Editar</button>
                                                <button className="admin-action-btn admin-action-btn--delete" onClick={() => setModal({ type: 'delete', product: p })}>Eliminar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal?.type === 'add'    && <ProductModal onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit'   && <ProductModal product={modal.product} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'delete' && (
                <ConfirmModal
                    title="Eliminar producto"
                    text={`Seguro que quieres eliminar "${modal.product.name}"? Esta accion no se puede deshacer.`}
                    onClose={closeModal}
                    onConfirm={async () => { await supabase.from('products').delete().eq('id', modal.product.id); afterSave(); }}
                />
            )}
        </div>
    );
};

/* ─── OrdersSection ──────────────────────────────────────────────── */
const OrdersSection = ({ orders, products, loading, onRefresh }) => {
    const [search, setSearch]           = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterSource, setFilterSource] = useState('Todos');
    const [modal, setModal]             = useState(null);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    const visible = orders.filter(o => {
        const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
        const matchSource = filterSource === 'Todos' || (o.order_source || 'web') === filterSource;
        const matchSearch = !search.trim() || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.product_name.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch && matchSource;
    });

    const totalVisible = visible.reduce((s, o) => s + Number(o.amount), 0);

    /* Quick status change */
    const changeStatus = async (order, newStatus, extraFields = {}) => {
        const payload = { status: newStatus, status_updated_at: new Date().toISOString(), ...extraFields };
        const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
        if (error) { alert('Error: ' + error.message); return; }
        await fireWebhook(order, newStatus);
        onRefresh();
    };

    const handleQuickAction = (order) => {
        const action = getNextAction(order);
        if (!action) return;

        if (action.next === 'enviado') {
            setModal({ type: 'ship', order });
        } else {
            setModal({ type: 'confirm_status', order, nextStatus: action.next });
        }
    };

    const handleShipConfirm = async (carrier, trackingNumber) => {
        const order = modal.order;
        await changeStatus(order, 'enviado', {
            carrier: carrier || null,
            tracking_number: trackingNumber || null,
        });
        closeModal();
    };

    const getWaLink = (o) => {
        const phone = (o.customer_phone || '').replace(/\D/g, '');
        if (!phone) return null;
        const msgFn = WA_MESSAGES[o.status];
        const msg = msgFn ? msgFn(o) : `Hola ${o.customer_name}, gracias por tu compra en Aurem Gs Joyeria.`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    };

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <div>
                    <h1 className="admin-section-title">Pedidos</h1>
                    <p className="admin-section-sub">{orders.length} pedidos &middot; Total visible: ${fmt(totalVisible)} COP</p>
                </div>
                <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo pedido
                </button>
            </div>

            <div className="admin-card">
                <div className="admin-toolbar">
                    <div className="admin-filters" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                        {['Todos', ...ORDER_STATUSES].map(s => (
                            <button key={s} className={`filter-btn ${filterStatus === s ? 'filter-btn--active' : ''}`} onClick={() => setFilterStatus(s)}>
                                {s === 'Todos' ? 'Todos' : STATUS_META[s].label}
                            </button>
                        ))}
                        <span style={{ width: '1px', height: '20px', background: '#e0e0e0', margin: '0 0.25rem' }} />
                        {['Todos', ...Object.keys(SOURCE_META)].map(s => (
                            <button key={`src-${s}`} className={`filter-btn ${filterSource === s ? 'filter-btn--active' : ''}`} onClick={() => setFilterSource(s)}>
                                {s === 'Todos' ? 'Todos canales' : SOURCE_META[s].label}
                            </button>
                        ))}
                    </div>
                    <div className="admin-search-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="admin-search" placeholder="Buscar cliente o producto..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {loading ? <div className="admin-loading">Cargando pedidos...</div>
                : visible.length === 0 ? (
                    <div className="admin-empty">
                        <p>No hay pedidos{filterStatus !== 'Todos' ? ` con estado "${STATUS_META[filterStatus]?.label}"` : ''}.</p>
                        <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>Registrar primero</button>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Canal</th><th>Cliente</th><th>Producto</th><th>Monto</th><th>Pago</th><th>Estado</th><th>Detalles</th><th>Acción rápida</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {visible.map(o => {
                                    const action = getNextAction(o);
                                    const waLink = getWaLink(o);
                                    return (
                                    <tr key={o.id}>
                                        <td><SourceBadge source={o.order_source || 'web'} /></td>
                                        <td className="admin-td-name">{o.customer_name}</td>
                                        <td>{o.product_name}</td>
                                        <td className="admin-td-price">${fmt(o.amount)}</td>
                                        <td style={{fontSize:'0.82rem',color:'#666'}}>
                                            {o.payment_method
                                                ? <span style={isCOD(o) ? {background:'#fef3c7',color:'#92400e',padding:'2px 8px',borderRadius:'9999px',fontWeight:600,fontSize:'0.7rem',textTransform:'uppercase'} : {}}>
                                                    {o.payment_method}
                                                  </span>
                                                : <span style={{color:'#aaa'}}>&mdash;</span>
                                            }
                                        </td>
                                        <td><StatusBadge status={o.status} /></td>
                                        <td>
                                            <button
                                                className="admin-detail-btn"
                                                onClick={() => setModal({ type: 'detail', order: o })}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                Ver
                                            </button>
                                        </td>
                                        <td>
                                            {action && (
                                                <button
                                                    className={`admin-quick-action ${action.cls}`}
                                                    onClick={() => handleQuickAction(o)}
                                                >
                                                    {action.label}
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            <div className="admin-actions">
                                                {waLink && (
                                                    <a className="admin-action-btn admin-action-btn--wa" href={waLink} target="_blank" rel="noreferrer" title="WhatsApp">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.121.553 4.114 1.519 5.845L.525 23.5l5.793-.983A11.937 11.937 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.9 0-3.699-.496-5.254-1.368l-.377-.223-3.437.583.594-3.326-.244-.39A9.778 9.778 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                                                    </a>
                                                )}
                                                <button className="admin-action-btn admin-action-btn--edit admin-action-btn--sm" onClick={() => setModal({ type: 'edit', order: o })} title="Editar">Editar</button>
                                                <button className="admin-action-btn admin-action-btn--delete admin-action-btn--icon" onClick={() => setModal({ type: 'delete', order: o })} title="Eliminar">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal?.type === 'detail' && (() => {
                const o = modal.order;
                const addressParts = [o.shipping_address, o.shipping_city, o.shipping_department].filter(Boolean);
                const waLink = getWaLink(o);
                return (
                    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
                        <div className="od-modal">
                            {/* Close */}
                            <button className="od-close" onClick={closeModal}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>

                            {/* Hero header */}
                            <div className="od-hero">
                                <div className="od-hero-top">
                                    <StatusBadge status={o.status} />
                                    <SourceBadge source={o.order_source || 'web'} />
                                    {o.payment_method && (
                                        <span className={`od-pay-badge ${isCOD(o) ? 'od-pay-badge--cod' : ''}`}>{o.payment_method}</span>
                                    )}
                                </div>
                                <p className="od-hero-amount">${fmt(o.amount)}</p>
                                <p className="od-hero-product">{o.product_name}</p>
                                <p className="od-hero-date">{fmtDate(o.created_at)}</p>
                            </div>

                            {/* Cliente */}
                            <div className="od-section">
                                <p className="od-section-title">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Cliente
                                </p>
                                <div className="od-info-grid">
                                    <div className="od-info-item">
                                        <span className="od-info-label">Nombre</span>
                                        <span className="od-info-value">{o.customer_name}</span>
                                    </div>
                                    {o.customer_phone && (
                                        <div className="od-info-item">
                                            <span className="od-info-label">Teléfono</span>
                                            <span className="od-info-value">{o.customer_phone}</span>
                                        </div>
                                    )}
                                    {o.customer_email && (
                                        <div className="od-info-item">
                                            <span className="od-info-label">Correo</span>
                                            <span className="od-info-value">{o.customer_email}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Envío */}
                            {(addressParts.length > 0 || o.carrier) && (
                                <div className="od-section">
                                    <p className="od-section-title">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                                        Envío
                                    </p>
                                    <div className="od-info-grid">
                                        {addressParts.length > 0 && (
                                            <div className="od-info-item od-info-item--full">
                                                <span className="od-info-label">Dirección</span>
                                                <span className="od-info-value">{addressParts.join(', ')}</span>
                                            </div>
                                        )}
                                        {o.carrier && (
                                            <div className="od-info-item">
                                                <span className="od-info-label">Transportadora</span>
                                                <span className="od-info-value">{o.carrier}</span>
                                            </div>
                                        )}
                                        {o.tracking_number && (
                                            <div className="od-info-item">
                                                <span className="od-info-label">Guía</span>
                                                <span className="od-info-value" style={{ fontFamily: 'monospace' }}>{o.tracking_number}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Notas */}
                            {o.notes && (
                                <div className="od-section">
                                    <p className="od-section-title">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                        Notas
                                    </p>
                                    <div className="od-notes-box">{o.notes}</div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="od-actions">
                                {waLink && (
                                    <a className="od-action-btn od-action-btn--wa" href={waLink} target="_blank" rel="noreferrer">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.121.553 4.114 1.519 5.845L.525 23.5l5.793-.983A11.937 11.937 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.9 0-3.699-.496-5.254-1.368l-.377-.223-3.437.583.594-3.326-.244-.39A9.778 9.778 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                                        WhatsApp
                                    </a>
                                )}
                                <button className="od-action-btn od-action-btn--edit" onClick={() => setModal({ type: 'edit', order: o })}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Editar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {modal?.type === 'add'    && <OrderModal products={products} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit'   && <OrderModal order={modal.order} products={products} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'ship'   && <ShipModal order={modal.order} onClose={closeModal} onConfirm={handleShipConfirm} />}
            {modal?.type === 'confirm_status' && (
                <StatusConfirmModal
                    order={modal.order}
                    nextStatus={modal.nextStatus}
                    onClose={closeModal}
                    onConfirm={async () => { await changeStatus(modal.order, modal.nextStatus); closeModal(); }}
                />
            )}
            {modal?.type === 'delete' && (
                <ConfirmModal
                    title="Eliminar pedido"
                    text={`Eliminar el pedido de "${modal.order.customer_name}"?`}
                    onClose={closeModal}
                    onConfirm={async () => { await supabase.from('orders').delete().eq('id', modal.order.id); afterSave(); }}
                />
            )}
        </div>
    );
};

/* ─── CustomersSection ───────────────────────────────────────────── */
const CustomersSection = ({ customers, loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [modal, setModal]   = useState(null);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    const visible = customers.filter(c =>
        !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <div>
                    <h1 className="admin-section-title">Clientes</h1>
                    <p className="admin-section-sub">{customers.length} clientes registrados</p>
                </div>
                <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo cliente
                </button>
            </div>

            <div className="admin-card">
                <div className="admin-toolbar">
                    <div className="admin-search-wrap" style={{ maxWidth: 320 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="admin-search" placeholder="Buscar por nombre, telefono o email..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {loading ? <div className="admin-loading">Cargando clientes...</div>
                : visible.length === 0 ? (
                    <div className="admin-empty">
                        <p>No hay clientes registrados.</p>
                        <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>Agregar el primero</button>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Nombre</th><th>Telefono</th><th>Email</th><th>Notas</th><th>Registro</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {visible.map(c => (
                                    <tr key={c.id}>
                                        <td className="admin-td-name">{c.name}</td>
                                        <td>{c.phone || <span style={{color:'#aaa'}}>&mdash;</span>}</td>
                                        <td>{c.email || <span style={{color:'#aaa'}}>&mdash;</span>}</td>
                                        <td style={{maxWidth:200,fontSize:'0.82rem',color:'#666'}}>{c.notes || <span style={{color:'#aaa'}}>&mdash;</span>}</td>
                                        <td style={{fontSize:'0.82rem',color:'#666'}}>{fmtDate(c.created_at)}</td>
                                        <td>
                                            <div className="admin-actions">
                                                <button className="admin-action-btn admin-action-btn--edit" onClick={() => setModal({ type: 'edit', customer: c })}>Editar</button>
                                                <button className="admin-action-btn admin-action-btn--delete" onClick={() => setModal({ type: 'delete', customer: c })}>Eliminar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal?.type === 'add'    && <CustomerModal onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit'   && <CustomerModal customer={modal.customer} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'delete' && (
                <ConfirmModal
                    title="Eliminar cliente"
                    text={`Eliminar a "${modal.customer.name}" del registro?`}
                    onClose={closeModal}
                    onConfirm={async () => { await supabase.from('customers').delete().eq('id', modal.customer.id); afterSave(); }}
                />
            )}
        </div>
    );
};

/* ─── ReportsSection ─────────────────────────────────────────────── */
const ReportsSection = ({ orders }) => {
    const now = new Date();

    /* Date helpers */
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(now);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidOrders = orders.filter(o => REVENUE_STATUSES.includes(o.status));

    const revenueToday = paidOrders.filter(o => new Date(o.created_at) >= today).reduce((s, o) => s + Number(o.amount), 0);
    const revenueWeek  = paidOrders.filter(o => new Date(o.created_at) >= weekStart).reduce((s, o) => s + Number(o.amount), 0);
    const revenueMonth = paidOrders.filter(o => new Date(o.created_at) >= monthStart).reduce((s, o) => s + Number(o.amount), 0);
    const revenueTotal = paidOrders.reduce((s, o) => s + Number(o.amount), 0);

    /* Orders by day (last 14 days) */
    const days14 = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days14.push(d);
    }
    const ordersByDay = days14.map(d => {
        const dayEnd = new Date(d); dayEnd.setDate(dayEnd.getDate() + 1);
        return {
            label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
            count: orders.filter(o => { const oc = new Date(o.created_at); return oc >= d && oc < dayEnd; }).length,
        };
    });
    const maxDayCount = Math.max(...ordersByDay.map(d => d.count), 1);

    /* Top 5 products */
    const productCounts = {};
    orders.forEach(o => { productCounts[o.product_name] = (productCounts[o.product_name] || 0) + 1; });
    const top5Products = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxProductCount = top5Products.length ? top5Products[0][1] : 1;

    /* Orders by source */
    const sourceCounts = {};
    orders.forEach(o => { const src = o.order_source || 'web'; sourceCounts[src] = (sourceCounts[src] || 0) + 1; });
    const sourceEntries = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
    const maxSourceCount = sourceEntries.length ? sourceEntries[0][1] : 1;

    /* Orders by payment method */
    const paymentCounts = {};
    orders.forEach(o => { const pm = o.payment_method || 'Sin especificar'; paymentCounts[pm] = (paymentCounts[pm] || 0) + 1; });
    const paymentEntries = Object.entries(paymentCounts).sort((a, b) => b[1] - a[1]);
    const maxPaymentCount = paymentEntries.length ? paymentEntries[0][1] : 1;

    const revenueCards = [
        { label: 'Hoy', value: revenueToday, color: '#10b981' },
        { label: 'Esta semana', value: revenueWeek, color: '#3b82f6' },
        { label: 'Este mes', value: revenueMonth, color: '#8b5cf6' },
        { label: 'Total', value: revenueTotal, color: '#f59e0b' },
    ];

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <h1 className="admin-section-title">Reportes</h1>
                <p className="admin-section-sub">Resumen de ventas y estadisticas</p>
            </div>

            {/* Revenue cards */}
            <div className="admin-metrics">
                {revenueCards.map(c => (
                    <div key={c.label} className="admin-metric-card" style={{ '--mc-color': c.color }}>
                        <div className="admin-metric-icon" style={{ background: c.color + '15', color: c.color }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                        </div>
                        <div className="admin-metric-body">
                            <div className="admin-metric-value">${fmt(c.value)}</div>
                            <div className="admin-metric-label">{c.label}</div>
                            <div className="admin-metric-sub">COP</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="admin-reports-grid">
                {/* Orders by day chart */}
                <div className="admin-card">
                    <div className="admin-card-head">
                        <h3 className="admin-card-title">Pedidos por dia (ultimos 14 dias)</h3>
                    </div>
                    <div className="admin-bar-chart">
                        {ordersByDay.map((d, i) => (
                            <div key={i} className="admin-bar-col">
                                <div className="admin-bar-value">{d.count}</div>
                                <div className="admin-bar" style={{ height: `${Math.max((d.count / maxDayCount) * 100, 4)}%`, background: '#6366f1' }} />
                                <div className="admin-bar-label">{d.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top 5 products */}
                <div className="admin-card">
                    <div className="admin-card-head">
                        <h3 className="admin-card-title">Top 5 productos</h3>
                    </div>
                    <div className="admin-hbar-chart">
                        {top5Products.map(([name, count], i) => (
                            <div key={i} className="admin-hbar-row">
                                <span className="admin-hbar-label" title={name}>{name.length > 25 ? name.slice(0, 25) + '...' : name}</span>
                                <div className="admin-hbar-track">
                                    <div className="admin-hbar" style={{ width: `${(count / maxProductCount) * 100}%`, background: '#f59e0b' }} />
                                </div>
                                <span className="admin-hbar-value">{count}</span>
                            </div>
                        ))}
                        {top5Products.length === 0 && <p className="admin-empty-text">Sin datos</p>}
                    </div>
                </div>

                {/* Orders by source */}
                <div className="admin-card">
                    <div className="admin-card-head">
                        <h3 className="admin-card-title">Pedidos por canal</h3>
                    </div>
                    <div className="admin-hbar-chart">
                        {sourceEntries.map(([src, count], i) => (
                            <div key={i} className="admin-hbar-row">
                                <span className="admin-hbar-label"><SourceBadge source={src} /></span>
                                <div className="admin-hbar-track">
                                    <div className="admin-hbar" style={{ width: `${(count / maxSourceCount) * 100}%`, background: '#10b981' }} />
                                </div>
                                <span className="admin-hbar-value">{count}</span>
                            </div>
                        ))}
                        {sourceEntries.length === 0 && <p className="admin-empty-text">Sin datos</p>}
                    </div>
                </div>

                {/* Orders by payment method */}
                <div className="admin-card">
                    <div className="admin-card-head">
                        <h3 className="admin-card-title">Pedidos por metodo de pago</h3>
                    </div>
                    <div className="admin-hbar-chart">
                        {paymentEntries.map(([pm, count], i) => (
                            <div key={i} className="admin-hbar-row">
                                <span className="admin-hbar-label">{pm}</span>
                                <div className="admin-hbar-track">
                                    <div className="admin-hbar" style={{ width: `${(count / maxPaymentCount) * 100}%`, background: '#8b5cf6' }} />
                                </div>
                                <span className="admin-hbar-value">{count}</span>
                            </div>
                        ))}
                        {paymentEntries.length === 0 && <p className="admin-empty-text">Sin datos</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── NotesSection ──────────────────────────────────────────────── */
const PRIORITY_META = {
    baja:    { label: 'Baja',    cls: 'badge--blue' },
    normal:  { label: 'Normal',  cls: 'badge--green' },
    alta:    { label: 'Alta',    cls: 'badge--orange' },
    urgente: { label: 'Urgente', cls: 'badge--red' },
};

const EMPTY_NOTE = { title: '', content: '', priority: 'normal' };

const NoteModal = ({ note, onClose, onSaved }) => {
    const isEdit = !!note?.id;
    const [form, setForm] = useState(isEdit ? { title: note.title, content: note.content, priority: note.priority } : { ...EMPTY_NOTE });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        if (isEdit) {
            await supabase.from('notes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', note.id);
        } else {
            await supabase.from('notes').insert([form]);
        }
        setSaving(false);
        onSaved();
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Editar Anotación' : 'Nueva Anotación'}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div className="modal-field">
                        <label>Título *</label>
                        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Anillo talla 7 para María" />
                    </div>
                    <div className="modal-field">
                        <label>Contenido</label>
                        <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={5} placeholder="Detalles de la venta, medidas, especificaciones..." style={{ resize: 'vertical' }} />
                    </div>
                    <div className="modal-field">
                        <label>Prioridad</label>
                        <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                            <option value="baja">Baja</option>
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                        </select>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                    <button className="admin-btn" onClick={handleSave} disabled={saving || !form.title.trim()}>
                        {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotesSection = () => {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);        // null | 'new' | noteObj
    const [confirmDel, setConfirmDel] = useState(null);
    const [search, setSearch] = useState('');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterStatus, setFilterStatus] = useState('pending'); // 'all' | 'pending' | 'completed'

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
        setNotes(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    const toggleComplete = async (note) => {
        await supabase.from('notes').update({ is_completed: !note.is_completed, updated_at: new Date().toISOString() }).eq('id', note.id);
        fetchNotes();
    };

    const deleteNote = async () => {
        if (!confirmDel) return;
        await supabase.from('notes').delete().eq('id', confirmDel.id);
        setConfirmDel(null);
        fetchNotes();
    };

    const filtered = notes.filter(n => {
        const matchSearch = !search.trim() || n.title.toLowerCase().includes(search.toLowerCase()) || (n.content || '').toLowerCase().includes(search.toLowerCase());
        const matchPriority = filterPriority === 'all' || n.priority === filterPriority;
        const matchStatus = filterStatus === 'all' || (filterStatus === 'pending' ? !n.is_completed : n.is_completed);
        return matchSearch && matchPriority && matchStatus;
    });

    return (
        <div className="admin-section">
            {modal && (
                <NoteModal
                    note={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={fetchNotes}
                />
            )}
            {confirmDel && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
                    <div className="modal-box" style={{ maxWidth: 420 }}>
                        <div className="modal-header"><h2 className="modal-title">Eliminar anotación</h2><button className="modal-close" onClick={() => setConfirmDel(null)}>&times;</button></div>
                        <div className="modal-body"><p>¿Eliminar "<strong>{confirmDel.title}</strong>"? Esta acción no se puede deshacer.</p></div>
                        <div className="modal-footer">
                            <button className="admin-btn admin-btn--outline" onClick={() => setConfirmDel(null)}>Cancelar</button>
                            <button className="admin-btn admin-btn--danger" onClick={deleteNote}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-section-head">
                <div>
                    <h1 className="admin-section-title">Anotaciones</h1>
                    <p className="admin-section-sub">Registra información importante de ventas: medidas, especificaciones, detalles del pedido.</p>
                </div>
                <button className="admin-btn" onClick={() => setModal('new')}>+ Nueva Anotación</button>
            </div>

            {/* Filters */}
            <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="modal-field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar anotación..." />
                    </div>
                    <div className="modal-field" style={{ flex: '0 1 160px', marginBottom: 0 }}>
                        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                            <option value="all">Todas las prioridades</option>
                            <option value="baja">Baja</option>
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                        </select>
                    </div>
                    <div className="modal-field" style={{ flex: '0 1 150px', marginBottom: 0 }}>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="pending">Pendientes</option>
                            <option value="completed">Completadas</option>
                            <option value="all">Todas</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Notes list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Cargando...</div>
            ) : filtered.length === 0 ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#999', fontSize: '0.95rem' }}>
                        {notes.length === 0 ? 'No hay anotaciones aún. Crea la primera.' : 'Sin resultados para estos filtros.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(note => (
                        <div key={note.id} className="admin-card" style={{ opacity: note.is_completed ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                {/* Checkbox */}
                                <button
                                    onClick={() => toggleComplete(note)}
                                    style={{
                                        marginTop: 2, width: 22, height: 22, borderRadius: 6, border: '2px solid #d1d5db',
                                        background: note.is_completed ? '#10b981' : 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}
                                    title={note.is_completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                >
                                    {note.is_completed && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                </button>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, textDecoration: note.is_completed ? 'line-through' : 'none' }}>
                                            {note.title}
                                        </h3>
                                        <span className={`status-badge ${PRIORITY_META[note.priority]?.cls || ''}`}>
                                            {PRIORITY_META[note.priority]?.label || note.priority}
                                        </span>
                                    </div>
                                    {note.content && (
                                        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.88rem', color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                            {note.content}
                                        </p>
                                    )}
                                    <span style={{ fontSize: '0.75rem', color: '#999' }}>{fmtDate(note.created_at)}</span>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                    <button className="admin-btn admin-btn--outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }} onClick={() => setModal(note)}>Editar</button>
                                    <button className="admin-btn admin-btn--danger" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }} onClick={() => setConfirmDel(note)}>Eliminar</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
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
        return await res.json();
    };

    const fetchAdminUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await adminApiCall({ action: 'list' });
            if (data && data.users) setAdminUsers(data.users);
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
            setAdminResult({ type: 'error', msg: e.message });
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

            {/* Admin Users */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            Agregar administrador
                        </span>
                    </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.25rem', lineHeight: 1.5 }}>
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
                        <button className="admin-btn" onClick={handleCreateAdmin} disabled={adminCreating}>
                            {adminCreating ? 'Creando...' : 'Crear administrador'}
                        </button>
                    </div>
                    {adminResult.msg && (
                        <p style={{ fontSize: '0.85rem', color: adminResult.type === 'error' ? '#ef4444' : '#10b981', margin: 0 }}>
                            {adminResult.msg}
                        </p>
                    )}
                </div>
            </div>

            {/* Admin users list */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                            Administradores
                        </span>
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>{adminUsers.length}{' '}usuarios</span>
                </div>
                {loadingUsers ? (
                    <p style={{ fontSize: '0.85rem', color: '#999', textAlign: 'center', padding: '1rem 0' }}>Cargando...</p>
                ) : adminUsers.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#999', textAlign: 'center', padding: '1rem 0' }}>No se pudieron cargar los usuarios.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {adminUsers.map(u => (
                            <div key={u.id} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.75rem 0.85rem', borderRadius: '12px', background: '#f8f9fc',
                                transition: 'background 0.15s',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: u.id === currentUserId ? 'linear-gradient(135deg, #0c1220, #1a2332)' : '#e2e8f0',
                                    color: u.id === currentUserId ? '#fff' : '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.82rem', fontWeight: 800, flexShrink: 0,
                                }}>
                                    {(u.email || '?')[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                                        {u.email}
                                        {u.id === currentUserId && (
                                            <span style={{
                                                marginLeft: '0.5rem', fontSize: '0.62rem', fontWeight: 700,
                                                background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px',
                                                borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                            }}>Tú</span>
                                        )}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                                        Desde {fmtDate(u.created_at)}
                                    </p>
                                </div>
                                {u.id !== currentUserId && (
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
                            <p style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
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
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}>
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
                    <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: testResult.startsWith('Error') ? '#ef4444' : '#10b981' }}>
                        {testResult}
                    </p>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════════ */
const Dashboard = () => {
    const [session, setSession]     = useState(null);
    const [section, setSection]     = useState('dashboard');
    const [products, setProducts]   = useState([]);
    const [orders, setOrders]       = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loadingP, setLoadingP]   = useState(true);
    const [loadingO, setLoadingO]   = useState(true);
    const [loadingC, setLoadingC]   = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) navigate('/admin/login'); else setSession(session);
        });
    }, [navigate]);

    const fetchProducts = useCallback(async () => {
        setLoadingP(true);
        const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        setProducts(data || []); setLoadingP(false);
    }, []);

    const fetchOrders = useCallback(async () => {
        setLoadingO(true);
        const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        setOrders(data || []); setLoadingO(false);
    }, []);

    const fetchCustomers = useCallback(async () => {
        setLoadingC(true);
        const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        setCustomers(data || []); setLoadingC(false);
    }, []);

    useEffect(() => {
        if (session) { fetchProducts(); fetchOrders(); fetchCustomers(); }
    }, [session, fetchProducts, fetchOrders, fetchCustomers]);

    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/admin/login'); };

    if (!session) return null;

    return (
        <div className="admin-layout">
            {/* Sidebar */}
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
                            className={`admin-nav-item ${section === item.id ? 'admin-nav-item--active' : ''}`}
                            onClick={() => setSection(item.id)}
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

            {/* Main content */}
            <main className="admin-content">
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        <span className="admin-topbar-icon">{NAV.find(n => n.id === section)?.icon}</span>
                        <h2 className="admin-topbar-title">{NAV.find(n => n.id === section)?.label ?? 'Dashboard'}</h2>
                    </div>
                    <div className="admin-topbar-right">
                        <div className="admin-topbar-avatar">{session.user.email[0].toUpperCase()}</div>
                    </div>
                </header>
                <div className="admin-main">
                    {section === 'dashboard' && (
                        <DashboardHome
                            products={products} orders={orders} customers={customers}
                            onNavigate={setSection}
                        />
                    )}
                    {section === 'products' && (
                        <ProductsSection products={products} loading={loadingP} onRefresh={fetchProducts} />
                    )}
                    {section === 'orders' && (
                        <OrdersSection orders={orders} products={products} loading={loadingO} onRefresh={fetchOrders} />
                    )}
                    {section === 'customers' && (
                        <CustomersSection customers={customers} loading={loadingC} onRefresh={fetchCustomers} />
                    )}
                    {section === 'reports' && (
                        <ReportsSection orders={orders} />
                    )}
                    {section === 'notes' && (
                        <NotesSection />
                    )}
                    {section === 'settings' && (
                        <SettingsSection />
                    )}
                </div>
            </main>

            {/* Inline styles for new components */}
            <style>{`
                /* Source badge */
                .source-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    white-space: nowrap;
                }
                .source--blue  { background: #dbeafe; color: #1d4ed8; }
                .source--green { background: #dcfce7; color: #15803d; }
                .source--pink  { background: #fce7f3; color: #be185d; }
                .source--gray  { background: #f3f4f6; color: #4b5563; }

                /* Badge orange for procesando */
                .badge--orange { background: #fff7ed; color: #c2410c; }

                /* Quick action buttons */
                .admin-quick-action {
                    padding: 0.38rem 0.85rem;
                    border-radius: 9px;
                    font-size: 0.74rem;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
                    letter-spacing: 0.01em;
                }
                .admin-quick-action:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
                .action--green  { background: #dcfce7; color: #15803d; }
                .action--blue   { background: #dbeafe; color: #1d4ed8; }
                .action--purple { background: #ede9fe; color: #6d28d9; }
                .action--teal   { background: #ccfbf1; color: #0f766e; }

                /* Small action button variants */
                .admin-action-btn--sm {
                    font-size: 0.75rem !important;
                    padding: 3px 8px !important;
                }
                .admin-action-btn--icon {
                    padding: 4px 6px !important;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: auto !important;
                }

                /* Reports grid */
                .admin-reports-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.25rem;
                }
                @media (min-width: 900px) {
                    .admin-reports-grid {
                        grid-template-columns: 1fr 1fr;
                    }
                }

                /* Vertical bar chart */
                .admin-bar-chart {
                    display: flex;
                    align-items: flex-end;
                    gap: 4px;
                    height: 200px;
                    padding: 1rem 0.5rem 0;
                }
                .admin-bar-col {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                    justify-content: flex-end;
                }
                .admin-bar-value {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #555;
                    margin-bottom: 4px;
                }
                .admin-bar {
                    width: 100%;
                    max-width: 32px;
                    border-radius: 4px 4px 0 0;
                    transition: height 0.3s ease;
                    min-height: 4px;
                }
                .admin-bar-label {
                    font-size: 0.6rem;
                    color: #888;
                    margin-top: 6px;
                    text-align: center;
                    white-space: nowrap;
                }

                /* Horizontal bar chart */
                .admin-hbar-chart {
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                    padding: 0.5rem 0;
                }
                .admin-hbar-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .admin-hbar-label {
                    min-width: 100px;
                    max-width: 160px;
                    font-size: 0.8rem;
                    color: #444;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .admin-hbar-track {
                    flex: 1;
                    height: 20px;
                    background: #f3f4f6;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .admin-hbar {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                    min-width: 4px;
                }
                .admin-hbar-value {
                    min-width: 30px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #555;
                    text-align: right;
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
