/**
 * La ficha de la persona con la que estás hablando: quién es, sus etiquetas,
 * las notas internas y sus últimos pedidos.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026, y es el bloque más grande
 * que se ha sacado: 168 líneas de JSX y cinco de los 55 estados del componente
 * grande. Los datos los trae `useFichaDelContacto`; esto sólo pinta.
 *
 * Recibe bastantes props y es a propósito: la alternativa era un contexto, y un
 * contexto para un solo consumidor esconde de dónde viene cada cosa sin ahorrar
 * nada. Aquí la lista de arriba ES la documentación de qué necesita la ficha.
 */
import React from 'react';
import { recibidoDe, estaVivo } from '../../../lib/dinero';
import { PRESET_TAGS, STATUS_PEDIDO, fmtDate, fmtDateFull, iniciales } from './comunes';

export default function FichaDelContacto({
    telefono,
    mensajes,
    enManual,
    etiquetas,
    resumen,
    porcentajeIA,
    fotoDelPedido,
    ficha,                 // lo que devuelve useFichaDelContacto
    onCerrar,
    onPonerEtiqueta,
    onQuitarEtiqueta,
}) {
    const {
        cliente, pedidos, notas, setNotas,
        editandoNotas, setEditandoNotas, guardarNotas, cancelarNotas,
    } = ficha;

    return (
            <div className="chat-info-panel">
                <div className="chat-info-panel-header">
                    <h4>Contacto</h4>
                    <button className="chat-info-close" onClick={() => onCerrar()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div className="chat-info-panel-body">
                    {/* ── Profile card ── */}
                    <div className="chat-info-profile">
                        <div className="chat-info-avatar">
                            {iniciales(cliente?.name || (pedidos.length > 0 && pedidos[0].customer_name))}
                        </div>
                        <div className="chat-info-identity">
                            <h5>{cliente?.name || (pedidos.length > 0 && pedidos[0].customer_name) || 'Sin nombre'}</h5>
                            <span className="chat-info-phone">
                                {telefono}
                                {mensajes.length > 0 && ` · Cliente desde ${fmtDate(mensajes[0].created_at)}`}
                            </span>
                        </div>
                        <span className={`chat-info-modo ${enManual ? 'chat-info-modo--manual' : ''}`}>
                            {enManual ? 'La llevas tú' : 'Atendida por la IA'}
                        </span>
                    </div>
    
                    {/* ── Meta pills ── */}
                    <div className="chat-info-meta">
                        {/* Había aquí un `!== 'noreply@auremgs.com'` para esconder un
                            correo de relleno. Nada en el proyecto escribe nunca ese
                            correo y ningún pedido de la base lo tiene: era una guardia
                            contra un valor que no puede aparecer, y encima nombraba un
                            dominio que no existe. */}
                        {(cliente?.email || (pedidos.length > 0 && pedidos[0].customer_email)) && (
                            <div className="chat-info-meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                <span>{cliente?.email || pedidos[0].customer_email}</span>
                            </div>
                        )}
                        {cliente?.city && (
                            <div className="chat-info-meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <span>{cliente.city}</span>
                            </div>
                        )}
                        <div className="chat-info-meta-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Desde {resumen?.desde ? fmtDateFull(resumen.desde) : '—'}</span>
                        </div>
                    </div>
    
                    {/* ── Stats grid ── */}
                    <div className="chat-info-stats">
                        {/* La misma cuenta que el dashboard, del mismo archivo.
                            Antes esta ficha contaba sólo 'pagado' y 'entregado' y
                            el dashboard contaba cuatro estados: el mismo cliente
                            daba números distintos según dónde se mirara. */}
                        <div className="chat-info-stat">
                            <span className="chat-info-stat-value">${pedidos.reduce((s, o) => s + recibidoDe(o), 0).toLocaleString('es-CO')}</span>
                            <span className="chat-info-stat-label">Ha pagado</span>
                        </div>
                        <div className="chat-info-stat">
                            {/* Los vivos. Contar cancelados al lado de "$0 gastado"
                                daba fichas que se contradecían solas. */}
                            <span className="chat-info-stat-value">{pedidos.filter(estaVivo).length}</span>
                            <span className="chat-info-stat-label">Pedidos</span>
                        </div>
                        <div className="chat-info-stat">
                            <span className="chat-info-stat-value">{resumen?.mensajes ?? mensajes.length}</span>
                            <span className="chat-info-stat-label">Mensajes</span>
                        </div>
                        <div className="chat-info-stat">
                            <span className="chat-info-stat-value">{porcentajeIA ?? '—'}</span>
                            <span className="chat-info-stat-label">Resp. por IA</span>
                        </div>
                    </div>
    
                    {/* ── Tags ── */}
                    <div className="chat-info-section">
                        <div className="chat-info-section-head">
                            <h6>Etiquetas</h6>
                        </div>
                        <div className="chat-info-tags">
                            {etiquetas.map(t => (
                                <span key={t.id} className="chat-tag-pill chat-tag-pill--removable" style={{ '--tag-color': t.color }}>
                                    {t.tag_name}
                                    <button className="chat-tag-remove" onClick={() => onQuitarEtiqueta(telefono, t.id)}>×</button>
                                </span>
                            ))}
                            <div className="chat-tag-picker">
                                {PRESET_TAGS.filter(pt => !etiquetas.some(t => t.tag_name === pt.label)).map(pt => (
                                    <button key={pt.label} className="chat-tag-add-btn" style={{ '--tag-color': pt.color }}
                                            onClick={() => onPonerEtiqueta(telefono, pt.label, pt.color)}>
                                        + {pt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
    
                    {cliente && (
                        <>
                            {/* ── Notes ── */}
                            <div className="chat-info-section">
                                <div className="chat-info-section-head">
                                    <h6>Notas</h6>
                                    {!editandoNotas && (
                                        <button className="chat-info-edit-btn" onClick={() => setEditandoNotas(true)}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                    )}
                                </div>
                                {editandoNotas ? (
                                    <div className="chat-info-notes-edit">
                                        <textarea
                                            className="chat-info-notes-input"
                                            value={notas}
                                            onChange={e => setNotas(e.target.value)}
                                            rows={3}
                                            autoFocus
                                        />
                                        <div className="chat-info-notes-actions">
                                            <button className="chat-info-btn" onClick={guardarNotas}>Guardar</button>
                                            {/* Cancelar devuelve lo guardado, no deja el borrador en el campo.
                                                Antes al volver a editar salía el texto que habías
                                                descartado, con toda la pinta de estar guardado. */}
                                            <button className="chat-info-btn chat-info-btn--outline" onClick={cancelarNotas}>Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="chat-info-notes" onClick={() => setEditandoNotas(true)}>
                                        {cliente.notes || 'Click para agregar notas...'}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
    
                    {/* ── Orders ── */}
                    <div className="chat-info-section">
                        <div className="chat-info-section-head">
                            <h6>Pedidos recientes</h6>
                        </div>
                        {pedidos.length === 0 ? (
                            <div className="chat-info-empty">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
                                <span>Sin pedidos aún</span>
                            </div>
                        ) : (
                            <div className="chat-info-orders">
                                {pedidos.map(o => (
                                    <div key={o.id} className="chat-info-order">
                                        <div className="chat-info-order-thumb">
                                            {fotoDelPedido(o) ? <img src={fotoDelPedido(o)} alt="" loading="lazy" /> : <span>✦</span>}
                                        </div>
                                        <div className="chat-info-order-cuerpo">
                                            <div className="chat-info-order-top">
                                                <span className="chat-info-order-name">{o.product_name}</span>
                                            </div>
                                            <div className="chat-info-order-bottom">
                                                <span className="chat-info-order-amount">${Number(o.amount).toLocaleString('es-CO')}</span>
                                                <span className={`chat-info-order-status chat-info-order-status--${o.status}`}>{STATUS_PEDIDO[o.status] || o.status}</span>
                                            </div>
                                            <span className="chat-info-order-date">{fmtDate(o.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>    );
}
