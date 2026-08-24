/**
 * Panel · Reportes — Analítica de ventas, canales y retorno de pauta.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026 con los ayudantes que sólo usa
 * esta pantalla. El código se movió tal cual: lo que comparte con otras
 * secciones vive en `comunes.jsx`.
 */
import React, { useEffect, useState } from 'react';
import { estaVivo, porCobrarDe, recibidoDe } from '../../../lib/dinero';
import { supabase } from '../../../lib/supabase';
import PautaRetorno from '../PautaRetorno';
import { ORDER_STATUSES, SOURCE_META, STATUS_META, calcMPNet, enGrupo, fmt, fmtDate, isCOD } from './comunes';

const ReportsSection = ({ orders, products = [], verPruebas = false, onNavigate }) => {
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
    const paidFiltered = filtered.filter(estaVivo);

    /* Mismo tramo, inmediatamente anterior, para poder comparar */
    const periodDays = period === 'todo' ? null : parseInt(period);
    const prevStart = periodDays ? new Date(new Date(periodStart).setDate(periodStart.getDate() - periodDays)) : null;
    const prevFiltered = periodDays
        ? orders.filter(o => { const d = new Date(o.created_at); return d >= prevStart && d < periodStart; })
        : [];
    const prevPaid = prevFiltered.filter(estaVivo);
    const hayComparacion = periodDays && prevFiltered.length > 0;

    /* Revenue breakdown */
    /* Dos números distintos y a propósito separados: lo que entró y lo que
       falta entrar. Mezclarlos era decir que se vendió medio millón cuando
       en la cuenta había veinte mil. */
    const porCobrarTotal = paidFiltered.reduce((s, o) => s + porCobrarDe(o), 0);
    const mpOrders = paidFiltered.filter(o => !isCOD(o));
    const codOrders = paidFiltered.filter(o => isCOD(o));
    const mpGross = mpOrders.reduce((s, o) => s + Number(o.amount), 0);
    const mpNet = mpOrders.reduce((s, o) => s + calcMPNet(Number(o.amount)), 0);
    const mpFees = mpGross - mpNet;
    const codTotal = codOrders.reduce((s, o) => s + recibidoDe(o), 0);
    const netTotal = mpNet + codTotal;

    const prevNetTotal = prevPaid.reduce((s, o) => s + (isCOD(o) ? recibidoDe(o) : calcMPNet(Number(o.amount))), 0);

    /* El ticket promedio sí es el precio de lo que se vende, no lo que ya
       entró: mide qué tan caro compra la gente, no en qué punto va el cobro.
       Por eso este —y sólo este— sigue sumando el monto completo. */
    const vendidoTotal = paidFiltered.reduce((s, o) => s + Number(o.amount), 0);
    const avgOrder = paidFiltered.length ? Math.round(vendidoTotal / paidFiltered.length) : 0;
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
            revenue: dayOrders.reduce((s, o) => s + recibidoDe(o), 0),
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
        productRevenue[o.product_name] = (productRevenue[o.product_name] || 0) + recibidoDe(o);
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
        .map(([nombre, ingreso]) => {
            const ficha = productoPorId[idPorNombre[nombre]] || productoPorNombre[nombre];
            const unidades = productCounts[nombre] || 0;

            /* Lo que factura una pieza y lo que deja son cosas distintas. Dos
               anillos de $550.000 se ven idénticos aquí aunque uno deje
               $350.000 y el otro $80.000 — y si nadie lo ve, la pauta termina
               empujando el que menos deja.

               Este número salía del catálogo (`products.costo`), un costo fijo
               por pieza. Con el oro moviéndose eso no se podía mantener y se
               llenaba de estimaciones, así que el panel andaba avisando de que
               sus propios márgenes eran de relleno. Ahora sale de lo que
               costaron LOS PEDIDOS de esta pieza, anotado uno por uno al
               despachar y congelado ahí. Un margen menos, pero verdadero.

               Sólo cuentan los pedidos vivos: uno cancelado no dejó nada, y
               meterlo hundiría el margen de una pieza que se vende bien. */
            const conCosto = filtered.filter(o =>
                o.product_name === nombre && estaVivo(o) && o.costo_taller != null);

            const deja = conCosto.reduce((t, o) =>
                t + (Number(o.amount) - Number(o.costo_taller) - Number(o.costo_envio || 0)), 0);
            const facturado = conCosto.reduce((t, o) => t + Number(o.amount), 0);

            return {
                nombre,
                ingreso,
                unidades,
                deja: conCosto.length ? deja : null,
                margen: facturado > 0 ? Math.round((deja / facturado) * 100) : null,
                /* Sobre cuántas de las vendidas se sabe. Un margen calculado
                   sobre una de cinco no es mentira, pero tampoco es la pieza:
                   hay que decir sobre qué se calculó. */
                sobre: conCosto.length,
                imagen: ficha?.image_url || null,
            };
        });
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

    const porDespachar = filtered.filter(o => enGrupo(o, 'despachar')).length;
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
                                Plata que ya entró, con las comisiones descontadas
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

                    {/* Aparte, y a propósito. Lo comprometido no es ingreso:
                        el cliente todavía no ha pagado y el pedido se puede
                        caer en la puerta. */}
                    {porCobrarTotal > 0 && (
                        <p className="inf-neto-pendiente">
                            <span>Falta cobrar</span>
                            <strong>${fmt(porCobrarTotal)}</strong>
                            <span className="inf-neto-meta">al entregar</span>
                        </p>
                    )}
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
                        <span className="inf-kpi-s">Sobre ${fmt(vendidoTotal)} vendidos</span>
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

            <PautaRetorno orders={paidFiltered} periodStart={periodStart} periodDays={periodDays} verPruebas={verPruebas} />

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
                    {topPiezas.length > 0 && topPiezas.every(p => p.deja == null) && (
                        <p className="inf-aviso">
                            Ningún pedido de estas piezas tiene el costo anotado, así que el
                            panel puede decir cuál vende más pero no cuál deja más. Se anota
                            al editar el pedido, en «Lo que costó», cuando el taller ya
                            entregó y el flete ya se pagó.
                        </p>
                    )}
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
                                    {p.deja != null && (
                                        <> · deja <strong>${fmt(p.deja)}</strong> ({p.margen} %)
                                            {p.sobre < p.unidades && <em> · sobre {p.sobre} de {p.unidades}</em>}
                                        </>
                                    )}
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
                                <h2 className="inf-panel-titulo">Clientes</h2>
                                <span className="inf-panel-sub">Nuevas y que vuelven</span>
                            </div>
                            {(() => {
                                const nuevos = newVsReturning.nuevos || 0;
                                const vuelven = newVsReturning.recurrentes || 0;
                                const tot = nuevos + vuelven || 1;
                                return (
                                    <>
                                        <div className="inf-estados-barra">
                                            <div style={{ width: `${(nuevos / tot) * 100}%`, background: 'var(--ink)' }} />
                                            <div style={{ width: `${(vuelven / tot) * 100}%`, background: 'var(--oro)' }} />
                                        </div>
                                        <div className="inf-estado">
                                            <span className="inf-estado-punto" style={{ background: 'var(--ink)' }} />
                                            <span className="inf-estado-l">Compran por primera vez</span>
                                            <span className="inf-estado-n">{nuevos}</span>
                                            <span className="inf-estado-pct">{Math.round((nuevos / tot) * 100)} %</span>
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

export default ReportsSection;
