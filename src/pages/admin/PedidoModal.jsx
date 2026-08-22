/**
 * Cargar un pedido a mano.
 *
 * Es lo que se usa cuando la venta pasó por fuera del sitio: la clienta
 * escribió por WhatsApp, o llegó al taller, y alguien tiene que dejarlo
 * anotado. Antes eran catorce campos en una columna sin separación, y el
 * botón de crear se quedaba encendido hasta que uno lo pulsaba y salía un
 * error rojo diciendo cuál faltaba.
 *
 * Ahora el pie dice qué falta ANTES de intentarlo: «Falta el WhatsApp y el
 * monto». Un botón apagado sin explicación obliga a adivinar; nombrar lo que
 * falta convierte el error en una instrucción.
 *
 * Y el método de pago explica qué implica cada uno. Contra entrega no es sólo
 * una etiqueta: significa que hay un tope, que se cobra un abono y que hay
 * que confirmar la dirección antes de despachar. Eso lo tenía que saber quien
 * llena el formulario, y no estaba escrito en ninguna parte.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const ESTADOS = [
    { id: 'pendiente', label: 'Pendiente' },
    { id: 'pagado', label: 'Pagado' },
    { id: 'procesando', label: 'Procesando' },
    { id: 'enviado', label: 'Enviado' },
    { id: 'entregado', label: 'Entregado' },
    { id: 'cancelado', label: 'Cancelado' },
];

/* Lo que cada método implica de verdad para este negocio. La nota no es
   decoración: quien carga el pedido tiene que saber qué pasa después. */
const PAGOS = [
    {
        id: 'contraentrega', label: 'Contra entrega',
        nota: 'La clienta paga en efectivo al recibir. Se cobra el abono del envío por adelantado y hay un tope; confirma la dirección por WhatsApp antes de despachar.',
    },
    {
        id: 'mercadopago', label: 'Mercado Pago',
        nota: 'Se manda el enlace por WhatsApp. El pedido pasa a Pagado solo cuando Mercado Pago avisa, no cuando la clienta dice que pagó.',
    },
    {
        id: 'nequi', label: 'Nequi',
        nota: 'Transferencia directa. Nadie avisa cuando entra, así que hay que confirmarla a mano y guardar el comprobante en las notas.',
    },
    {
        id: 'daviplata', label: 'Daviplata',
        nota: 'Igual que Nequi: la plata entra sin avisar. Confírmala y deja el comprobante en las notas.',
    },
    {
        id: 'transferencia', label: 'Transferencia',
        nota: 'Bancolombia u otra cuenta. Adjunta el comprobante en las notas antes de marcarlo como pagado.',
    },
    {
        id: 'efectivo', label: 'Efectivo',
        nota: 'Pagado en persona, en el taller. No hay nada que confirmar después.',
    },
];

const CARRIERS = ['Servientrega', 'Interrapidisimo', 'Coordinadora', 'Otro'];
const NOTAS_SUGERIDAS = 240;

const texto = (v) => String(v ?? '').trim();
const fmt = (n) => Math.round(n || 0).toLocaleString('es-CO');

/* Los montos llegan de Postgres como "550000.00". Quitar los puntos sin
   redondear antes convertiría eso en 55000000 — cien veces más caro y
   guardado sin que nada lo delate. Es el mismo cuidado que en la ficha de
   producto, y por la misma razón. */
const aDigitos = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.round(n)) : String(v).replace(/\D/g, '');
};
const numero = (v) => {
    const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? null : n;
};

const VACIO = {
    customer_name: '', customer_phone: '', customer_email: '',
    product_id: '', product_name: '', amount: '',
    status: 'pendiente', payment_method: 'contraentrega',
    notes: '', carrier: '', tracking_number: '',
    shipping_address: '', shipping_city: '', shipping_department: '',
};

const Regla = ({ children, extra }) => (
    <div className="pd-regla">
        <span className="pd-regla-t">{children}</span>
        <span className="pd-regla-linea" />
        {extra && <span className="pd-regla-extra">{extra}</span>}
    </div>
);

