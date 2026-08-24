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
import { CARRIERS, CARRIER_DE_99ENVIOS, EMPTY_CUSTOMER, SOURCE_META, STATUS_META, fmt } from './comunes';
import { loQuePasa } from '../../../lib/circuito';

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

    /* Cuánto cuesta mandarlo de verdad, preguntándoselo a las cinco
       transportadoras. Se pide a mano y no al abrir: son 300 cotizaciones por
       hora para toda la cuenta, y gastarlas abriendo diálogos sería quedarse
       sin cupo el día que haga falta. */
    const [cotizando, setCotizando] = useState(false);
    const [cotizacion, setCotizacion] = useState(null);
    const [errorCotiza, setErrorCotiza] = useState(null);

    /* Pedir la guía. Esto SÍ crea algo real y se factura, así que el botón
       aparece sólo con transportadora elegida, se confirma, y desaparece en
       cuanto hay guía: no hay forma de pedir dos. */
    const [pidiendo, setPidiendo] = useState(false);
    const [guiaError, setGuiaError] = useState(null);
    const [avisoGuia, setAvisoGuia] = useState(null);

    const pedirGuia = async () => {
        const nombre = Object.entries(CARRIER_DE_99ENVIOS).find(([, v]) => v === carrier)?.[0];
        if (!nombre) { setGuiaError('Esa transportadora no la emite 99envios.'); return; }
        const cobra = cotizacion?.contrapago ? cotizacion.cobraElMensajero : 0;
        if (!window.confirm(
            `Se va a pedir la guía a ${carrier} para el pedido de ${order.customer_name}.\n\n` +
            (cobra
                ? `El mensajero cobrará $${fmt(cobra)} en la puerta y 99envios te girará eso menos el flete.`
                : 'Nadie cobra en la puerta, así que el flete sale de tu saldo en 99envios al emitir la guía, y anularla tarda de 7 a 15 días hábiles.') +
            '\n\nEsto crea un envío de verdad. ¿Seguimos?'
        )) return;

        setPidiendo(true); setGuiaError(null); setAvisoGuia(null);
        const { data, error } = await supabase.functions.invoke('crear-guia', {
            body: { pedidoId: order.id, transportadora: nombre },
        });
        setPidiendo(false);
        if (error || !data?.ok) {
            setGuiaError(data?.detalle || error?.message || 'No se pudo pedir la guía');
            return;
        }
        setTrackingNumber(data.guia);
        if (data.aviso) setAvisoGuia(data.aviso);
    };

    const cotizar = async () => {
        setCotizando(true); setErrorCotiza(null);
        const { data, error } = await supabase.functions.invoke('cotizar-envio', {
            body: { pedidoId: order.id },
        });
        setCotizando(false);
        if (error || !data?.ok) {
            setErrorCotiza(data?.detalle || error?.message || 'No se pudo cotizar');
            return;
        }
        setCotizacion(data);
    };

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
                    <p className="ped-confirmar-quien">
                        Pedido de <strong>{order.customer_name}</strong> · {order.product_name}
                    </p>
                    {/* Al guardar esto le salen dos mensajes a la clienta —correo y
                        WhatsApp— y en contraentrega queda dicho cuánto tiene que
                        llevar el mensajero. Se avisa antes, no después. */}
                    <ul className="ped-confirmar-lista">
                        {loQuePasa(order, 'enviado').consecuencias.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                    <div className="modal-field">
                        <label>Transportadora *</label>
                        <select value={carrier} onChange={e => setCarrier(e.target.value)} required>
                            <option value="">— Seleccionar —</option>
                            {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Lo que cuesta mandarlo. No se guarda todavía: esto sólo
                        informa la decisión de con quién despachar. */}
                    <div className="envio-cotiza">
                        {!cotizacion && (
                            <button type="button" className="admin-btn admin-btn--outline envio-cotiza-btn"
                                    onClick={cotizar} disabled={cotizando}>
                                {cotizando ? 'Preguntando…' : 'Cuánto cuesta mandarlo'}
                            </button>
                        )}
                        {errorCotiza && <p className="envio-cotiza-error">{errorCotiza}</p>}
                        {cotizacion && (
                            <>
                                <p className="envio-cotiza-titulo">
                                    A {cotizacion.ciudad} · caja de {cotizacion.caja.peso} kg,
                                    {' '}{cotizacion.caja.largo}×{cotizacion.caja.ancho}×{cotizacion.caja.alto} cm
                                </p>
                                <ul className="envio-cotiza-lista">
                                    {cotizacion.opciones.map(o => (
                                        <li key={o.transportadora}>
                                            <button type="button"
                                                    className={`envio-opcion${CARRIER_DE_99ENVIOS[o.transportadora] === carrier ? ' envio-opcion--puesta' : ''}`}
                                                    onClick={() => setCarrier(CARRIER_DE_99ENVIOS[o.transportadora] || '')}>
                                                <span className="envio-opcion-nombre">
                                                    {CARRIER_DE_99ENVIOS[o.transportadora] || o.transportadora}
                                                </span>
                                                <span className="envio-opcion-precio">
                                                    ${fmt(o.total)}
                                                    {/* Desglosado cuando hay contrapago: la comisión por
                                                        cobrar en la puerta suele ser mayor que el flete, y
                                                        verla junta esconde de dónde sale el número. */}
                                                    {o.contrapago > 0 && (
                                                        <span className="envio-opcion-desglose">
                                                            flete ${fmt(o.total - o.contrapago)} + cobro ${fmt(o.contrapago)}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {/* Las que no pudieron cotizar, con su motivo. No se
                                    esconden: la primera versión las filtraba en silencio
                                    y así se perdió de vista que Interrapidísimo —la más
                                    barata— no estaba saliendo por un dato de la cuenta. */}
                                {cotizacion.noCotizaron?.length > 0 && (
                                    <ul className="envio-cotiza-fuera">
                                        {cotizacion.noCotizaron.map(n => (
                                            <li key={n.transportadora}>
                                                <strong>{CARRIER_DE_99ENVIOS[n.transportadora] || n.transportadora}</strong>
                                                {' '}no cotizó: {n.motivo}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <p className="envio-cotiza-pie">
                                    {cotizacion.contrapago
                                        ? <>El mensajero cobra <strong>${fmt(cotizacion.cobraElMensajero)}</strong> en la
                                          puerta y 99envios te gira eso menos el flete. <strong>No te cobran nada por
                                          adelantado.</strong></>
                                        : <>Nadie cobra en la puerta, así que el flete <strong>sale de tu saldo en
                                          99envios</strong> al emitir la guía. Anularla tarda de 7 a 15 días hábiles.</>}
                                </p>
                            </>
                        )}
                    </div>
                    <div className="modal-field">
                        <label>Numero de guia</label>
                        <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Numero de seguimiento" />
                    </div>

                    {carrier && !trackingNumber && CARRIER_DE_99ENVIOS && Object.values(CARRIER_DE_99ENVIOS).includes(carrier) && (
                        <button type="button" className="admin-btn admin-btn--outline envio-cotiza-btn"
                                onClick={pedirGuia} disabled={pidiendo}>
                            {pidiendo ? 'Pidiéndola…' : `Pedir la guía a ${carrier}`}
                        </button>
                    )}
                    {guiaError && <p className="envio-cotiza-error">{guiaError}</p>}
                    {avisoGuia && <p className="envio-cotiza-error">{avisoGuia}</p>}
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

/**
 * El «¿seguro?» de un cambio de estado.
 *
 * Enseñaba dos insignias y el monto, o sea el ANTES y el DESPUÉS, y nada de lo
 * que iba a pasar. Y lo que pasa no es poco: «Marcar entregado» en un
 * contraentrega declara que el mensajero cobró medio millón de pesos, hace que
 * la venta cuente completa y le dice a Meta y a TikTok que ese anuncio vendió.
 * Alguien que llevara una semana en el panel no tenía forma de saberlo.
 *
 * Ahora lee las consecuencias de `loQuePasa`, que las escribe una sola vez para
 * todo el panel, y las peligrosas se ven distintas de las de trámite.
 */
export const StatusConfirmModal = ({ order, nextStatus, onClose, onConfirm }) => {
    const [loading, setLoading] = useState(false);
    const meta = STATUS_META[nextStatus];
    const pasa = loQuePasa(order, nextStatus);
    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box modal-box--sm">
                <div className="modal-header">
                    <h2 className="modal-title">{pasa.titulo}</h2>
                    <button className="modal-close" onClick={onClose}>&#x2715;</button>
                </div>
                <div className="ped-confirmar">
                    <p className="ped-confirmar-quien">
                        <strong>{order.customer_name}</strong> · {order.product_name} · ${fmt(order.amount)} COP
                    </p>
                    <div className="ped-confirmar-salto">
                        <StatusBadge status={order.status} />
                        <span aria-hidden="true">&rarr;</span>
                        <StatusBadge status={nextStatus} />
                    </div>

                    {pasa.consecuencias.length > 0 && (
                        <>
                            <p className="ped-confirmar-ante">Qué va a pasar</p>
                            <ul className={`ped-confirmar-lista${pasa.grave ? ' ped-confirmar-lista--pesa' : ''}`}>
                                {pasa.consecuencias.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </>
                    )}
                </div>
                <div className="modal-actions modal-actions--pedido">
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>Cancelar</button>
                    <button className="admin-btn" onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }} disabled={loading}>
                        {/* El botón dice la acción, no el estado. Decía «Entregado», que
                            es el nombre de la casilla y no lo que uno está haciendo; con
                            un aviso encima que habla de medio millón de pesos, lo que se
                            pulsa tiene que confirmar ese aviso. */}
                        {loading ? 'Cambiando...' : (pasa.titulo === 'Cambiar el estado' ? `Marcar ${(meta?.label || '').toLowerCase()}` : `Sí, ${pasa.titulo.toLowerCase()}`)}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── CustomerModal ──────────────────────────────────────────────── */
