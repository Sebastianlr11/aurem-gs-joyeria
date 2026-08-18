import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminSidebar from './AdminSidebar';
import { NAV } from './adminNav.jsx';

/* ─── Constants ──────────────────────────────────────────────────── */
const CATEGORIES = ['Anillos', 'Collares', 'Aretes', 'Pulseras', 'Dijes'];
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

const EMPTY_PRODUCT  = { name:'', category:'Anillos', price:'', compare_price:'', description:'', image_url:'', is_new:false, is_featured:false, stock:'' };
const EMPTY_ORDER    = { customer_name:'', customer_phone:'', customer_email:'', product_id:'', product_name:'', amount:'', status:'pendiente', payment_method:'', notes:'', carrier:'', tracking_number:'', shipping_address:'', shipping_city:'', shipping_department:'' };
const PAYMENT_METHODS = ['MercadoPago', 'Nequi', 'Daviplata', 'Transferencia', 'Efectivo', 'Contraentrega'];
const EMPTY_CUSTOMER = { name:'', phone:'', email:'', notes:'' };

/* ─── Webhook helper ─────────────────────────────────────────────── */
const fireWebhook = async (order, newStatus, extraFields = {}) => {
    const url = localStorage.getItem('admin_webhook_url');
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'order_status_changed', order: { ...order, status: newStatus, ...extraFields }, timestamp: new Date().toISOString() }),
        });
    } catch (e) { console.error('Webhook error:', e); }
};

/* NAV imported from adminNav.js */

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
            // Vacío = sin control de inventario (null). 0 = agotado.
            stock: form.stock === '' || form.stock === null || form.stock === undefined
                ? null
                : Math.max(0, Math.trunc(Number(form.stock))),
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
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Unidades disponibles</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.stock ?? ''}
                                onChange={e => set('stock', e.target.value)}
                                placeholder="Dejar vacío si no llevas inventario"
                            />
                            <p className="modal-img-hint">
                                0 significa agotado. Vacío significa que esta pieza no lleva control de inventario.
                            </p>
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
            <div className="confirm-modal">
                <div className="confirm-modal-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-text">{text}</p>
                <div className="confirm-modal-actions">
                    <button className="confirm-modal-btn confirm-modal-btn--cancel" onClick={onClose}>Cancelar</button>
                    <button className="confirm-modal-btn confirm-modal-btn--delete" onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }} disabled={loading}>
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
const MP_FEE_PERCENT = 0.0329;  // 3.29%
const MP_FEE_FIXED   = 800;    // $800 COP por transacción
const MP_IVA         = 0.19;   // 19% IVA sobre la comisión
const MP_RETE_FUENTE = 0.015;  // 1.5% retención en la fuente
const MP_RETE_ICA    = 0.00414;// ~0.414% retención ICA

const COD_PAID = ['pagado', 'enviado', 'entregado'];

/* Ingresos de un conjunto de pedidos. MercadoPago va neto de comisión y
   retenciones; contraentrega solo cuenta cuando ya se cobró. */
const ingresosDe = (pedidos) => {
    const mp = pedidos.filter(o => REVENUE_STATUSES.includes(o.status) && !isCOD(o));
    const mpBruto = mp.reduce((s, o) => s + Number(o.amount), 0);
    const mpCostos = mp.reduce((s, o) => {
        const monto = Number(o.amount);
        const comision = (monto * MP_FEE_PERCENT + MP_FEE_FIXED) * (1 + MP_IVA);
        return s + Math.ceil(comision + monto * MP_RETE_FUENTE + monto * MP_RETE_ICA);
    }, 0);
    const mpNeto = mpBruto - mpCostos;

    const codCobrado = pedidos
        .filter(o => COD_PAID.includes(o.status) && isCOD(o))
        .reduce((s, o) => s + Number(o.amount), 0);

    const porCobrar = pedidos.filter(o => isCOD(o) && !COD_PAID.includes(o.status) && o.status !== 'cancelado');

    return {
        mpNeto,
        codCobrado,
        total: mpNeto + codCobrado,
        entregados: pedidos.filter(o => COD_PAID.includes(o.status)).length,
        porCobrar,
        porCobrarTotal: porCobrar.reduce((s, o) => s + Number(o.amount), 0),
    };
};