const Campo = ({ etiqueta, requerido, apunte, children }) => (
    <div className="pd-campo">
        <div className="pd-campo-cabeza">
            <label className="pd-label">{etiqueta}</label>
            {requerido && <span className="pd-requerido">Requerido</span>}
            {apunte && <span className="pd-apunte">{apunte}</span>}
        </div>
        {children}
    </div>
);

export default function PedidoModal({ order, products = [], onClose, onSaved }) {
    const isEdit = !!order?.id;

    const [form, setForm] = useState(() => {
        if (!isEdit) return { ...VACIO };
        return {
            ...VACIO, ...order,
            product_id: order.product_id || '',
            amount: aDigitos(order.amount),
            payment_method: order.payment_method || '',
            carrier: order.carrier || '',
            tracking_number: order.tracking_number || '',
        };
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const primeroRef = useRef(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', alTeclear);
        primeroRef.current?.focus();
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onClose]);

    /* Elegir del catálogo llena el nombre y el monto. Escribirlos a mano
       sigue valiendo: los encargos a la medida no están en el catálogo, y son
       buena parte de lo que vende este negocio. */
    const elegirPieza = (e) => {
        const pid = e.target.value;
        if (!pid) { setForm(f => ({ ...f, product_id: '' })); return; }
        const p = products.find(x => x.id === pid);
        if (p) setForm(f => ({ ...f, product_id: pid, product_name: p.name, amount: aDigitos(p.price) }));
    };

    const monto = numero(form.amount);

    /* Lo que falta, en el orden en que aparece en el formulario. Se nombra en
       vez de sólo apagar el botón: un botón apagado sin explicación obliga a
       repasar catorce campos buscando cuál es. */
    const falta = useMemo(() => {
        const f = [];
        if (!texto(form.customer_name)) f.push('el nombre');
        if (!texto(form.customer_phone)) f.push('el WhatsApp');
        if (!texto(form.product_name)) f.push('la pieza');
        if (!monto) f.push('el monto');
        return f;
    }, [form.customer_name, form.customer_phone, form.product_name, monto]);

    const listo = falta.length === 0;
    const enLista = (arr) => arr.join(', ').replace(/, ([^,]*)$/, ' y $1');

    const notaPago = PAGOS.find(p => p.id === form.payment_method)?.nota || '';
    const largoNotas = (form.notes || '').length;

    const guardar = async (e) => {
        e.preventDefault(); setError('');
        if (!listo) return;

        setSaving(true);
        const payload = {
            customer_name: texto(form.customer_name),
            customer_phone: texto(form.customer_phone) || null,
            customer_email: texto(form.customer_email) || null,
            product_id: form.product_id || null,
            product_name: texto(form.product_name),
            amount: monto,
            status: form.status,
            /* La columna es NOT NULL: mandar null devolvía un 23502 en crudo
               —"null value violates not-null constraint"— en la cara de quien
               sólo dejó el select sin tocar. */
            payment_method: form.payment_method || 'contraentrega',
            notes: texto(form.notes) || null,
            carrier: texto(form.carrier) || null,
            tracking_number: texto(form.tracking_number) || null,
            shipping_address: texto(form.shipping_address) || null,
            shipping_city: texto(form.shipping_city) || null,
            shipping_department: texto(form.shipping_department) || null,
        };
        if (!isEdit) payload.order_source = 'manual';

        let err, creado = null;
        try {
            if (isEdit) ({ error: err } = await supabase.from('orders').update(payload).eq('id', order.id));
            else ({ data: creado, error: err } = await supabase.from('orders').insert([payload]).select('id').single());
        } catch (ex) {
            err = ex;
        } finally {
            setSaving(false);
        }
        if (err) { setError(err.message || 'No se pudo guardar el pedido.'); return; }

        /* Un pedido cargado a mano y ya cobrado es una venta igual de real que
           las demás, y los anuncios tienen que enterarse. */
        const id = isEdit ? order.id : creado?.id;
        if (id && form.status === 'pagado') {
            try {
                await supabase.functions.invoke('conversion-pedido', { body: { pedidoId: id } });
            } catch (ex) {
                console.error('No se pudo avisar la venta a los anuncios:', ex);
            }
        }
        onSaved();
    };

    return (
        <div className="pd-velo" onClick={e => e.target === e.currentTarget && onClose()}>
            <form
                className="pd-caja"
                role="dialog"
                aria-modal="true"
                aria-label={isEdit ? 'Editar pedido' : 'Nuevo pedido'}
                onSubmit={guardar}
            >
                <header className="pd-cabeza">
                    <div>
                        <span className="pd-cabeza-ante">Pedidos · registro manual</span>
                        <h2 className="pd-cabeza-titulo">{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h2>
                        <p className="pd-cabeza-sub">
                            Cliente, pieza y envío. Se guarda en Pedidos y se puede editar después.
                        </p>
                    </div>
                    <button type="button" className="pd-cerrar" onClick={onClose} aria-label="Cerrar">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="pd-cuerpo">
                    {error && <p className="pd-error">{error}</p>}

                    <section className="pd-sec">
                        <Regla>Cliente</Regla>
                        <div className="pd-rejilla">
                            <Campo etiqueta="Nombre" requerido>
                                <input
                                    ref={primeroRef}
                                    className="pd-input"
                                    value={form.customer_name}
                                    onChange={e => set('customer_name', e.target.value)}
                                    placeholder="Ej: María González"
                                />
                            </Campo>
                            <Campo etiqueta="WhatsApp" requerido>
                                <input
                                    className="pd-input" type="tel" inputMode="tel"
                                    value={form.customer_phone}
                                    onChange={e => set('customer_phone', e.target.value)}
                                    placeholder="+57 300 000 0000"
                                />
                            </Campo>
                            <div className="pd-ancho">
                                <Campo etiqueta="Correo electrónico" apunte="opcional · para el comprobante">
                                    <input
                                        className="pd-input" type="email"
                                        value={form.customer_email || ''}
                                        onChange={e => set('customer_email', e.target.value)}
                                        placeholder="cliente@email.com"
                                    />
                                </Campo>
                            </div>
                        </div>
                    </section>

                    <section className="pd-sec">
                        <Regla>Pieza y pago</Regla>

                        {products.length > 0 && (
                            <Campo etiqueta="Buscar en el catálogo">
                                <div className="pd-select">
                                    <select value={form.product_id} onChange={elegirPieza}>
                                        <option value="">— Elegir una pieza del catálogo —</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} · ${fmt(p.price)}
                                            </option>
                                        ))}
                                    </select>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                                <span className="pd-ayuda">
                                    Al elegir una pieza se completan el nombre y el monto. Para un encargo
                                    a la medida, escríbelos a mano.
                                </span>
                            </Campo>
                        )}

                        <div className="pd-rejilla pd-rejilla--pieza">
                            <Campo etiqueta="Pieza" requerido>
                                <input
                                    className="pd-input"
                                    value={form.product_name}
                                    onChange={e => set('product_name', e.target.value)}
                                    placeholder="Ej: Anillo solitario oro 18k"
                                />
                            </Campo>
                            <Campo etiqueta="Monto" requerido>
                                <div className="pd-plata">
                                    <span className="pd-plata-signo">$</span>
                                    <input
                                        inputMode="numeric"
                                        value={form.amount ? fmt(numero(form.amount)) : ''}
                                        onChange={e => set('amount', e.target.value.replace(/\D/g, '').slice(0, 12))}
                                        placeholder="0"
                                    />
                                    <span className="pd-plata-cop">COP</span>
                                </div>
                            </Campo>
                        </div>

                        <Campo etiqueta="Estado">
                            <div className="pd-fichas">
                                {ESTADOS.map(s => (
                                    <button
                                        key={s.id} type="button"
                                        className={`pd-ficha${form.status === s.id ? ' pd-ficha--on' : ''}`}
                                        onClick={() => set('status', s.id)}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </Campo>

                        <Campo etiqueta="Método de pago">
                            <div className="pd-fichas">
                                {PAGOS.map(p => (
                                    <button
                                        key={p.id} type="button"
                                        className={`pd-ficha${form.payment_method === p.id ? ' pd-ficha--on' : ''}`}
                                        onClick={() => set('payment_method', p.id)}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            {/* Qué implica de verdad el método elegido. No estaba escrito
                                en ninguna parte y es lo que decide qué hay que hacer
                                después de cerrar este formulario. */}
                            <span className="pd-ayuda pd-ayuda--nota">
                                {notaPago || 'Elige cómo va a pagar para saber qué hay que confirmar después.'}
                            </span>
                        </Campo>
                    </section>

                    <section className="pd-sec">
                        <Regla extra={<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>24 a 48 horas hábiles</>}>Envío</Regla>

                        <Campo etiqueta="Dirección" apunte="calle, número, barrio y detalles de entrega">
                            <input
                                className="pd-input"
                                value={form.shipping_address || ''}
                                onChange={e => set('shipping_address', e.target.value)}
                                placeholder="Cra 43A # 18-95, apto 402, El Poblado"
                            />
                        </Campo>

                        <div className="pd-rejilla">
                            <Campo etiqueta="Ciudad">
                                <input
                                    className="pd-input"
                                    value={form.shipping_city || ''}
                                    onChange={e => set('shipping_city', e.target.value)}
                                    placeholder="Ej: Bogotá"
                                />
                            </Campo>
                            <Campo etiqueta="Departamento">
                                <input
                                    className="pd-input"
                                    value={form.shipping_department || ''}
                                    onChange={e => set('shipping_department', e.target.value)}
                                    placeholder="Ej: Cundinamarca"
                                />
                            </Campo>
                        </div>

                        {/* Sólo al editar: la guía no existe hasta que el paquete sale,
                            y pedirla al crear el pedido sería pedir algo que nadie tiene
                            todavía. */}
                        {isEdit && (
                            <div className="pd-rejilla">
                                <Campo etiqueta="Transportadora">
                                    <div className="pd-select">
                                        <select value={form.carrier} onChange={e => set('carrier', e.target.value)}>
                                            <option value="">— Sin transportadora —</option>
                                            {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </Campo>
                                <Campo etiqueta="Número de guía">
                                    <input
                                        className="pd-input"
                                        value={form.tracking_number}
                                        onChange={e => set('tracking_number', e.target.value)}
                                        placeholder="Número de seguimiento"
                                    />
                                </Campo>
                            </div>
                        )}

                        <div className="pd-campo">
                            <div className="pd-campo-cabeza">
                                <label className="pd-label">Notas internas</label>
                                <span className="pd-apunte">opcional · no las ve la clienta</span>
                                <span className={`pd-cuenta${largoNotas > NOTAS_SUGERIDAS ? ' pd-cuenta--pasada' : ''}`}>
                                    {largoNotas}/{NOTAS_SUGERIDAS}
                                </span>
                            </div>
                            <textarea
                                className="pd-input pd-area" rows={3}
                                value={form.notes || ''}
                                onChange={e => set('notes', e.target.value)}
                                placeholder="Talla 14, grabado interior «M&J», entrega antes del 12"
                            />
                        </div>
                    </section>
                </div>

                <footer className="pd-pie">
                    <div className="pd-pie-estado">
                        <span className="pd-pie-rotulo">{listo ? 'Total del pedido' : 'Falta por completar'}</span>
                        <span className={`pd-pie-valor${listo ? '' : ' pd-pie-valor--falta'}`}>
                            {listo
                                ? `$${fmt(monto)} COP${form.payment_method ? ` · ${PAGOS.find(p => p.id === form.payment_method)?.label}` : ''}`
                                : enLista(falta)}
                        </span>
                    </div>
                    <div className="pd-pie-botones">
                        <button type="button" className="pd-btn pd-btn--claro" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="pd-btn pd-btn--oscuro" disabled={!listo || saving}>
                            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear pedido'}
                        </button>
                    </div>
                </footer>
            </form>
        </div>
    );
}
