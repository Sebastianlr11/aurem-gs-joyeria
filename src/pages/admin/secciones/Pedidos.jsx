/**
 * Panel · Pedidos — Los pedidos: estado, despacho y conversión.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026 con los ayudantes que sólo usa
 * esta pantalla. El código se movió tal cual: lo que comparte con otras
 * secciones vive en `comunes.jsx`.
 */
import React, { useMemo, useState } from 'react';
import { queFalta } from '../../../lib/circuito';
import { estaVivo, recibidoDe } from '../../../lib/dinero';
import { supabase } from '../../../lib/supabase';
import PedidoModal from '../PedidoModal';
import { GRUPOS, ORDER_STATUSES, SOURCE_META, STATUS_META, coincideTelefono, despacharPedido, enGrupo, fireWebhook, fmt, fmtDate, isCOD, norm } from './comunes';
import { ConfirmModal, ShipModal, SourceBadge, StatusBadge, StatusConfirmModal } from './piezas';

/* Contraentrega. Sólo hay un botón visible por pedido: el que toca ahora.
   `pendiente` y `confirmado` llevan al mismo sitio pero llegan distinto — a
   `confirmado` se llega sola, cuando entra el abono; en `pendiente` se queda un
   pedido cargado a mano en el panel, que no tiene abono que esperar. */
const NEXT_ACTION_COD = {
    pendiente:  { next: 'procesando', label: 'Empezar a fabricar' },
    confirmado: { next: 'procesando', label: 'Empezar a fabricar' },
    procesando: { next: 'enviado',    label: 'Marcar enviado' },
    enviado:    { next: 'entregado',  label: 'Marcar entregado' },
};

const NEXT_ACTION_PREPAID = {
    pendiente:  { next: 'pagado',     label: 'Confirmar pago' },
    pagado:     { next: 'procesando', label: 'Empezar a fabricar' },
    procesando: { next: 'enviado',    label: 'Marcar enviado' },
    enviado:    { next: 'entregado',  label: 'Marcar entregado' },
    /* Pagando en línea no se pasa por `confirmado` —ese estado es del abono—,
       pero la base lo acepta y sin esta línea un pedido así se quedaría sin
       acción siguiente: la tabla lo daría por cerrado sin estarlo. */
    confirmado: { next: 'procesando', label: 'Empezar a fabricar' },
};

/* Flujo contraentrega: pendiente → procesando → enviado → entregado.
   Y ahí se acaba: el mensajero entrega y trae la plata el mismo día, así que
   marcar entregado ES declarar que se cobró.

   Antes había un paso más, entregado → pagado con un botón de "Confirmar
   pago". Sobraba, y hacía daño: recibidoDe() en src/lib/dinero.js siempre ha
   contado un contraentrega entregado como plata completa en la cuenta, así que
   el mismo pedido salía cobrado entero en el bloque de dinero y pendiente de
   cobro en el de tareas. Dos verdades sobre la misma fila.

   'pagado' en contraentrega queda como estado heredado: no se llega solo, pero
   la base lo acepta y recibidoDe() lo sigue contando igual que entregado. */

const ORDERS_PER_PAGE = 15;

const ORIGENES = [
    { id: 'meta',    label: 'Meta',    nota: 'Instagram y Facebook' },
    { id: 'tiktok',  label: 'TikTok',  nota: 'Anuncios y lives' },
    { id: 'otro',    label: 'Otro',    nota: 'Enlaces con etiqueta' },
    { id: 'directo', label: 'Directo', nota: 'Sin rastro de campaña' },
];

const PAGO_LABEL = {
    contraentrega: 'Contra entrega',
    mercadopago: 'Mercado Pago',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    transferencia: 'Transferencia',
    efectivo: 'Efectivo',
};