const JIcon = ({ name, size = 20 }) => {
    const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (name) {
        case 'bag': return <svg {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
        case 'truck': return <svg {...p}><rect x="1" y="6" width="13" height="11" rx="1" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>;
        case 'chevron': return <svg {...p} strokeWidth="1.6"><polyline points="9 18 15 12 9 6" /></svg>;
        case 'whatsapp': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.5a9.5 9.5 0 0 1-4.84-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.27-9.49 9.51-9.49 2.54 0 4.92.99 6.72 2.78a9.42 9.42 0 0 1 2.78 6.72c0 5.23-4.27 9.49-9.51 9.49M20.5 3.49A11.4 11.4 0 0 0 12.05 0C5.77 0 .66 5.1.66 11.37c0 2 .52 3.96 1.52 5.68L.56 24l7.1-1.86a11.4 11.4 0 0 0 5.44 1.38c6.28 0 11.39-5.1 11.39-11.37 0-3.04-1.19-5.9-3.34-8.05" /></svg>;
        default: return null;
    }
};

const DashboardHome = ({ products, orders, customers, waStats, chatsPendientes, onNavigate }) => {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 86400000);

    const pedidos30 = orders.filter(o => new Date(o.created_at) >= hace30);
    const ingresos = ingresosDe(pedidos30);

    /* El trabajo del día mira todos los pedidos, no solo los últimos 30 días:
       uno de hace dos meses sin despachar sigue siendo trabajo de hoy. */
    const porConfirmar = orders.filter(o => o.status === 'pendiente').length;
    const porDespachar = orders.filter(o => o.status === 'pagado' || o.status === 'procesando').length;
    const sinResponder = chatsPendientes.length;

    const clientasNuevas = customers.filter(c => new Date(c.created_at) >= hace30).length;
    const conInventario = products.filter(p => p.stock !== null && p.stock !== undefined).length;

    const pendiente = porConfirmar + porDespachar + sinResponder;

    const tareas = [
        {
            clave: 'confirmar', icono: 'bag', n: porConfirmar,
            titulo: 'Por confirmar',
            sub: 'Pedidos nuevos que esperan tu llamada o mensaje',
            ir: () => onNavigate('orders'),
        },
        {
            clave: 'despachar', icono: 'truck', n: porDespachar,
            titulo: 'Por despachar',
            sub: 'Confirmados que salen en 24 a 48 horas hábiles',
            ir: () => onNavigate('orders'),
        },
        {
            clave: 'responder', icono: 'whatsapp', n: sinResponder,
            titulo: 'Sin responder',
            sub: 'Chats de WhatsApp esperando tu respuesta',
            ir: () => onNavigate('chat'),
        },
    ];

    /* Puesta a punto: cada paso se marca solo cuando el dato existe. */
    const pasos = [
        {
            t: 'Publicar las primeras piezas',
            s: products.length > 0 ? `${products.length} pieza${products.length !== 1 ? 's' : ''} en el catálogo` : 'El catálogo está vacío',
            hecho: products.length > 0,
            accion: 'Abrir productos →', ir: () => onNavigate('products'),
        },
        {
            t: 'Anotar cuántas unidades te quedan',
            s: 'Sin inventario no se puede avisar cuando una pieza se agota',
            hecho: conInventario === products.length && products.length > 0,
            accion: 'Abrir productos →', ir: () => onNavigate('products'),
        },
        {
            t: 'Confirmar envío y pago contra entrega',
            s: 'Ciudades cubiertas, plazo de 24 a 48 horas y datos de recaudo',
            hecho: false,
            accion: 'Abrir ajustes →', ir: () => onNavigate('settings'),
        },
        {
            t: 'Dejar listo el mensaje de bienvenida de WhatsApp',
            s: 'Es el primer contacto de casi toda clienta que llega del anuncio',
            hecho: false,
            accion: 'Abrir conversaciones →', ir: () => onNavigate('chat'),
        },
    ];
    const hechos = pasos.filter(p => p.hecho).length;
    const faltanPasos = hechos < pasos.length;

    const cifras = [
        { v: products.length, l: 'Piezas publicadas' },
        { v: pedidos30.length, l: 'Pedidos del periodo' },
        { v: clientasNuevas, l: 'Clientas nuevas' },
        { v: waStats.mensajesHoy, l: 'Mensajes hoy' },
        { v: waStats.conversacionesActivas, l: 'Chats activos' },
    ];

    return (
        <div className="jornada">

            <div className="jornada-head">
                <span className="jornada-fecha">
                    {hoy.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                {pendiente === 0 ? (
                    <h1 className="jornada-titulo">
                        Hoy no hay nada
                        <em>que esté esperando.</em>
                    </h1>
                ) : (
                    <h1 className="jornada-titulo">
                        Hoy tienes {pendiente} cosa{pendiente !== 1 ? 's' : ''}
                        <em>por atender.</em>
                    </h1>
                )}
                <p className="jornada-lead">
                    {products.length} pieza{products.length !== 1 ? 's' : ''} publicada{products.length !== 1 ? 's' : ''},{' '}
                    {orders.length === 0 ? 'ningún pedido todavía' : `${orders.length} pedido${orders.length !== 1 ? 's' : ''} en total`} y{' '}
                    {sinResponder === 0 ? 'la bandeja de WhatsApp al día' : `${sinResponder} chat${sinResponder !== 1 ? 's' : ''} sin responder`}.
                    {' '}Lo que sigue está abajo, en orden.
                </p>
            </div>

            <section className="jornada-panel">
                <div className="jornada-panel-head">
                    <span className="jornada-panel-titulo">Atender hoy</span>
                    <span className="jornada-panel-nota">Actualizado hace un momento</span>
                </div>
                {tareas.map(t => (
                    <button key={t.clave} className="jornada-tarea" onClick={t.ir}>
                        <span className={`jornada-tarea-icono ${t.icono === 'whatsapp' ? 'jornada-tarea-icono--wa' : ''}`}>
                            <JIcon name={t.icono} />
                        </span>
                        <span className="jornada-tarea-texto">
                            <span className="jornada-tarea-t">{t.titulo}</span>
                            <span className="jornada-tarea-s">{t.sub}</span>
                        </span>
                        <span className="jornada-tarea-n">
                            <span className={`jornada-tarea-num ${t.n > 0 ? 'jornada-tarea-num--hay' : ''}`}>{t.n}</span>
                            <span className="jornada-tarea-estado">{t.n === 0 ? 'al día' : 'pendiente'}</span>
                        </span>
                        <span className="jornada-tarea-chevron"><JIcon name="chevron" size={18} /></span>
                    </button>
                ))}
            </section>

            <section className="jornada-dinero">
                <div className="jornada-dinero-col">
                    <span className="jornada-dinero-label">Cobrado · últimos 30 días</span>
                    <div className="jornada-dinero-cifra">
                        <span className="jornada-dinero-valor">${fmt(ingresos.total)}</span>
                        <span className="jornada-dinero-moneda">COP</span>
                    </div>
                    <span className="jornada-dinero-sub">
                        {ingresos.entregados} pedido{ingresos.entregados !== 1 ? 's' : ''} entregado{ingresos.entregados !== 1 ? 's' : ''} y pagado{ingresos.entregados !== 1 ? 's' : ''}
                    </span>
                    <div className="jornada-dinero-detalle">
                        <div className="jornada-dinero-fila">
                            <span><span className="jornada-punto" />MercadoPago (neto)</span>
                            <strong>${fmt(ingresos.mpNeto)}</strong>
                        </div>
                        <div className="jornada-dinero-fila">
                            <span><span className="jornada-punto jornada-punto--cod" />Contra entrega cobrado</span>
                            <strong>${fmt(ingresos.codCobrado)}</strong>
                        </div>
                    </div>
                </div>

                <div className="jornada-dinero-col">
                    <span className="jornada-dinero-label">Falta cobrar</span>
                    <div className="jornada-dinero-cifra">
                        <span className="jornada-dinero-valor">${fmt(ingresos.porCobrarTotal)}</span>
                        <span className="jornada-dinero-moneda">COP</span>
                    </div>
                    <span className="jornada-dinero-sub">
                        Contra entrega en tránsito · {ingresos.porCobrar.length} pedido{ingresos.porCobrar.length !== 1 ? 's' : ''}
                    </span>
                    <div className="jornada-dinero-detalle">
                        <span className="punzon punzon--dark">Pago contra entrega</span>
                        <span className="jornada-dinero-sub">
                            {ingresos.porCobrar.length === 0
                                ? 'Cuando el primer pedido se entregue, aquí verás cuánto queda por recaudar.'
                                : 'Se cobra al entregar. Confirma con el mensajero para cerrarlo.'}
                        </span>
                    </div>
                </div>
            </section>

            {faltanPasos && (
                <section className="jornada-panel">
                    <div className="jornada-panel-head">
                        <span className="jornada-panel-titulo">Para dejar la tienda lista</span>
                        <span className="jornada-panel-nota">{hechos} de {pasos.length} hecho{hechos !== 1 ? 's' : ''}</span>
                    </div>
                    {pasos.map((p, i) => (
                        <div key={p.t} className={`jornada-paso ${p.hecho ? 'jornada-paso--hecho' : ''}`}>
                            <span className="jornada-paso-n">{i + 1}</span>
                            <span className="jornada-paso-texto">
                                <span className="jornada-paso-t">{p.t}</span>
                                <span className="jornada-paso-s">{p.s}</span>
                            </span>
                            {p.hecho
                                ? <span className="jornada-paso-listo">Listo</span>
                                : <button className="jornada-paso-link" onClick={p.ir}>{p.accion}</button>}
                        </div>
                    ))}
                </section>
            )}

            <section className="jornada-cifras">
                {cifras.map(c => (
                    <div key={c.l} className="jornada-cifra">
                        <span className={`jornada-cifra-v ${c.v === 0 ? 'jornada-cifra-v--cero' : ''}`}>{c.v}</span>
                        <span className="jornada-cifra-l">{c.l}</span>
                    </div>
                ))}
            </section>

            <div className="jornada-acciones">
                <button className="btn-pill black" onClick={() => onNavigate('products')}>Publicar pieza nueva</button>
                <button className="btn-pill light" onClick={() => onNavigate('chat')}>Abrir la bandeja</button>
                {orders.length === 0 && (
                    <span className="jornada-acciones-nota">
                        El gráfico de pedidos por semana aparece con el primer pedido.
                    </span>
                )}
            </div>
        </div>
    );
};

/* ─── ProductsSection ────────────────────────────────────────────── */
const PRODUCTS_PER_PAGE = 12;

const ORDENES = {
    recientes: { label: 'Más recientes', fn: null },
    mayor: { label: 'Precio: mayor a menor', fn: (a, b) => b.price - a.price },
    menor: { label: 'Precio: menor a mayor', fn: (a, b) => a.price - b.price },
    stock: { label: 'Menos stock primero', fn: (a, b) => (a.stock ?? 99) - (b.stock ?? 99) },
};

const refDe = (p) => `AG-${String(p.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;

const inventarioDe = (p) => {
    if (p.stock === null || p.stock === undefined) return { texto: 'Sin anotar', tono: 'gris' };
    if (p.stock === 0) return { texto: 'Sin unidades', tono: 'agotado' };
    if (p.stock === 1) return { texto: '1 unidad disponible', tono: 'poco' };
    return { texto: `${p.stock} unidades disponibles`, tono: 'ok' };
};

const PIcon = ({ name, size = 16 }) => {
    const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (name) {
        case 'plus': return <svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
        case 'search': return <svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
        case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
        case 'rows': return <svg {...p}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
        case 'export': return <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
        case 'arrow': return <svg {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
        case 'trash': return <svg {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
        case 'package': return <svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
        case 'cash': return <svg {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
        case 'medal': return <svg {...p}><circle cx="12" cy="8" r="6" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>;
        default: return null;
    }
};

const ProductsSection = ({ products, loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('Todos');
    const [orden, setOrden] = useState('recientes');
    const [vista, setVista] = useState('cuadricula');
    const [modal, setModal] = useState(null);
    const [page, setPage] = useState(1);

    const closeModal = () => setModal(null);
    const afterSave = () => { closeModal(); onRefresh(); };

    const visible = (() => {
        const term = search.trim().toLowerCase();
        const lista = products.filter(p => {
            const matchCat = filterCat === 'Todos' || p.category === filterCat;
            const matchSearch = !term
                || p.name.toLowerCase().includes(term)
                || refDe(p).toLowerCase().includes(term)
                || (p.description || '').toLowerCase().includes(term);
            return matchCat && matchSearch;
        });
        const fn = ORDENES[orden].fn;
        return fn ? [...lista].sort(fn) : lista;
    })();

    const totalPages = Math.ceil(visible.length / PRODUCTS_PER_PAGE);
    const paginated = visible.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

    const setFilterAndReset = (cat) => { setFilterCat(cat); setPage(1); };
    const setSearchAndReset = (v) => { setSearch(v); setPage(1); };

    const agotadas = products.filter(p => p.stock === 0).length;
    const enOferta = products.filter(p => p.compare_price && p.compare_price > p.price).length;
    const valorCatalogo = products.reduce((s, p) => s + Number(p.price || 0), 0);

    /* Exporta lo que hay en pantalla, con los filtros aplicados. */
    const exportarCSV = () => {
        const filas = [
            ['Referencia', 'Nombre', 'Categoría', 'Precio', 'Precio anterior', 'Inventario'],
            ...visible.map(p => [
                refDe(p), p.name, p.category, p.price, p.compare_price || '',
                p.stock === null || p.stock === undefined ? 'Sin anotar' : p.stock,
            ]),
        ];
        const csv = filas
            .map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `catalogo-aurem-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const etiquetas = (p) => {
        const t = [];
        if (p.is_new) t.push({ label: 'Nuevo', cls: 'prod-tag--nuevo' });
        if (p.compare_price && p.compare_price > p.price) {
            t.push({ label: `−${Math.round((1 - p.price / p.compare_price) * 100)}%`, cls: 'prod-tag--oferta' });
        }
        if (p.stock === 0) t.push({ label: 'Agotado', cls: 'prod-tag--agotado' });
        return t;
    };

    return (
        <div className="admin-section">
            <div className="prod-head">
                <div>
                    <h1 className="prod-titulo">Productos</h1>
                    <p className="prod-sub">
                        {products.length} pieza{products.length !== 1 ? 's' : ''} en el catálogo
                        {agotadas > 0 && ` · ${agotadas} agotada${agotadas !== 1 ? 's' : ''}`}
                        {enOferta > 0 && ` · ${enOferta} en oferta`}
                    </p>
                </div>
                <div className="prod-head-acciones">
                    <button className="prod-btn-linea" onClick={exportarCSV} disabled={visible.length === 0}>
                        <PIcon name="export" /> Exportar catálogo
                    </button>
                    <button className="prod-btn-ink" onClick={() => setModal({ type: 'add' })}>
                        <PIcon name="plus" /> Nuevo producto
                    </button>
                </div>
            </div>

            <div className="prod-metricas">
                <div className="prod-metrica">
                    <span className="prod-metrica-icono"><PIcon name="package" size={18} /></span>
                    <span className="prod-metrica-v">{products.length}</span>
                    <span className="prod-metrica-l">Piezas publicadas</span>
                </div>
                <div className="prod-metrica">
                    <span className="prod-metrica-icono"><PIcon name="cash" size={18} /></span>
                    <span className="prod-metrica-v">${fmt(valorCatalogo)}</span>
                    <span className="prod-metrica-l">Valor del catálogo</span>
                </div>
                <div className="prod-metrica">
                    <span className="prod-metrica-icono"><PIcon name="medal" size={18} /></span>
                    <span className="prod-metrica-v">{enOferta}</span>
                    <span className="prod-metrica-l">Con precio de oferta</span>
                </div>
            </div>

            <div className="prod-panel">
                <div className="prod-toolbar">
                    <div className="riel" role="group" aria-label="Categorías">
                        {['Todos', ...CATEGORIES].map(c => {
                            const n = c === 'Todos' ? products.length : products.filter(p => p.category === c).length;
                            const vacia = n === 0;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    className={`riel-btn ${filterCat === c ? 'riel-btn--on' : ''} ${vacia ? 'riel-btn--vacia' : ''}`}
                                    aria-pressed={filterCat === c}
                                    disabled={vacia}
                                    onClick={vacia ? undefined : () => setFilterAndReset(c)}
                                >
                                    <span>{c}</span>
                                    <span className="riel-n">{n}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="prod-herramientas">
                        <label className="prod-buscar">
                            <PIcon name="search" size={15} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o referencia"
                                value={search}
                                onChange={e => setSearchAndReset(e.target.value)}
                            />
                        </label>
                        <select className="prod-orden" value={orden} onChange={e => setOrden(e.target.value)}>
                            {Object.entries(ORDENES).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                        <div className="prod-vista">
                            <button
                                className={`prod-vista-btn ${vista === 'cuadricula' ? 'prod-vista-btn--on' : ''}`}
                                onClick={() => setVista('cuadricula')}
                                title="Cuadrícula"
                                aria-label="Ver en cuadrícula"
                            >
                                <PIcon name="grid" size={15} />
                            </button>
                            <button
                                className={`prod-vista-btn ${vista === 'tabla' ? 'prod-vista-btn--on' : ''}`}
                                onClick={() => setVista('tabla')}
                                title="Tabla"
                                aria-label="Ver en tabla"
                            >
                                <PIcon name="rows" size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="admin-loading">Cargando productos…</div>
                ) : visible.length === 0 ? (
                    <div className="prod-vacio">
                        <span className="prod-vacio-t">Sin resultados</span>
                        <span className="prod-vacio-s">
                            {products.length === 0
                                ? 'Todavía no hay piezas publicadas.'
                                : 'Prueba con otra categoría o busca otro término.'}
                        </span>
                        <button className="prod-btn-ink" onClick={() => setModal({ type: 'add' })}>
                            <PIcon name="plus" /> Nuevo producto
                        </button>
                    </div>
                ) : vista === 'cuadricula' ? (
                    <div className="prod-grid">
                        {paginated.map(p => {
                            const inv = inventarioDe(p);
                            return (
                                <article key={p.id} className="prod-card">
                                    <div className="prod-card-foto">
                                        {p.image_url
                                            ? <img src={p.image_url} alt={p.name} loading="lazy" />
                                            : <span className="prod-card-foto-vacia">✦</span>}
                                        <div className="prod-card-tags">
                                            {etiquetas(p).map(t => (
                                                <span key={t.label} className={`prod-tag ${t.cls}`}>{t.label}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="prod-card-cuerpo">
                                        <div className="prod-card-meta">
                                            <span className="prod-card-cat">{p.category}</span>
                                            <span className="prod-card-ref">{refDe(p)}</span>
                                        </div>
                                        <h4 className="prod-card-nombre">{p.name}</h4>
                                        {p.description && <p className="prod-card-detalle">{p.description}</p>}
                                        <div className="prod-card-precio">
                                            <span className="prod-card-precio-v">${fmt(p.price)}</span>
                                            <span className="prod-card-precio-m">COP</span>
                                            {p.compare_price && p.compare_price > p.price && (
                                                <span className="prod-card-precio-antes">${fmt(p.compare_price)}</span>
                                            )}
                                        </div>
                                        <div className="prod-card-stock">
                                            <span className={`prod-punto prod-punto--${inv.tono}`} />
                                            <span>{inv.texto}</span>
                                        </div>
                                        <div className="prod-card-acciones">
                                            <button className="prod-card-editar" onClick={() => setModal({ type: 'edit', product: p })}>
                                                Editar
                                            </button>
                                            <a
                                                className="prod-card-icono"
                                                href={`/catalogo/${p.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Ver en la tienda"
                                            >
                                                <PIcon name="arrow" />
                                            </a>
                                            <button
                                                className="prod-card-icono prod-card-icono--borrar"
                                                onClick={() => setModal({ type: 'delete', product: p })}
                                                title="Retirar del catálogo"
                                            >
                                                <PIcon name="trash" />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        <button className="prod-nueva" onClick={() => setModal({ type: 'add' })}>
                            <span className="prod-nueva-icono"><PIcon name="plus" size={20} /></span>
                            <span className="prod-nueva-t">Añadir una pieza</span>
                            <span className="prod-nueva-s">Fotos en 4:5, metal, ley y precio en pesos</span>
                        </button>
                    </div>
                ) : (
                    <div className="prod-tabla-wrap">
                        <table className="prod-tabla">
                            <thead>
                                <tr>
                                    <th>Pieza</th>
                                    <th>Categoría</th>
                                    <th>Precio</th>
                                    <th>Inventario</th>
                                    <th>Estado</th>
                                    <th className="prod-th-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(p => {
                                    const inv = inventarioDe(p);
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="prod-fila-pieza">
                                                    <span className="prod-fila-foto">
                                                        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : '✦'}
                                                    </span>
                                                    <div>
                                                        <span className="prod-fila-nombre">{p.name}</span>
                                                        <span className="prod-fila-meta">
                                                            {refDe(p)}{p.description ? ` · ${p.description}` : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{p.category}</td>
                                            <td>
                                                <div className="prod-fila-precio">
                                                    <span>${fmt(p.price)}</span>
                                                    {p.compare_price && p.compare_price > p.price && (
                                                        <span className="prod-card-precio-antes">${fmt(p.compare_price)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{inv.texto}</td>
                                            <td>
                                                <span className={`prod-estado prod-estado--${p.stock === 0 ? 'agotado' : 'publicado'}`}>
                                                    {p.stock === 0 ? 'Agotado' : 'Publicado'}
                                                </span>
                                            </td>
                                            <td className="prod-th-right">
                                                <button className="prod-btn-linea prod-btn-linea--sm" onClick={() => setModal({ type: 'edit', product: p })}>
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="pagination">
                        <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                            <button key={n} className={`pagination-num${n === page ? ' pagination-num--active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                        ))}
                        <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        <span className="pagination-info">{visible.length} pieza{visible.length !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {modal?.type === 'add' && <ProductModal onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit' && <ProductModal product={modal.product} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'delete' && (
                <ConfirmModal
                    title="Retirar del catálogo"
                    text={`¿Seguro que quieres eliminar "${modal.product.name}"? Esta acción no se puede deshacer.`}
                    onClose={closeModal}
                    onConfirm={async () => { await supabase.from('products').delete().eq('id', modal.product.id); afterSave(); }}
                />
            )}
        </div>
    );
};

/* ─── OrdersSection ──────────────────────────────────────────────── */
const ORDERS_PER_PAGE = 15;

const fmtShortDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
};

const OrdersSection = ({ orders, products, loading, onRefresh }) => {
    const [search, setSearch]           = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterSource, setFilterSource] = useState('Todos');
    const [modal, setModal]             = useState(null);
    const [page, setPage]               = useState(1);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    const visible = orders.filter(o => {
        const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
        const matchSource = filterSource === 'Todos' || (o.order_source || 'web') === filterSource;
        const matchSearch = !search.trim() || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.product_name.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch && matchSource;
    });

    const totalVisible = visible.reduce((s, o) => s + Number(o.amount), 0);
    const totalPages = Math.ceil(visible.length / ORDERS_PER_PAGE);
    const paginated  = visible.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);

    const setFilterStatusAndReset = (s) => { setFilterStatus(s); setPage(1); };
    const setFilterSourceAndReset = (s) => { setFilterSource(s); setPage(1); };
    const setSearchAndReset = (v) => { setSearch(v); setPage(1); };

    /* Quick status change */
    const changeStatus = async (order, newStatus, extraFields = {}) => {
        const payload = { status: newStatus, status_updated_at: new Date().toISOString(), ...extraFields };
        const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
        if (error) { alert('Error: ' + error.message); return; }
        await fireWebhook(order, newStatus, extraFields);
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

    /* Lo que de verdad pide acción, para que la cabecera no sea decorativa */
    const porConfirmar = orders.filter(o => o.status === 'pendiente').length;
    const porDespachar = orders.filter(o => o.status === 'pagado' || o.status === 'procesando').length;
    const enCamino     = orders.filter(o => o.status === 'enviado').length;

    return (
        <div className="ped">

            <header className="ped-head">
                <div className="ped-head-texto">
                    <span className="eyebrow">Panel interno</span>
                    <h1 className="ped-titulo">
                        Pedidos
                        <em>de la vitrina a la puerta.</em>
                    </h1>
                    <p className="ped-sub">
                        {orders.length} en total · ${fmt(totalVisible)} COP en lo que estás viendo
                    </p>
                </div>
                <button className="btn-pill black" onClick={() => setModal({ type: 'add' })}>
                    Registrar un pedido
                </button>
            </header>

            <section className="ped-pulso">
                {[
                    ['Por confirmar', porConfirmar, 'Esperan tu llamada o mensaje', 'pendiente'],
                    ['Por despachar', porDespachar, 'Cobrados que salen en 24 a 48 h', 'pagado'],
                    ['En camino', enCamino, 'Ya salieron, falta que lleguen', 'enviado'],
                ].map(([label, n, nota, estado]) => (
                    <button
                        key={label}
                        type="button"
                        className={`ped-pulso-item ${filterStatus === estado ? 'ped-pulso-item--on' : ''}`}
                        onClick={() => setFilterStatusAndReset(filterStatus === estado ? 'Todos' : estado)}
                    >
                        <span className="ped-pulso-l">{label}</span>
                        <span className={`ped-pulso-v ${n === 0 ? 'ped-pulso-v--cero' : ''}`}>{n}</span>
                        <span className="ped-pulso-s">{n === 0 ? 'Nada pendiente' : nota}</span>
                    </button>
                ))}
            </section>

            <section className="ped-panel">
                <div className="ped-toolbar">
                    <div className="admin-filters">
                        <div className="riel" role="group" aria-label="Estado del pedido">
                            {['Todos', ...ORDER_STATUSES].map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`riel-btn ${filterStatus === s ? 'riel-btn--on' : ''}`}
                                    aria-pressed={filterStatus === s}
                                    onClick={() => setFilterStatusAndReset(s)}
                                >
                                    <span>{s === 'Todos' ? 'Todos' : STATUS_META[s].label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="riel" role="group" aria-label="Canal de origen">
                            {['Todos', ...Object.keys(SOURCE_META)].map(s => (
                                <button
                                    key={`src-${s}`}
                                    type="button"
                                    className={`riel-btn ${filterSource === s ? 'riel-btn--on' : ''}`}
                                    aria-pressed={filterSource === s}
                                    onClick={() => setFilterSourceAndReset(s)}
                                >
                                    <span>{s === 'Todos' ? 'Todos los canales' : SOURCE_META[s].label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="ped-buscar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                            placeholder="Buscar clienta o pieza"
                            value={search}
                            onChange={e => setSearchAndReset(e.target.value)}
                            aria-label="Buscar clienta o pieza"
                        />
                    </label>
                </div>

                {loading ? (
                    <p className="ped-vacio">Cargando pedidos…</p>
                ) : visible.length === 0 ? (
                    <div className="ped-vacio-bloque">
                        <span className="ped-vacio-icono">✦</span>
                        <p className="ped-vacio-t">
                            {filterStatus !== 'Todos'
                                ? `Ningún pedido en "${STATUS_META[filterStatus]?.label}"`
                                : 'Todavía no hay pedidos'}
                        </p>
                        <button className="btn-pill light" onClick={() => setModal({ type: 'add' })}>
                            Registrar el primero
                        </button>
                    </div>
                ) : (
                    <div className="ped-tabla-wrap">
                        <table className="ped-tabla">
                            <thead>
                                <tr>
                                    <th>Clienta</th>
                                    <th>Pieza</th>
                                    <th className="ped-th-num">Monto</th>
                                    <th>Estado</th>
                                    <th>Lo que sigue</th>
                                    <th className="ped-th-acc">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(o => {
                                    const action = getNextAction(o);
                                    const waLink = getWaLink(o);
                                    return (
                                        <tr key={o.id}>
                                            <td>
                                                <button className="ped-clienta" onClick={() => setModal({ type: 'detail', order: o })}>
                                                    {o.customer_name}
                                                </button>
                                                <span className="ped-meta">
                                                    <SourceBadge source={o.order_source || 'web'} />
                                                    {o.shipping_city ? ` · ${o.shipping_city}` : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="ped-pieza">{o.product_name}</span>
                                                <span className="ped-meta">{fmtShortDate(o.created_at)}</span>
                                            </td>
                                            <td className="ped-td-num">
                                                <span className="ped-monto">${fmt(o.amount)}</span>
                                                <span className="ped-meta">
                                                    {o.payment_method
                                                        ? (isCOD(o) ? 'Contra entrega' : o.payment_method)
                                                        : 'Sin registrar'}
                                                </span>
                                            </td>
                                            <td><StatusBadge status={o.status} /></td>
                                            <td>
                                                {action ? (
                                                    <button className="ped-accion" onClick={() => handleQuickAction(o)}>
                                                        {action.label}
                                                    </button>
                                                ) : (
                                                    <span className="ped-meta">Cerrado</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="ped-acciones">
                                                    <button className="ped-icono" onClick={() => setModal({ type: 'detail', order: o })} title="Ver el detalle">
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    </button>
                                                    {waLink && (
                                                        <a className="ped-icono ped-icono--wa" href={waLink} target="_blank" rel="noreferrer" title="Escribirle por WhatsApp">
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                                                        </a>
                                                    )}
                                                    <button className="ped-icono" onClick={() => setModal({ type: 'edit', order: o })} title="Editar">
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="ped-icono ped-icono--baja" onClick={() => setModal({ type: 'delete', order: o })} title="Eliminar">
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
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

                {totalPages > 1 && (
                    <div className="ped-paginas">
                        <button className="ped-pagina" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                        <span className="ped-paginas-info">
                            Página {page} de {totalPages} · {visible.length} pedido{visible.length !== 1 ? 's' : ''}
                        </span>
                        <button className="ped-pagina" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
                    </div>
                )}
            </section>
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
const CustomersSection = ({ customers, orders = [], loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState('todas');
    const [modal, setModal]   = useState(null);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    /* Cada clienta con lo que ha comprado. Los pedidos se cruzan por
       teléfono —lo único que siempre llega desde WhatsApp— y, si no hay,
       por correo o por nombre exacto. */
    const soloDigitos = (t) => String(t || '').replace(/\D/g, '').slice(-10);

    const conCompras = useMemo(() => customers.map(c => {
        const tel = soloDigitos(c.phone);
        const correo = (c.email || '').toLowerCase();
        const suyos = orders.filter(o =>
            (tel && soloDigitos(o.customer_phone) === tel) ||
            (correo && (o.customer_email || '').toLowerCase() === correo) ||
            (!tel && !correo && o.customer_name === c.name)
        );
        const cobrados = suyos.filter(o => REVENUE_STATUSES.includes(o.status));
        const ultima = suyos.length
            ? suyos.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
            : null;
        return {
            ...c,
            pedidos: suyos.length,
            gastado: cobrados.reduce((s, o) => s + Number(o.amount), 0),
            ultima: ultima?.created_at || null,
        };
    }), [customers, orders]);

    const conPedido = conCompras.filter(c => c.pedidos > 0).length;
    const repiten   = conCompras.filter(c => c.pedidos > 1).length;

    const visible = conCompras
        .filter(c => {
            if (filtro === 'con_pedido' && c.pedidos === 0) return false;
            if (filtro === 'repiten' && c.pedidos < 2) return false;
            if (filtro === 'sin_pedido' && c.pedidos > 0) return false;
            const q = search.trim().toLowerCase();
            return !q
                || c.name.toLowerCase().includes(q)
                || (c.phone || '').includes(search)
                || (c.email || '').toLowerCase().includes(q)
                || (c.city || '').toLowerCase().includes(q);
        })
        .sort((a, b) => b.gastado - a.gastado || a.name.localeCompare(b.name));

    return (
        <div className="ped">

            <header className="ped-head">
                <div className="ped-head-texto">
                    <span className="eyebrow">Panel interno</span>
                    <h1 className="ped-titulo">
                        Clientes
                        <em>quién compra, y cuánto.</em>
                    </h1>
                    <p className="ped-sub">
                        {customers.length} en el registro · ordenadas por lo que han gastado
                    </p>
                </div>
                <button className="btn-pill black" onClick={() => setModal({ type: 'add' })}>
                    Registrar una clienta
                </button>
            </header>

            <section className="ped-pulso">
                {[
                    ['En el registro', customers.length, 'Fichas guardadas', 'todas'],
                    ['Han comprado', conPedido, 'Al menos un pedido', 'con_pedido'],
                    ['Vuelven', repiten, 'Dos pedidos o más', 'repiten'],
                ].map(([label, n, nota, clave]) => (
                    <button
                        key={label}
                        type="button"
                        className={`ped-pulso-item ${filtro === clave ? 'ped-pulso-item--on' : ''}`}
                        onClick={() => setFiltro(filtro === clave ? 'todas' : clave)}
                    >
                        <span className="ped-pulso-l">{label}</span>
                        <span className={`ped-pulso-v ${n === 0 ? 'ped-pulso-v--cero' : ''}`}>{n}</span>
                        <span className="ped-pulso-s">{nota}</span>
                    </button>
                ))}
            </section>

            <section className="ped-panel">
                <div className="ped-toolbar">
                    <div className="riel" role="group" aria-label="Filtrar clientas">
                        {[['todas', 'Todas'], ['con_pedido', 'Han comprado'], ['repiten', 'Vuelven'], ['sin_pedido', 'Sin pedidos']].map(([v, l]) => (
                            <button
                                key={v}
                                type="button"
                                className={`riel-btn ${filtro === v ? 'riel-btn--on' : ''}`}
                                aria-pressed={filtro === v}
                                onClick={() => setFiltro(v)}
                            >
                                <span>{l}</span>
                            </button>
                        ))}
                    </div>
                    <label className="ped-buscar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                            placeholder="Nombre, teléfono, correo o ciudad"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            aria-label="Buscar clienta"
                        />
                    </label>
                </div>

                {loading ? (
                    <p className="ped-vacio">Cargando clientas…</p>
                ) : visible.length === 0 ? (
                    <div className="ped-vacio-bloque">
                        <span className="ped-vacio-icono">✦</span>
                        <p className="ped-vacio-t">
                            {customers.length === 0 ? 'Todavía no hay clientas' : 'Ninguna coincide con ese filtro'}
                        </p>
                        {customers.length === 0 && (
                            <button className="btn-pill light" onClick={() => setModal({ type: 'add' })}>
                                Registrar la primera
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="ped-tabla-wrap">
                        <table className="ped-tabla">
                            <thead>
                                <tr>
                                    <th>Clienta</th>
                                    <th>Contacto</th>
                                    <th className="ped-th-num">Pedidos</th>
                                    <th className="ped-th-num">Ha gastado</th>
                                    <th>Última compra</th>
                                    <th className="ped-th-acc">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <span className="ped-clienta-nombre">{c.name}</span>
                                            <span className="ped-meta">
                                                {c.city || 'Sin ciudad'}
                                                {c.pedidos > 1 && <span className="cli-vuelve">Vuelve</span>}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="ped-pieza">{c.phone || '—'}</span>
                                            <span className="ped-meta">{c.email || 'Sin correo'}</span>
                                        </td>
                                        <td className="ped-td-num">
                                            <span className={`ped-monto ${c.pedidos === 0 ? 'ped-pulso-v--cero' : ''}`}>{c.pedidos}</span>
                                        </td>
                                        <td className="ped-td-num">
                                            <span className="ped-monto">{c.gastado > 0 ? `$${fmt(c.gastado)}` : '—'}</span>
                                        </td>
                                        <td>
                                            <span className="ped-pieza">{c.ultima ? fmtDate(c.ultima) : '—'}</span>
                                            <span className="ped-meta">
                                                {c.ultima ? 'Último pedido' : `En el registro desde ${fmtDate(c.created_at)}`}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="ped-acciones">
                                                <button className="ped-icono" onClick={() => setModal({ type: 'edit', customer: c })} title="Editar">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                                <button className="ped-icono ped-icono--baja" onClick={() => setModal({ type: 'delete', customer: c })} title="Eliminar">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

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
const REPORT_PERIODS = ['7d', '14d', '30d', '90d', 'todo'];
const REPORT_PERIOD_LABELS = { '7d': '7 días', '14d': '14 días', '30d': '30 días', '90d': '90 días', 'todo': 'Todo' };

const calcMPNet = (amount) => {
    const base = amount * MP_FEE_PERCENT + MP_FEE_FIXED;
    return amount - Math.ceil(base * (1 + MP_IVA) + amount * MP_RETE_FUENTE + amount * MP_RETE_ICA);
};

const ReportsSection = ({ orders, products = [], onNavigate }) => {
    const [period, setPeriod] = useState('30d');
    const [waAnalytics, setWaAnalytics] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [topCities, setTopCities] = useState([]);
    const [revenueBySource, setRevenueBySource] = useState([]);
    const [newVsReturning, setNewVsReturning] = useState(null);
    const [funnelData, setFunnelData] = useState(null);
    const now = new Date();

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(now);

    const periodStart = (() => {
        if (period === 'todo') return new Date(0);
        const days = parseInt(period);
        const d = new Date(today);
        d.setDate(d.getDate() - days);
        return d;
    })();

    useEffect(() => {
        const days = period === 'todo' ? 3650 : parseInt(period);

        supabase.rpc('analiticas_whatsapp', { p_dias: days })
            .then(({ data }) => setWaAnalytics(data?.[0] || null))
            .catch(() => {});

        supabase.rpc('tendencia_comparativa')
            .then(({ data }) => setTrendData(data?.[0] || null))
            .catch(() => {});

        supabase.rpc('top_ciudades_envio', { p_dias: days })
            .then(({ data }) => setTopCities(data || []))
            .catch(() => {});

        supabase.rpc('revenue_por_fuente', { p_dias: days })
            .then(({ data }) => setRevenueBySource(data || []))
            .catch(() => {});

        supabase.rpc('clientes_nuevos_vs_recurrentes', { p_dias: days })
            .then(({ data }) => setNewVsReturning(data?.[0] || null))
            .catch(() => {});

        supabase.rpc('embudo_whatsapp', { p_dias: days })
            .then(({ data }) => setFunnelData(data?.[0] || null))
            .catch(() => {});
    }, [period]);

    const filtered = orders.filter(o => new Date(o.created_at) >= periodStart);
    const paidFiltered = filtered.filter(o => REVENUE_STATUSES.includes(o.status));

    /* Mismo tramo, inmediatamente anterior, para poder comparar */
    const periodDays = period === 'todo' ? null : parseInt(period);
    const prevStart = periodDays ? new Date(new Date(periodStart).setDate(periodStart.getDate() - periodDays)) : null;
    const prevFiltered = periodDays
        ? orders.filter(o => { const d = new Date(o.created_at); return d >= prevStart && d < periodStart; })
        : [];
    const prevPaid = prevFiltered.filter(o => REVENUE_STATUSES.includes(o.status));
    const hayComparacion = periodDays && prevFiltered.length > 0;

    /* Revenue breakdown */
    const grossTotal = paidFiltered.reduce((s, o) => s + Number(o.amount), 0);
    const mpOrders = paidFiltered.filter(o => !isCOD(o));
    const codOrders = paidFiltered.filter(o => isCOD(o));
    const mpGross = mpOrders.reduce((s, o) => s + Number(o.amount), 0);
    const mpNet = mpOrders.reduce((s, o) => s + calcMPNet(Number(o.amount)), 0);
    const mpFees = mpGross - mpNet;
    const codTotal = codOrders.reduce((s, o) => s + Number(o.amount), 0);
    const netTotal = mpNet + codTotal;

    const prevNetTotal = prevPaid.reduce((s, o) => s + (isCOD(o) ? Number(o.amount) : calcMPNet(Number(o.amount))), 0);

    /* Avg order value */
    const avgOrder = paidFiltered.length ? Math.round(grossTotal / paidFiltered.length) : 0;
    const prevGross = prevPaid.reduce((s, o) => s + Number(o.amount), 0);
    const prevAvgOrder = prevPaid.length ? Math.round(prevGross / prevPaid.length) : 0;
    const prevPayRate = prevFiltered.length ? Math.round((prevPaid.length / prevFiltered.length) * 100) : 0;

    /* Conversion rate */
    const conversionRate = filtered.length ? Math.round((paidFiltered.length / filtered.length) * 100) : 0;

    /* Orders by day */
    const numDays = period === 'todo' ? 30 : parseInt(period);
    const daysArr = [];
    for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        daysArr.push(d);
    }
    const ordersByDay = daysArr.map(d => {
        const dayEnd = new Date(d); dayEnd.setDate(dayEnd.getDate() + 1);
        const dayOrders = filtered.filter(o => { const oc = new Date(o.created_at); return oc >= d && oc < dayEnd; });
        return {
            label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', ''),
            count: dayOrders.length,
            revenue: dayOrders.filter(o => REVENUE_STATUSES.includes(o.status)).reduce((s, o) => s + Number(o.amount), 0),
        };
    });
    const maxDayCount = Math.max(...ordersByDay.map(d => d.count), 1);
    /* Cuatro marcas de fecha repartidas a lo largo del eje */
    const ejeFechas = [0, 1, 2, 3]
        .map(i => ordersByDay[Math.round((i / 3) * (ordersByDay.length - 1))]?.label)
        .filter((l, i, a) => l && a.indexOf(l) === i);

    /* Top 5 products */
    const productCounts = {};
    const productRevenue = {};
    filtered.forEach(o => {
        productCounts[o.product_name] = (productCounts[o.product_name] || 0) + 1;
        if (REVENUE_STATUSES.includes(o.status)) productRevenue[o.product_name] = (productRevenue[o.product_name] || 0) + Number(o.amount);
    });

    /* Orders by status */
    const statusCounts = {};
    filtered.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

    /* Orders by source */
    const sourceCounts = {};
    filtered.forEach(o => { const src = o.order_source || 'web'; sourceCounts[src] = (sourceCounts[src] || 0) + 1; });
    const sourceEntries = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
    const maxSourceCount = sourceEntries.length ? sourceEntries[0][1] : 1;

    /* Orders by payment method */
    const paymentCounts = {};
    filtered.forEach(o => { const pm = o.payment_method || 'Sin especificar'; paymentCounts[pm] = (paymentCounts[pm] || 0) + 1; });
    const paymentEntries = Object.entries(paymentCounts).sort((a, b) => b[1] - a[1]);
    const maxPaymentCount = paymentEntries.length ? paymentEntries[0][1] : 1;

    /* Ingresos por canal, para acompañar el conteo */
    const sourceRevenue = {};
    paidFiltered.forEach(o => {
        const src = o.order_source || 'web';
        sourceRevenue[src] = (sourceRevenue[src] || 0) + Number(o.amount);
    });

    /* Piezas más vendidas, ordenadas por ingreso real cobrado.
       La miniatura sale del producto del catálogo: primero por id, y si el
       pedido es viejo y no lo trae, por nombre exacto. */
    const productoPorId = {};
    const productoPorNombre = {};
    products.forEach(p => { productoPorId[p.id] = p; productoPorNombre[p.name] = p; });
    const idPorNombre = {};
    filtered.forEach(o => { if (o.product_id && !idPorNombre[o.product_name]) idPorNombre[o.product_name] = o.product_id; });

    const topPiezas = Object.entries(productRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nombre, ingreso]) => ({
            nombre,
            ingreso,
            unidades: productCounts[nombre] || 0,
            imagen: (productoPorId[idPorNombre[nombre]] || productoPorNombre[nombre])?.image_url || null,
        }));
    const maxPieza = topPiezas.length ? topPiezas[0].ingreso : 1;

    const totalEstados = Object.values(statusCounts).reduce((s, n) => s + n, 0) || 1;
    const estadosOrden = ORDER_STATUSES.filter(s => statusCounts[s]);
    const TONO_ESTADO = {
        pendiente: '#F2EAE0',
        pagado: 'rgba(168,134,63,.45)',
        procesando: '#A8863F',
        enviado: '#6B615A',
        entregado: '#1C1714',
        cancelado: '#FFFFFF',
    };

    const porDespachar = filtered.filter(o => o.status === 'pagado' || o.status === 'procesando').length;
    const sinPago = filtered.filter(o => o.status === 'pendiente').length;

    const rangoRotulo = period === 'todo'
        ? 'Todo el histórico'
        : `Últimos ${parseInt(period)} días`;

    /* Rótulo del rango con las fechas reales y la hora de corte */
    const fmtCorto = d => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    const rangoFechas = period === 'todo'
        ? (orders.length ? `Desde el ${fmtCorto(new Date(orders[orders.length - 1].created_at))} de ${new Date(orders[orders.length - 1].created_at).getFullYear()}` : 'Todo el histórico')
        : `${fmtCorto(periodStart)} al ${fmtCorto(now)} de ${now.getFullYear()}`;
    const horaCorte = now.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

    /* Comparaciones contra el tramo anterior. Devuelven null cuando no hay
       con qué comparar, para no mostrar un "+100 %" que no significa nada. */
    const signo = n => (n > 0 ? '+' : n < 0 ? '−' : '');
    const compNum = (act, ant) => (hayComparacion ? `${signo(act - ant)}${Math.abs(act - ant)} frente al periodo anterior` : null);
    const compPP = (act, ant) => (hayComparacion ? `${signo(act - ant)}${Math.abs(act - ant)} pp frente al periodo anterior` : null);
    const compPesos = (act, ant) => (hayComparacion ? `${signo(act - ant)}$${fmt(Math.abs(act - ant))} frente al periodo anterior` : null);
    const variacionNeto = hayComparacion && prevNetTotal > 0
        ? ((netTotal - prevNetTotal) / prevNetTotal) * 100
        : null;

    const exportarCSV = () => {
        const filas = [
            ['Fecha', 'Cliente', 'Producto', 'Monto', 'Estado', 'Método de pago', 'Origen', 'Ciudad'],
            ...filtered.map(o => [
                fmtDate(o.created_at), o.customer_name, o.product_name, o.amount,
                STATUS_META[o.status]?.label || o.status,
                o.payment_method || '', o.order_source || 'web', o.shipping_city || '',
            ]),
        ];
        const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-aurem-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="inf">

            <header className="inf-head">
                <div className="inf-head-texto">
                    <span className="eyebrow">Panel interno</span>
                    <h1 className="inf-titulo">
                        Informes de
                        <em>ventas y rendimiento.</em>
                    </h1>
                    <p className="inf-sub">
                        {rangoFechas} · {filtered.length} pedido{filtered.length !== 1 ? 's' : ''} · datos cerrados hoy a las {horaCorte}
                    </p>
                </div>

                <div className="inf-head-acciones">
                    <div className="riel" role="group" aria-label="Periodo del informe">
                        {[['7d', '7 días'], ['14d', '14 días'], ['30d', '30 días'], ['90d', '90 días'], ['todo', 'Todo']].map(([v, l]) => (
                            <button
                                key={v}
                                type="button"
                                className={`riel-btn ${period === v ? 'riel-btn--on' : ''}`}
                                aria-pressed={period === v}
                                onClick={() => setPeriod(v)}
                            >
                                <span>{l}</span>
                            </button>
                        ))}
                    </div>
                    <button className="prod-btn-linea" onClick={exportarCSV} disabled={filtered.length === 0}>
                        Exportar CSV
                    </button>
                </div>
            </header>

            <section className="inf-fila-principal">
                <article className="inf-neto">
                    <div className="inf-neto-top">
                        <div className="inf-neto-cifra">
                            <span className="inf-neto-label">Ingreso neto</span>
                            <div className="inf-neto-valor-fila">
                                <span className="inf-neto-valor">${fmt(netTotal)}</span>
                                <span className="inf-neto-moneda">COP</span>
                            </div>
                            <p className="inf-neto-sub">
                                De ${fmt(grossTotal)} facturados · ya descontadas las comisiones
                            </p>
                            {variacionNeto !== null && (
                                <p className="inf-neto-comp">
                                    <strong className={variacionNeto >= 0 ? 'inf-alza' : 'inf-baja'}>
                                        {signo(variacionNeto)}{Math.abs(variacionNeto).toFixed(1).replace('.', ',')} %
                                    </strong>
                                    <span>frente a los {periodDays} días anteriores (${fmt(prevNetTotal)})</span>
                                </p>
                            )}
                        </div>
                        <span className="punzon punzon--dark">Cobrado</span>
                    </div>

                    <div className="inf-neto-desglose">
                        <div className="inf-neto-linea">
                            <span>
                                <span className="inf-barra inf-barra--oro" />
                                Mercado Pago
                                <span className="inf-neto-meta">{mpOrders.length} pedido{mpOrders.length !== 1 ? 's' : ''}</span>
                            </span>
                            <strong>${fmt(mpNet)}</strong>
                        </div>
                        <div className="inf-neto-linea">
                            <span>
                                <span className="inf-barra inf-barra--tenue" />
                                Comisiones Mercado Pago
                                <span className="inf-neto-meta">descontadas</span>
                            </span>
                            <strong>−${fmt(mpFees)}</strong>
                        </div>
                        <div className="inf-neto-linea">
                            <span>
                                <span className="inf-barra inf-barra--blanco" />
                                Contra entrega
                                <span className="inf-neto-meta">{codOrders.length} pedido{codOrders.length !== 1 ? 's' : ''}</span>
                            </span>
                            <strong>${fmt(codTotal)}</strong>
                        </div>
                    </div>
                </article>

                <article className="inf-kpis">
                    <div className="inf-kpi">
                        <span className="inf-kpi-l">Pedidos</span>
                        <span className="inf-kpi-v">{filtered.length}</span>
                        <span className="inf-kpi-s">{paidFiltered.length} cobrados, {codOrders.length} contra entrega</span>
                        {compNum(filtered.length, prevFiltered.length) && (
                            <span className="inf-kpi-comp">{compNum(filtered.length, prevFiltered.length)}</span>
                        )}
                    </div>
                    <div className="inf-kpi">
                        <span className="inf-kpi-l">Tasa de pago</span>
                        <span className="inf-kpi-v">{conversionRate} %</span>
                        <span className="inf-kpi-s">{paidFiltered.length} de {filtered.length} pedidos cobrados</span>
                        {compPP(conversionRate, prevPayRate) && (
                            <span className="inf-kpi-comp">{compPP(conversionRate, prevPayRate)}</span>
                        )}
                    </div>
                    <div className="inf-kpi">
                        <span className="inf-kpi-l">Ticket promedio</span>
                        <span className="inf-kpi-v">${fmt(avgOrder)}</span>
                        <span className="inf-kpi-s">Sobre ${fmt(grossTotal)} facturados</span>
                        {compPesos(avgOrder, prevAvgOrder) && (
                            <span className="inf-kpi-comp">{compPesos(avgOrder, prevAvgOrder)}</span>
                        )}
                    </div>
                    <div className="inf-kpi">
                        <span className="inf-kpi-l">Por atender</span>
                        <span className="inf-kpi-v">{sinPago + porDespachar}</span>
                        <span className="inf-kpi-s">{sinPago} sin pago · {porDespachar} por despachar</span>
                    </div>
                </article>
            </section>

            <section className="inf-panel">
                <div className="inf-panel-head">
                    <div>
                        <h2 className="inf-panel-titulo">Actividad diaria</h2>
                        <p className="inf-panel-sub">
                            Pedidos por día · promedio de {(filtered.length / ordersByDay.length).toFixed(1).replace('.', ',')} al día
                        </p>
                    </div>
                    <span className="inf-leyenda"><span className="inf-leyenda-cuadro" />Pedidos</span>
                </div>

                <div className="inf-grafica">
                    {ordersByDay.map((d, i) => (
                        <div
                            key={i}
                            className="inf-grafica-col"
                            title={`${d.label} · ${d.count} pedido${d.count !== 1 ? 's' : ''}`}
                        >
                            <div
                                className={`inf-grafica-barra ${d.count === 0 ? 'inf-grafica-barra--cero' : ''}`}
                                style={{
                                    height: d.count === 0 ? '2px' : `${Math.round((d.count / maxDayCount) * 100)}%`,
                                    opacity: d.count === 0 ? 1 : 0.55 + 0.45 * (d.count / maxDayCount),
                                }}
                            />
                        </div>
                    ))}
                </div>
                <div className="inf-grafica-pie">
                    {ejeFechas.map((l, i) => <span key={i}>{l}</span>)}
                </div>
            </section>

            <section className="inf-dos">
                <article className="inf-panel">
                    <div className="inf-panel-head">
                        <h2 className="inf-panel-titulo">Piezas más vendidas</h2>
                        <span className="inf-panel-tag">Por ingresos</span>
                    </div>
                    {topPiezas.length === 0 ? (
                        <p className="inf-vacio">Todavía no hay ventas en este periodo.</p>
                    ) : topPiezas.map(p => (
                        <div key={p.nombre} className="inf-pieza">
                            <div className="inf-pieza-thumb">
                                {p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : <span>✦</span>}
                            </div>
                            <div className="inf-pieza-cuerpo">
                                <div className="inf-pieza-fila">
                                    <span className="inf-pieza-nombre">{p.nombre}</span>
                                    <span className="inf-pieza-ingreso">${fmt(p.ingreso)}</span>
                                </div>
                                <div className="inf-pista">
                                    <div className="inf-pista-fill" style={{ width: `${Math.round((p.ingreso / maxPieza) * 100)}%` }} />
                                </div>
                                <span className="inf-pieza-meta">
                                    {p.unidades} unidad{p.unidades !== 1 ? 'es' : ''} vendida{p.unidades !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                </article>

                <article className="inf-panel">
                    <div className="inf-panel-head">
                        <h2 className="inf-panel-titulo">Estado de pedidos</h2>
                        <span className="inf-panel-sub">{filtered.length} en total</span>
                    </div>

                    <div className="inf-estados-barra">
                        {estadosOrden.map(s => (
                            <div
                                key={s}
                                style={{
                                    width: `${(statusCounts[s] / totalEstados) * 100}%`,
                                    background: TONO_ESTADO[s] || 'var(--hairline)',
                                }}
                            />
                        ))}
                    </div>

                    <div className="inf-estados-lista">
                        {estadosOrden.map(s => (
                            <div key={s} className="inf-estado">
                                <span className="inf-estado-punto" style={{ background: TONO_ESTADO[s] }} />
                                <span className="inf-estado-l">{STATUS_META[s]?.label || s}</span>
                                <span className="inf-estado-n">{statusCounts[s]}</span>
                                <span className="inf-estado-pct">{Math.round((statusCounts[s] / totalEstados) * 100)} %</span>
                            </div>
                        ))}
                    </div>

                    {(sinPago + porDespachar) > 0 && (
                        <div className="inf-aviso">
                            <span>
                                {sinPago + porDespachar} pedido{(sinPago + porDespachar) !== 1 ? 's' : ''} espera{(sinPago + porDespachar) !== 1 ? 'n' : ''} acción tuya:
                                {' '}{sinPago} sin pago y {porDespachar} por despachar.
                            </span>
                            {onNavigate && (
                                <button className="inf-aviso-link" onClick={() => onNavigate('orders')}>Ver pedidos →</button>
                            )}
                        </div>
                    )}
                </article>
            </section>

            <section className="inf-dos">
                <article className="inf-panel">
                    <div className="inf-panel-head">
                        <h2 className="inf-panel-titulo">Pedidos por canal</h2>
                        <span className="inf-panel-sub">De dónde llegan</span>
                    </div>
                    {sourceEntries.length === 0 ? (
                        <p className="inf-vacio">Sin pedidos en este periodo.</p>
                    ) : sourceEntries.map(([src, n]) => (
                        <div key={src} className="inf-canal">
                            <div className="inf-pieza-fila">
                                <span className="inf-canal-l">{SOURCE_META[src]?.label || src}</span>
                                <span className="inf-canal-meta">{n} · ${fmt(sourceRevenue[src] || 0)}</span>
                            </div>
                            <div className="inf-pista inf-pista--alta">
                                <div className="inf-pista-fill inf-pista-fill--ink" style={{ width: `${Math.round((n / maxSourceCount) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </article>

                <article className="inf-panel">
                    <div className="inf-panel-head">
                        <h2 className="inf-panel-titulo">Métodos de pago</h2>
                        <span className="inf-panel-sub">{filtered.length} pedido{filtered.length !== 1 ? 's' : ''}</span>
                    </div>
                    {paymentEntries.length === 0 ? (
                        <p className="inf-vacio">Sin pedidos en este periodo.</p>
                    ) : paymentEntries.map(([pm, n]) => {
                        const monto = filtered
                            .filter(o => (o.payment_method || 'Sin especificar') === pm)
                            .reduce((s, o) => s + Number(o.amount), 0);
                        return (
                            <div key={pm} className="inf-canal">
                                <div className="inf-pieza-fila">
                                    <span className="inf-canal-l">{pm}</span>
                                    <span className="inf-pieza-ingreso">${fmt(monto)}</span>
                                </div>
                                <div className="inf-pista">
                                    <div className="inf-pista-fill" style={{ width: `${Math.round((n / maxPaymentCount) * 100)}%` }} />
                                </div>
                                <span className="inf-pieza-meta">{n} pedido{n !== 1 ? 's' : ''}</span>
                            </div>
                        );
                    })}
                </article>
            </section>

            {(waAnalytics || funnelData) && (
                <section className="inf-panel">
                    <div className="inf-panel-head">
                        <div>
                            <h2 className="inf-panel-titulo">WhatsApp</h2>
                            <p className="inf-panel-sub">De la conversación a la venta</p>
                        </div>
                        <span className="inf-panel-tag">{rangoRotulo}</span>
                    </div>

                    {waAnalytics && (
                        <div className="inf-trio">
                            <div className="inf-kpi">
                                <span className="inf-kpi-l">Conversaciones</span>
                                <span className="inf-kpi-v">{waAnalytics.total_conversaciones || 0}</span>
                            </div>
                            <div className="inf-kpi">
                                <span className="inf-kpi-l">Terminan en venta</span>
                                <span className="inf-kpi-v">{waAnalytics.tasa_conversion ? `${Math.round(waAnalytics.tasa_conversion)} %` : '0 %'}</span>
                            </div>
                            <div className="inf-kpi">
                                <span className="inf-kpi-l">Tiempo de respuesta</span>
                                <span className="inf-kpi-v">{waAnalytics.tiempo_respuesta_min ? `${Math.round(waAnalytics.tiempo_respuesta_min)} min` : '—'}</span>
                            </div>
                        </div>
                    )}

                    {funnelData && (
                        <div className="inf-embudo">
                            {[
                                ['Conversaciones', funnelData.conversaciones],
                                ['Interesadas', funnelData.interesados],
                                ['Crearon pedido', funnelData.pedidos],
                                ['Pagaron', funnelData.pagados],
                            ].map(([l, v], i, arr) => {
                                const base = funnelData.conversaciones || 1;
                                const pct = Math.round(((v || 0) / base) * 100);
                                return (
                                    <div key={l} className="inf-canal" style={i === arr.length - 1 ? { borderBottom: 0 } : undefined}>
                                        <div className="inf-pieza-fila">
                                            <span className="inf-canal-l">{l}</span>
                                            <span className="inf-canal-meta">{v || 0} · {pct} %</span>
                                        </div>
                                        <div className="inf-pista inf-pista--alta">
                                            <div className="inf-pista-fill inf-pista-fill--ink" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {(trendData || newVsReturning) && (
                <section className="inf-dos">
                    {trendData && (
                        <article className="inf-panel">
                            <div className="inf-panel-head">
                                <h2 className="inf-panel-titulo">Este mes vs. el anterior</h2>
                                <span className="inf-panel-sub">Mes calendario</span>
                            </div>
                            <div className="inf-comparas">
                                {[
                                    ['Pedidos', trendData.pedidos_actual || 0, trendData.pedidos_anterior || 0, false],
                                    ['Facturado', trendData.revenue_actual || 0, trendData.revenue_anterior || 0, true],
                                ].map(([l, act, ant, money]) => (
                                    <div key={l} className="inf-compara">
                                        <span className="inf-kpi-l">{l}</span>
                                        <span className="inf-kpi-v">{money ? `$${fmt(act)}` : act}</span>
                                        <span className="inf-kpi-s">
                                            {act >= ant ? '↑' : '↓'} el mes pasado: {money ? `$${fmt(ant)}` : ant}
                                        </span>
                                    </div>
                                ))}
                                <div className="inf-compara">
                                    <span className="inf-kpi-l">Ticket promedio</span>
                                    <span className="inf-kpi-v">${fmt(trendData.ticket_promedio_actual || 0)}</span>
                                    <span className="inf-kpi-s">Este mes</span>
                                </div>
                            </div>
                        </article>
                    )}

                    {newVsReturning && (
                        <article className="inf-panel">
                            <div className="inf-panel-head">
                                <h2 className="inf-panel-titulo">Clientas</h2>
                                <span className="inf-panel-sub">Nuevas y que vuelven</span>
                            </div>
                            {(() => {
                                const nuevas = newVsReturning.nuevos || 0;
                                const vuelven = newVsReturning.recurrentes || 0;
                                const tot = nuevas + vuelven || 1;
                                return (
                                    <>
                                        <div className="inf-estados-barra">
                                            <div style={{ width: `${(nuevas / tot) * 100}%`, background: 'var(--ink)' }} />
                                            <div style={{ width: `${(vuelven / tot) * 100}%`, background: 'var(--oro)' }} />
                                        </div>
                                        <div className="inf-estado">
                                            <span className="inf-estado-punto" style={{ background: 'var(--ink)' }} />
                                            <span className="inf-estado-l">Compran por primera vez</span>
                                            <span className="inf-estado-n">{nuevas}</span>
                                            <span className="inf-estado-pct">{Math.round((nuevas / tot) * 100)} %</span>
                                        </div>
                                        <div className="inf-estado">
                                            <span className="inf-estado-punto" style={{ background: 'var(--oro)' }} />
                                            <span className="inf-estado-l">Ya habían comprado</span>
                                            <span className="inf-estado-n">{vuelven}</span>
                                            <span className="inf-estado-pct">{Math.round((vuelven / tot) * 100)} %</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </article>
                    )}
                </section>
            )}

            {(topCities.length > 0 || revenueBySource.length > 0) && (
                <section className="inf-dos">
                    {topCities.length > 0 && (
                        <article className="inf-panel">
                            <div className="inf-panel-head">
                                <h2 className="inf-panel-titulo">A dónde enviamos</h2>
                                <span className="inf-panel-sub">Ciudades</span>
                            </div>
                            {topCities.map((c, i) => (
                                <div key={i} className="inf-canal">
                                    <div className="inf-pieza-fila">
                                        <span className="inf-canal-l">{c.ciudad || 'Sin especificar'}</span>
                                        <span className="inf-canal-meta">{c.total} envío{c.total !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="inf-pista inf-pista--alta">
                                        <div className="inf-pista-fill inf-pista-fill--ink" style={{ width: `${(c.total / (topCities[0]?.total || 1)) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </article>
                    )}

                    {revenueBySource.length > 0 && (
                        <article className="inf-panel">
                            <div className="inf-panel-head">
                                <h2 className="inf-panel-titulo">Ingresos por fuente</h2>
                                <span className="inf-panel-sub">Dónde se cobra más</span>
                            </div>
                            {revenueBySource.map((r, i) => (
                                <div key={i} className="inf-canal">
                                    <div className="inf-pieza-fila">
                                        <span className="inf-canal-l">{SOURCE_META[r.fuente]?.label || r.fuente || 'Web'}</span>
                                        <span className="inf-pieza-ingreso">${fmt(r.revenue || 0)}</span>
                                    </div>
                                    <div className="inf-pista">
                                        <div className="inf-pista-fill" style={{ width: `${((r.revenue || 0) / (revenueBySource[0]?.revenue || 1)) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </article>
                    )}
                </section>
            )}
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
    const [chatWebhookUrl, setChatWebhookUrl] = useState(() => localStorage.getItem('admin_chat_webhook_url') || '');
    const [saved, setSaved] = useState(false);
    const [chatSaved, setChatSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState('');
    const [quickReplies, setQuickReplies] = useState(() => localStorage.getItem('admin_quick_replies') || '📦 En camino|Tu pedido esta en camino, pronto lo recibiras!\n📋 Catalogo|Visita nuestro catalogo completo en auremgs.com/catalogo\n🕐 Horario|Nuestro horario de atencion es de lunes a sabado, 9am a 6pm.\n💍 Talla|Para anillos necesitamos tu talla. Guia: auremgs.com/guia-de-tallas\n🙏 Gracias|Gracias por tu compra! Esperamos que disfrutes tu pieza.\n⏳ Entrega|El tiempo de entrega es de 2-3 dias habiles en Bogota, 3-5 en otras ciudades.');
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
        try { return JSON.parse(text); } catch { return { error: text || `Error del servidor (${res.status})` }; }
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

    const handleSaveChat = () => {
        localStorage.setItem('admin_chat_webhook_url', chatWebhookUrl.trim());
        setChatSaved(true);
        setTimeout(() => setChatSaved(false), 2000);
    };

    const handleSaveQuickReplies = () => {
        localStorage.setItem('admin_quick_replies', quickReplies);
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

            {/* Chat webhook */}
            <div className="admin-card" style={{ maxWidth: 600 }}>
                <div className="admin-card-head">
                    <h3 className="admin-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            Webhook Respuesta Manual (Chat)
                        </span>
                    </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Permite enviar respuestas manuales a clientes desde el panel de Conversaciones. Se enviará un POST con phone y message.
                </p>
                <div className="modal-field">
                    <label>URL del webhook de chat</label>
                    <input
                        value={chatWebhookUrl}
                        onChange={e => setChatWebhookUrl(e.target.value)}
                        placeholder="http://localhost:5678/webhook/respuesta-manual-admin"
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
                    <button className="admin-btn" onClick={handleSaveChat}>
                        {chatSaved ? 'Guardado!' : 'Guardar'}
                    </button>
                </div>
            </div>

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
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}>
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
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>Reproducir sonido al recibir mensaje nuevo</p>
                    </div>
                    <button
                        onClick={handleToggleSound}
                        style={{
                            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                            background: soundEnabled ? '#25D366' : '#d1d5db', position: 'relative',
                            transition: 'background 0.2s',
                        }}
                    >
                        <span style={{
                            position: 'absolute', top: 3, left: soundEnabled ? 25 : 3,
                            width: 20, height: 20, borderRadius: '50%', background: '#fff',
                            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════════ */
const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [session, setSession]     = useState(null);
    const [section, setSection]     = useState(() => searchParams.get('tab') || 'dashboard');
    const [products, setProducts]   = useState([]);
    const [orders, setOrders]       = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loadingP, setLoadingP]   = useState(true);
    const [loadingO, setLoadingO]   = useState(true);
    const [loadingC, setLoadingC]   = useState(true);
    const [waStats, setWaStats]     = useState({ mensajesHoy: 0, conversacionesActivas: 0, pedidosWaMes: 0 });
    const [chatsPendientes, setChatsPendientes] = useState([]);
    const navigate = useNavigate();

    /* Una conversación está sin responder cuando su último mensaje es de la
       clienta. El campo is_read no se mantiene, así que no sirve para esto. */
    const fetchChatsPendientes = useCallback(async () => {
        const { data } = await supabase
            .from('whatsapp_conversaciones')
            .select('phone_number, role, content, created_at')
            .order('created_at', { ascending: false })
            .limit(300);
        const ultimoPorTelefono = new Map();
        (data || []).forEach(m => { if (!ultimoPorTelefono.has(m.phone_number)) ultimoPorTelefono.set(m.phone_number, m); });
        setChatsPendientes([...ultimoPorTelefono.values()].filter(m => m.role === 'user').slice(0, 3));
    }, []);

    const irA = useCallback((id) => {
        const destino = NAV.find(n => n.id === id);
        if (destino?.path) navigate(destino.path); else setSection(id);
    }, [navigate]);

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

    const fetchWaStats = useCallback(async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Mensajes hoy
        const { count: mensajesHoy } = await supabase
            .from('whatsapp_conversaciones')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart);

        // Conversaciones activas (distinct phones últimas 24h)
        const { data: recentPhones } = await supabase
            .from('whatsapp_conversaciones')
            .select('phone_number')
            .gte('created_at', last24h);
        const conversacionesActivas = recentPhones ? new Set(recentPhones.map(d => d.phone_number)).size : 0;

        // Pedidos WhatsApp este mes
        const { count: pedidosWaMes } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('order_source', 'whatsapp')
            .gte('created_at', monthStart);

        setWaStats({
            mensajesHoy: mensajesHoy || 0,
            conversacionesActivas,
            pedidosWaMes: pedidosWaMes || 0,
        });
    }, []);

    useEffect(() => {
        if (session) { fetchProducts(); fetchOrders(); fetchCustomers(); fetchWaStats(); fetchChatsPendientes(); }
    }, [session, fetchProducts, fetchOrders, fetchCustomers, fetchWaStats, fetchChatsPendientes]);

    if (!session) return null;

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <AdminSidebar session={session} activeId={section} onNavClick={setSection} />

            {/* Main content */}
            <main className="admin-content">
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        <h2 className="admin-topbar-title">{NAV.find(n => n.id === section)?.label ?? 'Dashboard'}</h2>
                        <span className="admin-topbar-sep" />
                        <span className="admin-topbar-fecha">
                            {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <div className="admin-topbar-right">
                        <a className="admin-topbar-tienda" href="/" target="_blank" rel="noopener noreferrer">Ver la tienda</a>
                        <div className="admin-topbar-avatar">{session.user.email[0].toUpperCase()}</div>
                    </div>
                </header>
                <div className="admin-main">
                    {section === 'dashboard' && (
                        <DashboardHome
                            products={products} orders={orders} customers={customers}
                            waStats={waStats}
                            chatsPendientes={chatsPendientes}
                            onNavigate={irA}
                        />
                    )}
                    {section === 'products' && (
                        <ProductsSection products={products} loading={loadingP} onRefresh={fetchProducts} />
                    )}
                    {section === 'orders' && (
                        <OrdersSection orders={orders} products={products} loading={loadingO} onRefresh={fetchOrders} />
                    )}
                    {section === 'customers' && (
                        <CustomersSection customers={customers} orders={orders} loading={loadingC} onRefresh={fetchCustomers} />
                    )}
                    {section === 'reports' && (
                        <ReportsSection orders={orders} products={products} onNavigate={irA} />
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
