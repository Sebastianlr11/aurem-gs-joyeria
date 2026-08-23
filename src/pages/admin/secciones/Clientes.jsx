/**
 * Panel · Clientes — Las clientas y lo que han comprado.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026 con los ayudantes que sólo usa
 * esta pantalla. El código se movió tal cual: lo que comparte con otras
 * secciones vive en `comunes.jsx`.
 */
import React, { useMemo, useState } from 'react';
import { estaVivo, porCobrarDe, recibidoDe } from '../../../lib/dinero';
import { supabase } from '../../../lib/supabase';
import { coincideTelefono, fmt, fmtDate, norm, soloDigitos } from './comunes';
import { ConfirmModal, CustomerModal } from './piezas';

const CustomersSection = ({ customers, orders = [], loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState('todas');
    const [modal, setModal]   = useState(null);

    const closeModal = () => setModal(null);
    const afterSave  = () => { closeModal(); onRefresh(); };

    /* Cada cliente con lo que ha comprado. Los pedidos se cruzan por
       teléfono —lo único que siempre llega desde WhatsApp— y, si no hay,
       por correo o por nombre exacto. */

    const conCompras = useMemo(() => customers.map(c => {
        const tel = soloDigitos(c.phone);
        const correo = (c.email || '').toLowerCase();
        const suyos = orders.filter(o =>
            (tel && soloDigitos(o.customer_phone) === tel) ||
            (correo && (o.customer_email || '').toLowerCase() === correo) ||
            (!tel && !correo && o.customer_name === c.name)
        );
        /* Lo que este cliente ha dejado de verdad, no lo que prometió. En
           contraentrega, un pedido en camino son $20.000, no $550.000. */
        const vivos = suyos.filter(estaVivo);
        const ultima = suyos.length
            ? suyos.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
            : null;
        return {
            ...c,
            /* Los vivos, no todos. Contar cancelados junto a "ha gastado $0"
               daba fichas que se contradecían solas: 10 pedidos, cero pesos. */
            pedidos: vivos.length,
            cancelados: suyos.length - vivos.length,
            gastado: suyos.reduce((s, o) => s + recibidoDe(o), 0),
            porCobrar: suyos.reduce((s, o) => s + porCobrarDe(o), 0),
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
            const q = norm(search).trim();
            return !q
                || norm(c.name).includes(q)
                || norm(c.email).includes(q)
                || norm(c.city).includes(q)
                || coincideTelefono(c.phone, search);
        })
        /* norm() y (a.name || '') porque la columna name admite nulos. Hoy no
           llega ninguno —el panel guarda .trim() y wa-webhook sólo hace upsert
           si hay nombre—, pero un solo null tumbaba la sección entera, y esta
           lista se llena desde WhatsApp. */
        .sort((a, b) => b.gastado - a.gastado || (a.name || '').localeCompare(b.name || ''));

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
                        {customers.length} en el registro · ordenados por lo que han gastado
                    </p>
                </div>
                <button className="btn-pill black" onClick={() => setModal({ type: 'add' })}>
                    Registrar un cliente
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
                    <div className="riel" role="group" aria-label="Filtrar clientes">
                        {[['todas', 'Todos'], ['con_pedido', 'Han comprado'], ['repiten', 'Vuelven'], ['sin_pedido', 'Sin pedidos']].map(([v, l]) => (
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
                            aria-label="Buscar cliente"
                        />
                    </label>
                </div>

                {loading ? (
                    <p className="ped-vacio">Cargando clientes…</p>
                ) : visible.length === 0 ? (
                    <div className="ped-vacio-bloque">
                        <span className="ped-vacio-icono">✦</span>
                        <p className="ped-vacio-t">
                            {customers.length === 0 ? 'Todavía no hay clientes' : 'Ninguno coincide con ese filtro'}
                        </p>
                        {customers.length === 0 && (
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
                                            <span className="ped-cliente-nombre">{c.name}</span>
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
                    onConfirm={async () => {
                        const res = await supabase.from('customers').delete().eq('id', modal.customer.id);
                        if (res.error) return res;
                        afterSave();
                    }}
                />
            )}
        </div>
    );
};

/* ─── ReportsSection ─────────────────────────────────────────────── */
/* Era una segunda copia de la fórmula de la comisión. Se queda el nombre para
   no tocar cinco sitios, pero la cuenta ya vive en un solo lugar. */

export default CustomersSection;
