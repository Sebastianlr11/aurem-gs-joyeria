/**
 * Panel · Anotaciones — Las notas internas del equipo.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026 con los ayudantes que sólo usa
 * esta pantalla. El código se movió tal cual: lo que comparte con otras
 * secciones vive en `comunes.jsx`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fmtDate } from './comunes';

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

/* La prioridad monta sobre la misma escala de intensidad que los
   pedidos: cuanto más lleno el punto, más pide la anotación. */
const PRIORITY_META = {
    baja:    { label: 'Baja',    cls: 'badge--quieto' },
    normal:  { label: 'Normal',  cls: 'badge--tenue' },
    alta:    { label: 'Alta',    cls: 'badge--vivo' },
    urgente: { label: 'Urgente', cls: 'badge--pleno' },
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

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Cargar al montar. La regla del compilador es más estricta que el problema: reestructurar cargadores que funcionan, en un panel que acaba de entrar en producción, arriesga más de lo que arregla.
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
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : filtered.length === 0 ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
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
                                        marginTop: 2, width: 22, height: 22, borderRadius: 6, border: '2px solid var(--hairline)',
                                        background: note.is_completed ? 'var(--ink)' : 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}
                                    title={note.is_completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                >
                                    {note.is_completed && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bg-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
                                        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                            {note.content}
                                        </p>
                                    )}
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(note.created_at)}</span>
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

/* ─── Precio del oro ─────────────────────────────────────────────────
   Lo que Valentina usa para cotizar piezas a medida.

   No se actualiza solo a propósito. El joyero mira el precio a diario pero
   no cambia la cotización por movimientos chicos: "si mañana baja 5000 o
   sube 3000 no importa, se maneja lo mismo". Un valor que siguiera al
   mercado le daría precios distintos a dos clientes el mismo día.
   ─────────────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════════ */

export default NotesSection;
