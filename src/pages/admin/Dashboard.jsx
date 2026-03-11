import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/* ─── Constants ──────────────────────────────────────────────────── */
const CATEGORIES = ['Anillos', 'Collares', 'Aretes', 'Pulseras'];
const ORDER_STATUSES = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
const STATUS_META = {
    pendiente:  { label: 'Pendiente',  cls: 'badge--yellow' },
    pagado:     { label: 'Pagado',     cls: 'badge--green'  },
    enviado:    { label: 'Enviado',    cls: 'badge--purple' },
    entregado:  { label: 'Entregado',  cls: 'badge--blue'   },
    cancelado:  { label: 'Cancelado',  cls: 'badge--red'    },
    confirmado: { label: 'Confirmado', cls: 'badge--blue'   }, // legacy
};
const fmt = n => Number(n || 0).toLocaleString('es-CO');
const fmtDate = d => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const EMPTY_PRODUCT  = { name:'', category:'Anillos', price:'', compare_price:'', description:'', image_url:'', is_new:false, is_featured:false };
const EMPTY_ORDER    = { customer_name:'', customer_phone:'', product_id:'', product_name:'', amount:'', status:'pendiente', notes:'' };
const EMPTY_CUSTOMER = { name:'', phone:'', email:'', notes:'' };

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
];