const VentasPorOrigen = ({ orders }) => {
    const vendidos = orders.filter(estaVivo);

    const porOrigen = ORIGENES.map(({ id, label, nota }) => {
        const suyos = vendidos.filter(o => origenDe(o) === id);
        return {
            id, label, nota,
            pedidos: suyos.length,
            /* Lo recibido, como en todo el resto del panel. Un peso en esta
               pantalla significa siempre lo mismo: plata que entró. */
            plata: suyos.reduce((s, o) => s + recibidoDe(o), 0),
        };
    });

    const total = porOrigen.reduce((s, x) => s + x.plata, 0);

    if (!vendidos.length) return null;

    return (
        <section className="origen-panel">
            <header className="origen-head">
                <h3 className="origen-title">De dónde vienen las ventas</h3>
                <p className="origen-sub">
                    Calculado desde tus pedidos, no desde lo que dice cada plataforma.
                    Los administradores de anuncios se atribuyen de más cuando alguien
                    vio anuncios en los dos lados; esto no.
                </p>
            </header>
            <div className="origen-grid">
                {porOrigen.map(({ id, label, nota, pedidos, plata }) => (
                    <div key={id} className={`origen-item origen-item--${id}`}>
                        <span className="origen-l">{label}</span>
                        <span className={`origen-v ${pedidos === 0 ? 'origen-v--cero' : ''}`}>
                            {pedidos === 0 ? '—' : `$${fmt(Math.round(plata))}`}
                        </span>
                        <span className="origen-s">
                            {pedidos === 0
                                ? nota
                                : `${pedidos} pedido${pedidos !== 1 ? 's' : ''}${total > 0 ? ` · ${Math.round((plata / total) * 100)}%` : ''}`}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
};

/* ─── ShipModal ──────────────────────────────────────────────────── */

const WA_MESSAGES = {
    pagado: (o) => `Hola ${o.customer_name}! \u{1F389} Tu pedido de "${o.product_name}" en Aurem Gs Joyeria fue recibido con exito. Estamos preparandolo. Te mantendremos informado!`,
    procesando: (o) => `Hola ${o.customer_name}! Tu pedido de "${o.product_name}" esta siendo procesado. Pronto te enviaremos los detalles del envio. \u2728`,
    enviado: (o) => `Hola ${o.customer_name}! Tu pedido de "${o.product_name}" fue enviado${o.carrier ? ` por ${o.carrier}` : ''}${o.tracking_number ? `. Numero de guia: ${o.tracking_number}` : ''}. Pronto lo recibiras! \u{1F4E6}`,
    entregado: (o) => `Hola ${o.customer_name}! Esperamos que estes disfrutando tu "${o.product_name}" de Aurem Gs Joyeria. Gracias por tu compra! \u{1F48E}`,
    pendiente: (o) => `Hola ${o.customer_name}! Vimos que tienes un pedido pendiente de "${o.product_name}" en Aurem Gs Joyeria. Podemos ayudarte a completarlo?`,
    cancelado: (o) => `Hola ${o.customer_name}, tu pedido de "${o.product_name}" ha sido cancelado. Si tienes alguna duda o quieres hacer un nuevo pedido, escribenos con gusto.`,
};

const avisarConversion = async (orderId) => {
    try {
        await supabase.functions.invoke('conversion-pedido', { body: { pedidoId: orderId } });
    } catch (e) {
        console.error('No se pudo avisar la venta a los anuncios:', e);
    }
};

/**
 * El correo de "tu pieza va en camino".
 *
 * Devuelve el motivo cuando no se manda, en vez de un booleano pelado: hay
 * dos casos legítimos —el pedido no tiene correo, o no tiene guía— y quien
 * despacha necesita saber cuál de los dos fue. Un silencio se lee como
 * "salió", y ahí es donde el cliente se queda esperando un correo que nunca
 * se escribió.
 */

const fmtShortDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
};

const getNextAction = (order) => (isCOD(order) ? NEXT_ACTION_COD : NEXT_ACTION_PREPAID)[order.status];

/* Los grupos de trabajo del panel, definidos por el flujo que sigue el pedido
   y no por el estado suelto. Hace falta porque el mismo estado significa cosas
   opuestas en cada flujo: en prepago 'pagado' es el principio del camino y en
   contraentrega es el final —la plata en la mano— y contraentrega es como se
   vende casi todo aquí. Contarlos por estado hacía que una venta terminada
   siguiera pidiendo despacho para siempre.

   Un pedido abierto cae en uno y sólo uno. Los cerrados —cancelado, y
   entregado en cualquiera de los dos flujos— no caen en ninguno, que es
   exactamente lo que dice getNextAction(). Si las dos cosas dejan de coincidir
   es que se añadió un estado y se olvidó este bloque; la comprobación está
   escrita en la cabecera de Pedidos, donde los tres números tienen que sumar
   los pedidos con acción pendiente. */

const nombrePago = (m) => PAGO_LABEL[m] || m;

const origenDe = (o) => {
    if (o.ctwa_clid || o.anuncio_id || o.fbc) return 'meta';
    if (o.ttclid) return 'tiktok';
    const u = (o.utm_source || '').toLowerCase();
    if (u.includes('tiktok') || u === 'tt') return 'tiktok';
    if (u.includes('meta') || u.includes('facebook') || u.includes('instagram') || u === 'ig' || u === 'fb') return 'meta';
    if (u) return 'otro';
    return 'directo';
};

const OrdersSection = ({ orders, products, loading, onRefresh }) => {
    const [search, setSearch]           = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterGrupo, setFilterGrupo] = useState(null);
    const [filterSource, setFilterSource] = useState('Todos');
    const [modal, setModal]             = useState(null);
    const [page, setPage]               = useState(1);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    /* El filtrado va en dos pasos a propósito. Aquí se aplica todo menos el
       estado, y de este conjunto salen los contadores de la cabecera: así
       dicen cuántos hay en lo que estás mirando y no en el total, que era lo
       que hacía que con el canal en WhatsApp los números siguieran siendo de
       toda la tienda. */
    const base = useMemo(() => {
        const q = norm(search).trim();
        return orders.filter(o => {
            if (filterSource !== 'Todos' && (o.order_source || 'web') !== filterSource) return false;
            if (!q) return true;
            return norm(o.customer_name).includes(q)
                || norm(o.product_name).includes(q)
                || norm(o.shipping_city).includes(q)
                || norm(o.tracking_number).includes(q)
                || coincideTelefono(o.customer_phone, search);
        });
    }, [orders, search, filterSource]);

    const conteos = useMemo(
        () => GRUPOS.map(g => ({ ...g, n: base.filter(g.test).length })),
        [base]
    );

    /* Estado y grupo son dos formas de cortar el mismo eje, así que se
       excluyen: fijar uno suelta el otro. Tenerlos a la vez enseñaba una
       tabla que no correspondía a ningún botón encendido. */
    const visible = filterGrupo
        ? base.filter(o => enGrupo(o, filterGrupo))
        : base.filter(o => filterStatus === 'Todos' || o.status === filterStatus);

    const hayFiltro = !!search.trim() || filterSource !== 'Todos' || filterStatus !== 'Todos' || !!filterGrupo;

    const totalVisible = visible.reduce((s, o) => s + Number(o.amount), 0);
    /* Recortada, no cruda: al borrar pedidos estando en la última página el
       total baja y la página se quedaba apuntando al vacío —tabla en blanco
       sin ninguna explicación—. */
    const totalPages = Math.max(1, Math.ceil(visible.length / ORDERS_PER_PAGE));
    const pageSegura = Math.min(page, totalPages);
    const paginated  = visible.slice((pageSegura - 1) * ORDERS_PER_PAGE, pageSegura * ORDERS_PER_PAGE);

    const setFilterStatusAndReset = (s) => { setFilterStatus(s); setFilterGrupo(null); setPage(1); };
    const setFilterGrupoAndReset  = (g) => { setFilterGrupo(g); setFilterStatus('Todos'); setPage(1); };
    const setFilterSourceAndReset = (s) => { setFilterSource(s); setPage(1); };
    const setSearchAndReset = (v) => { setSearch(v); setPage(1); };
    const limpiarFiltros = () => {
        setSearch(''); setFilterStatus('Todos'); setFilterGrupo(null); setFilterSource('Todos'); setPage(1);
    };

    /* Quick status change */
    const changeStatus = async (order, newStatus, extraFields = {}) => {
        const payload = { status: newStatus, status_updated_at: new Date().toISOString(), ...extraFields };
        const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
        if (error) { alert('Error: ' + error.message); return; }
        /* Sólo cuando la plata entra entera, que es un momento distinto en
           cada flujo: en prepago es 'pagado' —el primer paso— y en
           contraentrega es 'entregado', porque el mensajero cobra al
           entregar.

           Lo de contraentrega no es un detalle: son 16 de cada 17 pedidos. Se
           avisaba sólo en 'pagado', y al quitar el paso entregado → pagado
           este aviso se habría quedado sin dispararse nunca para el canal por
           el que se vende casi todo — ceguera total en Meta y TikTok justo al
           prender pauta.

           'pagado' se conserva en la condición para los contraentrega
           heredados que ya están en ese estado. No hay riesgo de contar dos
           veces: conversion-pedido marca conversion_enviada_en con un UPDATE
           condicionado a que esté en null, y si ya se mandó responde
           {ok:true, repetido:true} sin tocar Meta ni TikTok. */
        const entraLaPlata = newStatus === 'pagado' || (isCOD(order) && newStatus === 'entregado');
        if (entraLaPlata) await avisarConversion(order.id);
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

    /* La maquinaria vive en despacharPedido(), a nivel de módulo, porque la
       cola del taller del dashboard despacha igual. */
    const handleShipConfirm = async (carrier, trackingNumber) => {
        const order = modal.order;
        const r = await despacharPedido(order, carrier, trackingNumber);
        closeModal();

        if (!r.guardado) { alert('Error: ' + r.motivo); return; }
        onRefresh();

        if (!r.correo?.enviado) {
            alert(`El pedido quedó marcado como enviado, pero el correo no salió.\n\n${r.correo?.motivo || 'Motivo desconocido'}`);
        }
    };

    const getWaLink = (o) => {
        const phone = (o.customer_phone || '').replace(/\D/g, '');
        if (!phone) return null;
        const msgFn = WA_MESSAGES[o.status];
        const msg = msgFn ? msgFn(o) : `Hola ${o.customer_name}, gracias por tu compra en Aurem Gs Joyeria.`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    };

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

            <section className="ped-pulso" style={{ '--pulso-columnas': conteos.length }}>
                {conteos.map(({ id, label, nota, n }) => (
                    <button
                        key={id}
                        type="button"
                        className={`ped-pulso-item ${filterGrupo === id ? 'ped-pulso-item--on' : ''}`}
                        aria-pressed={filterGrupo === id}
                        onClick={() => setFilterGrupoAndReset(filterGrupo === id ? null : id)}
                    >
                        <span className="ped-pulso-l">{label}</span>
                        <span className={`ped-pulso-v ${n === 0 ? 'ped-pulso-v--cero' : ''}`}>{n}</span>
                        <span className="ped-pulso-s">{n === 0 ? 'Nada pendiente' : nota}</span>
                    </button>
                ))}
            </section>

            <VentasPorOrigen orders={orders} />

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
                            placeholder="Buscar cliente, pieza, ciudad, teléfono o guía"
                            value={search}
                            onChange={e => setSearchAndReset(e.target.value)}
                            aria-label="Buscar cliente, pieza, ciudad, teléfono o guía"
                        />
                    </label>
                </div>

                {loading ? (
                    <p className="ped-vacio">Cargando pedidos…</p>
                ) : visible.length === 0 ? (
                    <div className="ped-vacio-bloque">
                        <span className="ped-vacio-icono">✦</span>
                        {/* No es lo mismo no tener pedidos que no encontrarlos.
                            Decía "Todavía no hay pedidos" y ofrecía registrar el
                            primero aunque hubiera diecisiete y lo único malo
                            fuera el término de búsqueda. */}
                        <p className="ped-vacio-t">
                            {hayFiltro
                                ? 'Ningún pedido coincide con lo que estás buscando'
                                : 'Todavía no hay pedidos'}
                        </p>
                        {hayFiltro ? (
                            <button className="btn-pill light" onClick={limpiarFiltros}>
                                Limpiar filtros
                            </button>
                        ) : (
                            <button className="btn-pill light" onClick={() => setModal({ type: 'add' })}>
                                Registrar el primero
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="ped-tabla-wrap">
                        <table className="ped-tabla">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
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
                                                <button className="ped-cliente" onClick={() => setModal({ type: 'detail', order: o })}>
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
                                                    {o.payment_method ? nombrePago(o.payment_method) : 'Sin registrar'}
                                                </span>
                                            </td>
                                            <td>
                                                <StatusBadge status={o.status} />
                                                {/* La insignia dice DÓNDE está; esto dice QUÉ FALTA, que es lo
                                                    que hace falta para saber si hay que hacer algo hoy. */}
                                                <span className="ped-falta">{queFalta(o)}</span>
                                            </td>
                                            <td>
                                                {action ? (
                                                    <button className="ped-accion" onClick={() => handleQuickAction(o)}>
                                                        {action.label}
                                                    </button>
                                                ) : (
                                                    <span className="ped-meta">Cerrado</span>
                                                )}
                                                {/* Único camino a «devuelto». Va aparte del botón principal
                                                    porque es la excepción: el mensajero volvió con la pieza. */}
                                                {o.status === 'enviado' && (
                                                    <button
                                                        className="ped-accion-otra"
                                                        onClick={() => setModal({ type: 'confirm_status', order: o, nextStatus: 'devuelto' })}
                                                    >
                                                        No la recibió
                                                    </button>
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
                        <button className="ped-pagina" disabled={pageSegura === 1} onClick={() => setPage(pageSegura - 1)}>Anterior</button>
                        <span className="ped-paginas-info">
                            Página {pageSegura} de {totalPages} · {visible.length} pedido{visible.length !== 1 ? 's' : ''}
                        </span>
                        <button className="ped-pagina" disabled={pageSegura === totalPages} onClick={() => setPage(pageSegura + 1)}>Siguiente</button>
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
                                        <span className={`od-pay-badge ${isCOD(o) ? 'od-pay-badge--cod' : ''}`}>{nombrePago(o.payment_method)}</span>
                                    )}
                                </div>
                                <p className="od-hero-amount">${fmt(o.amount)}</p>
                                {o.piezas?.length > 1 ? (
                                    <ul className="od-piezas">
                                        {[...o.piezas]
                                            .sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))
                                            .map((p, i) => (
                                                <li key={i}>
                                                    <span className="od-pieza-nombre">
                                                        {p.cantidad > 1 ? `${p.cantidad} × ` : ''}{p.nombre}
                                                    </span>
                                                    {p.talla ? <span className="od-pieza-talla">talla {p.talla}</span> : null}
                                                    <span className="od-pieza-precio">${fmt(p.precio * p.cantidad)}</span>
                                                </li>
                                            ))}
                                    </ul>
                                ) : (
                                    <p className="od-hero-product">
                                        {o.product_name}
                                        {o.piezas?.[0]?.talla ? ` · talla ${o.piezas[0].talla}` : ''}
                                    </p>
                                )}
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
            {modal?.type === 'add'    && <PedidoModal products={products} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit'   && <PedidoModal order={modal.order} products={products} onClose={closeModal} onSaved={afterSave} />}
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
                    onConfirm={async () => {
                        const res = await supabase.from('orders').delete().eq('id', modal.order.id);
                        if (res.error) return res;
                        afterSave();
                    }}
                />
            )}
        </div>
    );
};

/* ─── CustomersSection ───────────────────────────────────────────── */

export default OrdersSection;
