/**
 * Lo que cuesta traer un cliente, y si esa cuenta da.
 *
 * El panel sabía exactamente cuánto entra y nada de cuánto sale. Vender medio
 * millón se siente bien hasta que uno sabe que costó seiscientos mil traerlo,
 * y esa resta no estaba en ninguna pantalla.
 *
 * Dos cosas que este bloque hace y que la mayoría de paneles no:
 *
 * 1. Le suma el IVA a la pauta. Meta y TikTok reportan el gasto sin IVA, pero
 *    la factura llega con 19% encima. Contar sin él subestima el costo en casi
 *    una quinta parte — la diferencia entre una campaña que deja y una que no.
 *
 * 2. Separa el retorno de caja del retorno de venta. Contra entrega, una venta
 *    no es plata hasta que el domiciliario la entrega, y en Colombia una parte
 *    se cae en la puerta. Un solo número no puede decir las dos cosas.
 *
 * 3. Fecha las dos puntas igual. El gasto siempre vino filtrado por fecha,
 *    pero la plata salía del ESTADO de los pedidos creados en el periodo, que
 *    no tiene fecha de cobro. Entre pedir y cobrar pasan días —el taller se
 *    toma dos o tres en despachar y el envío otro tanto—, así que casi nunca
 *    caen en la misma ventana: el retorno dividía
 *    peras entre manzanas. Ahora la caja sale del libro de movimientos
 *    (src/lib/caja.js), fechada y neta de la comisión de Mercado Pago.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { estaVivo, esContraentrega } from '../../lib/dinero';
import { cajaEntre } from '../../lib/caja';

const fmt = (n) => Math.round(n || 0).toLocaleString('es-CO');

const CANALES = [
    { id: 'meta', label: 'Meta', nota: 'Instagram y Facebook' },
    { id: 'tiktok', label: 'TikTok', nota: 'Anuncios y lives' },
    { id: 'otro', label: 'Otro', nota: 'Cualquier otra pauta' },
];

/** Hoy en Bogotá, en formato AAAA-MM-DD, sin que el huso lo corra un día. */
const hoyEnBogota = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export default function PautaRetorno({ orders, periodStart, periodDays, verPruebas = false }) {
    const [gastos, setGastos] = useState([]);
    const [caja, setCaja] = useState(null);
    const [sinConfirmar, setSinConfirmar] = useState([]);
    const [iva, setIva] = useState(0.19);
    const [cargando, setCargando] = useState(true);
    const [abierto, setAbierto] = useState(false);
    const [form, setForm] = useState({ fecha: hoyEnBogota(), canal: 'meta', monto: '' });
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        /* El IVA vive en taller_precios, con el abono y el tope de contra
           entrega: son todas constantes del negocio. Deliberadamente NO en
           ajustes_internos, que guarda el secreto del cron y por eso está
           cerrada a la API entera. */
        const [{ data: g }, { data: t }, { data: p }] = await Promise.all([
            supabase.from('gasto_pauta').select('*').order('fecha', { ascending: false }),
            supabase.from('taller_precios').select('iva_pauta').limit(1).maybeSingle(),
            supabase.from('products').select('name').eq('costo_provisional', true),
        ]);
        setGastos(g || []);
        setSinConfirmar((p || []).map((x) => x.name));
        if (t?.iva_pauta != null) setIva(Number(t.iva_pauta));
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    /* La caja del MISMO periodo que el gasto. Cuelga de periodStart y no de
       cargar() porque es lo único que cambia cuando se mueve el selector de
       fechas de Reportes. */
    useEffect(() => {
        let vigente = true;
        cajaEntre(periodStart, null, { incluirPruebas: verPruebas })
            .then(c => { if (vigente) setCaja(c); });
        return () => { vigente = false; };
    }, [periodStart, verPruebas]);

    async function guardar(e) {
        e.preventDefault();
        const monto = Number(String(form.monto).replace(/\D/g, ''));
        if (!monto) { setError('Falta el monto.'); return; }
        setGuardando(true); setError('');

        /* Un día y un canal tienen un solo gasto. Si ya se anotó, se corrige
           en vez de duplicarse: anotar dos veces el mismo martes es el error
           fácil de cometer, y duplicaría el costo sin que nada lo delate. */
        const { error: err } = await supabase
            .from('gasto_pauta')
            .upsert({ fecha: form.fecha, canal: form.canal, monto }, { onConflict: 'fecha,canal' });

        setGuardando(false);
        if (err) { setError(err.message); return; }
        setForm(f => ({ ...f, monto: '' }));
        cargar();
    }

    async function borrar(id) {
        await supabase.from('gasto_pauta').delete().eq('id', id);
        cargar();
    }

    /* ── Las cuentas ──────────────────────────────────────────────── */

    const desde = periodStart ? new Date(periodStart) : null;
    const delPeriodo = desde
        ? gastos.filter(g => new Date(`${g.fecha}T12:00:00-05:00`) >= desde)
        : gastos;

    const gastoSinIva = delPeriodo.reduce((s, g) => s + Number(g.monto), 0);
    const gastoReal = gastoSinIva * (1 + iva);

    const vivos = orders.filter(estaVivo);

    /* La plata que ENTRÓ dentro del periodo, del libro de caja y neta de la
       comisión de Mercado Pago.

       Antes esto era `orders.reduce((s, o) => s + recibidoDe(o), 0)`: la plata
       de los pedidos CREADOS en el periodo, sin importar cuándo se cobró. El
       gasto sí venía fechado, así que el retorno dividía peras entre manzanas
       — y entre pedir y cobrar pasan días, así que casi nunca caen en la
       misma ventana. */
    const recibido = caja?.total ?? 0;

    const vendido = vivos.reduce((s, o) => s + Number(o.amount), 0);

    const roasCaja = gastoReal > 0 ? recibido / gastoReal : null;
    const roasVenta = gastoReal > 0 ? vendido / gastoReal : null;

    /* Cuánto cuesta cada pedido que se sostuvo. */
    const cac = gastoReal > 0 && vivos.length ? gastoReal / vivos.length : null;

    /* Contra entrega: de lo que salió, cuánto llegó a cobrarse. Es EL riesgo
       del modelo en Colombia —el paquete se devuelve en la puerta y el envío
       ya se pagó—, y hasta que haya entregas de verdad no se puede saber. */
    const cod = orders.filter(esContraentrega);
    const codSalidos = cod.filter(o => ['enviado', 'entregado'].includes(o.status));
    const codEntregados = codSalidos.filter(o => o.status === 'entregado');
    const tasaEntrega = codSalidos.length
        ? Math.round((codEntregados.length / codSalidos.length) * 100)
        : null;

    const porCanal = CANALES.map(c => ({
        ...c,
        monto: delPeriodo.filter(g => g.canal === c.id).reduce((s, g) => s + Number(g.monto), 0),
    })).filter(c => c.monto > 0);

    const sinGasto = gastoSinIva === 0;

    return (
        <section className="inf-panel pauta">
            <div className="inf-panel-head">
                <div>
                    <h2 className="inf-panel-titulo">Retorno de la pauta</h2>
                    <p className="inf-panel-sub">
                        {sinGasto
                            ? 'Anota lo que gastaste en anuncios y aquí sale si la cuenta da'
                            : `$${fmt(gastoReal)} de pauta ${periodDays ? `en ${periodDays} días` : 'en total'}, con el IVA incluido`}
                    </p>
                </div>
                <button type="button" className="pauta-anotar" onClick={() => setAbierto(v => !v)}>
                    {abierto ? 'Cerrar' : 'Anotar gasto'}
                </button>
            </div>

            {/* Sólo cuando ya hay gasto anotado. Antes de eso los costos de
                relleno no hacen daño —el panel se está armando— y un aviso
                permanente se vuelve parte del decorado y deja de leerse. El
                día que entra el primer peso de pauta, sí importa. */}
            {!sinGasto && sinConfirmar.length > 0 && (
                <p className="pauta-alerta">
                    <strong>Hay pauta corriendo con costos sin confirmar.</strong>{' '}
                    {sinConfirmar.length === 1
                        ? `${sinConfirmar[0]} tiene un costo de relleno`
                        : `${sinConfirmar.length} piezas tienen costos de relleno`}
                    , así que lo que el panel diga del margen es inventado. Pídeselos al
                    joyero antes de decidir cuánto gastar.
                </p>
            )}

            {abierto && (
                <form className="pauta-form" onSubmit={guardar}>
                    <label className="pauta-campo">
                        <span>Día</span>
                        <input
                            type="date" value={form.fecha} max={hoyEnBogota()}
                            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                        />
                    </label>
                    <label className="pauta-campo">
                        <span>Canal</span>
                        <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                            {CANALES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </label>
                    <label className="pauta-campo pauta-campo--monto">
                        <span>Gasto del día, sin IVA</span>
                        <input
                            type="text" inputMode="numeric" placeholder="50.000"
                            value={form.monto ? Number(String(form.monto).replace(/\D/g, '')).toLocaleString('es-CO') : ''}
                            onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                        />
                    </label>
                    <button type="submit" className="btn-pill black" disabled={guardando}>
                        {guardando ? 'Guardando…' : 'Anotar'}
                    </button>
                    <p className="pauta-ayuda">
                        El que reporta Meta o TikTok. El 19% de IVA lo suma el panel: lo que sale
                        de la cuenta es siempre 1,19 veces esto.
                    </p>
                    {error && <p className="pauta-error">{error}</p>}
                </form>
            )}

            {sinGasto ? (
                <p className="pauta-vacio">
                    Sin gasto anotado {periodDays ? `en estos ${periodDays} días` : 'todavía'}. Mientras no esté,
                    el panel enseña lo que entra sin poder decir si sobró.
                </p>
            ) : (
                <>
                    <div className="pauta-cifras">
                        <div className="pauta-cifra pauta-cifra--fuerte">
                            <span className="pauta-cifra-l">Retorno de caja</span>
                            <span className={`pauta-cifra-v ${roasCaja >= 1 ? 'pauta-bien' : 'pauta-mal'}`}>
                                {roasCaja === null ? '—' : `${roasCaja.toFixed(2).replace('.', ',')}×`}
                            </span>
                            <span className="pauta-cifra-s">
                                ${fmt(recibido)} entraron —neto de comisión— por ${fmt(gastoReal)} de pauta
                            </span>
                        </div>
                        <div className="pauta-cifra">
                            <span className="pauta-cifra-l">Retorno de venta</span>
                            <span className="pauta-cifra-v">
                                {roasVenta === null ? '—' : `${roasVenta.toFixed(2).replace('.', ',')}×`}
                            </span>
                            <span className="pauta-cifra-s">
                                Si se entrega y se cobra todo lo que está en camino
                            </span>
                        </div>
                        <div className="pauta-cifra">
                            <span className="pauta-cifra-l">Cuesta cada pedido</span>
                            <span className="pauta-cifra-v">{cac === null ? '—' : `$${fmt(cac)}`}</span>
                            <span className="pauta-cifra-s">
                                {vivos.length} pedido{vivos.length !== 1 ? 's' : ''} que no se cayeron
                            </span>
                        </div>
                        <div className="pauta-cifra">
                            <span className="pauta-cifra-l">Llegan a entregarse</span>
                            <span className="pauta-cifra-v">{tasaEntrega === null ? '—' : `${tasaEntrega} %`}</span>
                            <span className="pauta-cifra-s">
                                {tasaEntrega === null
                                    ? 'Hace falta la primera entrega para saberlo'
                                    : `${codEntregados.length} de ${codSalidos.length} contra entrega que salieron`}
                            </span>
                        </div>
                    </div>

                    {/* La frase que de verdad se necesita antes de subir el
                        presupuesto: no el múltiplo, sino cuánto hay que vender
                        mañana para no perder. */}
                    <p className="pauta-lectura">
                        {roasCaja >= 1
                            ? <>Por cada peso de pauta han vuelto <strong>${fmt(recibido / gastoReal)}</strong>. La cuenta da.</>
                            : <>Faltan <strong>${fmt(gastoReal - recibido)}</strong> por cobrar para que la pauta se pague sola.</>}
                    </p>

                    {porCanal.length > 1 && (
                        <div className="pauta-canales">
                            {porCanal.map(c => (
                                <div key={c.id} className="pauta-canal">
                                    <span>{c.label}</span>
                                    <strong>${fmt(c.monto * (1 + iva))}</strong>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {!cargando && delPeriodo.length > 0 && (
                <details className="pauta-detalle">
                    <summary>
                        {delPeriodo.length === 1 ? 'Ver el día anotado' : `Ver los ${delPeriodo.length} días anotados`}
                    </summary>
                    <ul className="pauta-lista">
                        {delPeriodo.map(g => (
                            <li key={g.id}>
                                <span>{new Date(`${g.fecha}T12:00:00-05:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                                <span className="pauta-lista-canal">{CANALES.find(c => c.id === g.canal)?.label || g.canal}</span>
                                <strong>${fmt(Number(g.monto) * (1 + iva))}</strong>
                                <button type="button" onClick={() => borrar(g.id)} title="Borrar este gasto">×</button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