/* ─── StatusBadge ────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => (
    <span className={`status-badge ${STATUS_META[status]?.cls ?? ''}`}>
        {STATUS_META[status]?.label ?? status}
    </span>
);

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
        if (!form.price || isNaN(Number(form.price))) { setError('El precio debe ser un número.'); return; }
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
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    {error && <p className="admin-error">{error}</p>}
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Nombre *</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Anillo Solitario Oro" required />
                        </div>
                        <div className="modal-field">
                            <label>Categoría *</label>
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
                            <input type="number" min="0" step="0.01" value={form.compare_price || ''} onChange={e => set('compare_price', e.target.value)} placeholder="Dejar vacío si no hay oferta" />
                        </div>
                    </div>
                    <div className="modal-field">
                        <label>Descripción</label>
                        <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripción breve de la pieza..." />
                    </div>
                    <div className="modal-field">
                        <label>Imágenes del producto</label>
                        <p className="modal-img-hint">Sube al menos 3 fotos. La primera es la portada.</p>
                        <div className="modal-images-grid">
                            {images.map((url, idx) => (
                                <div key={idx} className="modal-img-thumb">
                                    <img src={url} alt="" onError={e => { e.currentTarget.style.opacity = '0.3'; }} />
                                    <button type="button" className="modal-img-thumb-remove" onClick={() => setImages(p => p.filter((_, i) => i !== idx))}>✕</button>
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
    const [form, setForm] = useState(isEdit ? { ...order, product_id: order.product_id || '' } : { ...EMPTY_ORDER });
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
        if (!form.amount || isNaN(Number(form.amount))) { setError('Monto inválido.'); return; }
        setSaving(true);
        const payload = {
            customer_name: form.customer_name.trim(),
            customer_phone: form.customer_phone.trim() || null,
            product_id: form.product_id || null,
            product_name: form.product_name.trim(),
            amount: Number(form.amount),
            status: form.status,
            notes: form.notes.trim() || null,
        };
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
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    {error && <p className="admin-error">{error}</p>}
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Cliente *</label>
                            <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Nombre del cliente" />
                        </div>
                        <div className="modal-field">
                            <label>Teléfono / WhatsApp</label>
                            <input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="+57 300 000 0000" />
                        </div>
                    </div>
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Seleccionar producto</label>
                            <select value={form.product_id} onChange={handleProductSelect}>
                                <option value="">— Buscar en catálogo —</option>
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
                    {isEdit && (form.shipping_address || form.shipping_city || form.shipping_department) && (
                        <div className="modal-field">
                            <label>Dirección de envío</label>
                            <div className="modal-address-info">
                                {form.shipping_address && <span>{form.shipping_address}</span>}
                                {(form.shipping_city || form.shipping_department) && (
                                    <span>{[form.shipping_city, form.shipping_department].filter(Boolean).join(', ')}</span>
                                )}
                            </div>
                        </div>
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
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    {error && <p className="admin-error">{error}</p>}
                    <div className="modal-field">
                        <label>Nombre *</label>
                        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del cliente" />
                    </div>
                    <div className="modal-row">
                        <div className="modal-field">
                            <label>Teléfono</label>
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
                    <button className="modal-close" onClick={onClose}>✕</button>
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
    const revenue      = ordersMonth.filter(o => ['pagado','enviado','entregado','confirmado'].includes(o.status)).reduce((s, o) => s + Number(o.amount), 0);
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
                <p className="admin-section-sub">Bienvenido al panel de administración de Aurem Gs Joyería</p>
            </div>

            <div className="admin-metrics">
                {metrics.map(m => (
                    <div key={m.label} className="admin-metric-card">
                        <div className="admin-metric-icon" style={{ background: m.color + '18', color: m.color }}>{m.icon}</div>
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
                        <button className="admin-card-link" onClick={() => onNavigate('orders')}>Ver todos →</button>
                    </div>
                    {recentOrders.length === 0 ? (
                        <p className="admin-empty-text">No hay pedidos aún.</p>
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
                        <h3 className="admin-card-title">Productos por categoría</h3>
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
                    <p className="admin-section-sub">{products.length} productos en el catálogo</p>
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
                            <thead><tr><th>Imagen</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {visible.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="admin-thumb">
                                                {p.image_url ? <img src={p.image_url} alt={p.name} onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }} /> : null}
                                                <div className="admin-thumb-placeholder" style={p.image_url ? { display:'none' } : {}}>✦</div>
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
                    text={`¿Seguro que quieres eliminar "${modal.product.name}"? Esta acción no se puede deshacer.`}
                    onClose={closeModal}
                    onConfirm={async () => { await supabase.from('products').delete().eq('id', modal.product.id); afterSave(); }}
                />
            )}
        </div>
    );
};

/* ─── OrdersSection ──────────────────────────────────────────────── */
const OrdersSection = ({ orders, products, loading, onRefresh }) => {
    const [search, setSearch]     = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [modal, setModal]       = useState(null);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    const visible = orders.filter(o => {
        const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
        const matchSearch = !search.trim() || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.product_name.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    const totalVisible = visible.reduce((s, o) => s + Number(o.amount), 0);

    return (
        <div className="admin-section">
            <div className="admin-section-head">
                <div>
                    <h1 className="admin-section-title">Pedidos</h1>
                    <p className="admin-section-sub">{orders.length} pedidos · Total visible: ${fmt(totalVisible)} COP</p>
                </div>
                <button className="admin-btn" onClick={() => setModal({ type: 'add' })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo pedido
                </button>
            </div>

            <div className="admin-card">
                <div className="admin-toolbar">
                    <div className="admin-filters">
                        {['Todos', ...ORDER_STATUSES].map(s => (
                            <button key={s} className={`filter-btn ${filterStatus === s ? 'filter-btn--active' : ''}`} onClick={() => setFilterStatus(s)}>
                                {s === 'Todos' ? 'Todos' : STATUS_META[s].label}
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
                            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Producto</th><th>Dirección</th><th>Monto</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {visible.map(o => {
                                    const addressParts = [o.shipping_address, o.shipping_city, o.shipping_department].filter(Boolean);
                                    const waPhone = (o.customer_phone || '').replace(/\D/g, '');
                                    const waMsg = encodeURIComponent(`Hola ${o.customer_name}, tu pedido de "${o.product_name}" (Aurem Gs Joyería) está siendo procesado.`);
                                    return (
                                    <tr key={o.id}>
                                        <td className="admin-td-name">{o.customer_name}</td>
                                        <td>{o.customer_phone || <span style={{color:'#aaa'}}>—</span>}</td>
                                        <td>{o.product_name}</td>
                                        <td style={{fontSize:'0.8rem',color:'#555',maxWidth:160}}>
                                            {addressParts.length ? addressParts.join(', ') : <span style={{color:'#aaa'}}>—</span>}
                                        </td>
                                        <td className="admin-td-price">${fmt(o.amount)}</td>
                                        <td><StatusBadge status={o.status} /></td>
                                        <td style={{fontSize:'0.82rem',color:'#666'}}>{fmtDate(o.created_at)}</td>
                                        <td>
                                            <div className="admin-actions">
                                                {waPhone && (
                                                    <a className="admin-action-btn admin-action-btn--wa" href={`https://wa.me/${waPhone}?text=${waMsg}`} target="_blank" rel="noreferrer">WA</a>
                                                )}
                                                <button className="admin-action-btn admin-action-btn--edit" onClick={() => setModal({ type: 'edit', order: o })}>Editar</button>
                                                <button className="admin-action-btn admin-action-btn--delete" onClick={() => setModal({ type: 'delete', order: o })}>Eliminar</button>
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

            {modal?.type === 'add'    && <OrderModal products={products} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit'   && <OrderModal order={modal.order} products={products} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'delete' && (
                <ConfirmModal
                    title="Eliminar pedido"
                    text={`¿Eliminar el pedido de "${modal.order.customer_name}"?`}
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
                        <input className="admin-search" placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={e => setSearch(e.target.value)} />
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
                            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Notas</th><th>Registro</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {visible.map(c => (
                                    <tr key={c.id}>
                                        <td className="admin-td-name">{c.name}</td>
                                        <td>{c.phone || <span style={{color:'#aaa'}}>—</span>}</td>
                                        <td>{c.email || <span style={{color:'#aaa'}}>—</span>}</td>
                                        <td style={{maxWidth:200,fontSize:'0.82rem',color:'#666'}}>{c.notes || <span style={{color:'#aaa'}}>—</span>}</td>
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
                    text={`¿Eliminar a "${modal.customer.name}" del registro?`}
                    onClose={closeModal}
                    onConfirm={async () => { await supabase.from('customers').delete().eq('id', modal.customer.id); afterSave(); }}
                />
            )}
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
            {/* ── Sidebar ── */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-logo">
                    <span>AUREM GS</span>
                    <span className="admin-sidebar-logo-sub">Admin</span>
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
                    <div className="admin-sidebar-email">{session.user.email}</div>
                    <button className="admin-sidebar-logout" onClick={handleLogout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="admin-content">
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
            </main>
        </div>
    );
};

export default Dashboard;
