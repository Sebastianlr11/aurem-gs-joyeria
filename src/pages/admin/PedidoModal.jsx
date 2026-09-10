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
import { fotoProducto } from '../../lib/fotoProducto';
import { laVentaEntro } from '../../lib/dinero';
import { CARRIERS, ORDER_STATUSES, STATUS_META } from './secciones/comunes';

/* Los estados y las transportadoras salen de `comunes.js`, no de una lista
   propia. Este archivo tenía las suyas, y se quedaron viejas: sin
   `confirmado` ni `devuelto` —del 24 de agosto de 2026— y con cuatro
   transportadoras cuando la tabla de Pedidos ya ofrecía seis. Lo grave era lo
   primero: `confirmado` es el estado en el que nace TODO contraentrega desde
   el 1 de septiembre, y al editar uno el formulario no marcaba ningún chip;
   un clic en cualquiera lo sacaba de ahí sin querer. Se vio el 6 de
   septiembre de 2026. */

/* Lo que cada método implica de verdad para este negocio. La nota no es
   decoración: quien carga el pedido tiene que saber qué pasa después. */
const PAGOS = [
    {
        id: 'contraentrega', label: 'Contra entrega',
        nota: 'La clienta paga todo en efectivo al recibir, sin abono. Sólo Bogotá y hasta el tope; confirma la dirección por WhatsApp antes de despachar.',
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
    costo_taller: '', costo_envio: '',
};

/* ── Las piezas del pedido ──────────────────────────────────────────────
 *
 * Un pedido lleva las que sean, no una. La base ya lo soportaba desde que
 * existe `order_items` —el checkout de la web mete varias sin problema—; el
 * que se había quedado atrás era este formulario, y obligaba a partir en dos
 * pedidos una venta que fue una sola. Eso no es sólo incómodo: parte el
 * importe, duplica el cliente en los informes y le manda dos conversiones a
 * Meta por una compra.
 *
 * La convención de cómo conviven las dos tablas NO se inventa aquí, se copia
 * de `create-preference`, que es quien la estableció:
 *
 *   · `orders.product_name` → el resumen pegado, «Anillo A + Dije B x2»
 *   · `orders.product_id`   → el de la primera pieza
 *   · `orders.amount`       → el total que se cobra
 *   · `order_items`         → las piezas de verdad, una fila cada una
 *
 * El nombre pegado sigue existiendo porque medio sistema lo lee: la tabla de
 * Pedidos, los avisos de WhatsApp, la búsqueda de duplicados. Es un resumen,
 * no la verdad.
 */

/** Una línea vacía, para un encargo a la medida que no está en el catálogo. */
const lineaVacia = () => ({
    clave: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    product_id: '', nombre: '', precio: '', cantidad: 1, talla: '',
});

const lineaDePieza = (p) => ({
    ...lineaVacia(),
    product_id: p.id,
    nombre: p.name,
    precio: aDigitos(p.price),
});

/** El resumen pegado. Misma fórmula que `create-preference`, a propósito. */
const nombrePegado = (piezas) => piezas
    .filter((l) => texto(l.nombre))
    .map((l) => (Number(l.cantidad) > 1 ? `${texto(l.nombre)} x${l.cantidad}` : texto(l.nombre)))
    .join(' + ');

const sumaDe = (piezas) => piezas.reduce(
    (t, l) => t + (numero(l.precio) || 0) * (Number(l.cantidad) || 1),
    0,
);

/**
 * Escribe las piezas de un pedido en `order_items`, reemplazando las que haya.
 *
 * `precio` y `cantidad` tienen CHECK en la base (`>= 0` y `> 0`): una línea sin
 * precio entra en cero —que es un dato, «va incluida»— pero una cantidad en
 * cero reventaría la inserción entera con un error de Postgres en crudo.
 */
async function guardarPiezas(orderId, lineas, esEdicion) {
    if (esEdicion) {
        const { error } = await supabase.from('order_items').delete().eq('order_id', orderId);
        if (error) return { error };
    }
    if (!lineas.length) return { error: null };

    return supabase.from('order_items').insert(lineas.map((l) => ({
        order_id: orderId,
        product_id: l.product_id || null,
        nombre: texto(l.nombre),
        precio: numero(l.precio) || 0,
        cantidad: Math.max(1, Number(l.cantidad) || 1),
        talla: texto(l.talla) || null,
    })));
}

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

/**
 * @param inicial     datos con los que arranca un pedido nuevo — el nombre y el
 *                    WhatsApp del chat desde el que se registra
 * @param atribucion  `{ ctwa_clid, anuncio_id }` de la conversación. Es lo que
 *                    permite que Meta le acredite la venta al anuncio que la
 *                    trajo; sin esto un pedido registrado a mano queda anotado
 *                    en el panel y mudo para las campañas.
 */
export default function PedidoModal({ order, products = [], onClose, onSaved, inicial, atribucion }) {
    const isEdit = !!order?.id;

    const [form, setForm] = useState(() => {
        if (!isEdit) return { ...VACIO, ...(inicial || {}) };
        return {
            ...VACIO, ...order,
            product_id: order.product_id || '',
            amount: aDigitos(order.amount),
            payment_method: order.payment_method || '',
            carrier: order.carrier || '',
            tracking_number: order.tracking_number || '',
            costo_taller: aDigitos(order.costo_taller),
            costo_envio: aDigitos(order.costo_envio),
        };
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const primeroRef = useRef(null);

    /* Las piezas. En un pedido nuevo arranca con una línea del catálogo si
       viene sugerida; al editar se cargan de `order_items` en un efecto. */
    const [piezas, setPiezas] = useState(() => (isEdit ? [] : [lineaVacia()]));

    /* Si el monto se escribió a mano, deja de seguir a la suma de las piezas.
       Hace falta porque las dos cosas son legítimas: lo normal es cobrar lo
       que suman, y a veces se hace un descuento o se redondea. Sin esta
       bandera, añadir una pieza le pisaría al joyero el número que acababa de
       escribir. */
    const [montoTocado, setMontoTocado] = useState(isEdit);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', alTeclear);
        primeroRef.current?.focus();
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onClose]);

    /* Las piezas de un pedido que ya existe.
     *
     * Si no tiene filas —los de antes de que existiera `order_items`— se arma
     * una sola línea con lo que hay en la orden. Es el mismo respaldo que hace
     * `piezasDelPedido` en `_shared/pedidos.ts` para los correos: un pedido con
     * una pieza es mejor que un formulario en blanco que, al guardar, le
     * borraría al joyero la que tenía. */
    useEffect(() => {
        if (!isEdit) return undefined;
        let vivo = true;

        supabase
            .from('order_items')
            .select('product_id, nombre, precio, cantidad, talla')
            .eq('order_id', order.id)
            .order('creado_en')
            .then(({ data }) => {
                if (!vivo) return;
                const filas = (data ?? []).map((f) => ({
                    ...lineaVacia(),
                    product_id: f.product_id || '',
                    nombre: f.nombre || '',
                    precio: aDigitos(f.precio),
                    cantidad: Number(f.cantidad) || 1,
                    talla: f.talla || '',
                }));
                setPiezas(filas.length ? filas : [{
                    ...lineaVacia(),
                    product_id: order.product_id || '',
                    nombre: order.product_name || '',
                    precio: aDigitos(order.amount),
                }]);
            });

        return () => { vivo = false; };
    }, [isEdit, order?.id, order?.product_id, order?.product_name, order?.amount]);

    const cambiarLinea = (clave, campo, valor) =>
        setPiezas((ls) => ls.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)));

    const quitarLinea = (clave) =>
        setPiezas((ls) => (ls.length > 1 ? ls.filter((l) => l.clave !== clave) : ls));

    /* Elegir del catálogo AÑADE una pieza; no reemplaza la que hubiera. Si la
       última línea está en blanco se rellena ésa en vez de dejar un hueco. */
    const agregarDelCatalogo = (e) => {
        const pid = e.target.value;
        e.target.value = '';
        const p = products.find((x) => x.id === pid);
        if (!p) return;
        setPiezas((ls) => {
            const ultima = ls[ls.length - 1];
            if (ultima && !texto(ultima.nombre) && !ultima.product_id) {
                return [...ls.slice(0, -1), { ...lineaDePieza(p), clave: ultima.clave }];
            }
            return [...ls, lineaDePieza(p)];
        });
    };

    const suma = sumaDe(piezas);

    /* El monto sigue a la suma de las piezas mientras nadie lo haya escrito a
       mano. Se hace en un efecto y no al vuelo porque el campo es editable: es
       una sugerencia que se actualiza, no un cálculo que manda. */
    useEffect(() => {
        if (montoTocado) return;
        setForm((f) => {
            const nuevo = suma ? String(suma) : '';
            return f.amount === nuevo ? f : { ...f, amount: nuevo };
        });
    }, [suma, montoTocado]);

    const monto = numero(form.amount);

    /* Sólo cuentan las líneas con nombre: una en blanco es la que está a medio
       llenar, no una pieza. */
    const conNombre = useMemo(() => piezas.filter((l) => texto(l.nombre)), [piezas]);

    /* Lo que este pedido deja de verdad. No sale del catálogo: sale de lo que
       costó ESTE pedido, anotado cuando ya se sabe. Ver la migración
       20260823_costos_del_pedido.sql. */
    const costoTaller = numero(form.costo_taller);
    const costoEnvio = numero(form.costo_envio);
    const hayCosto = costoTaller !== null || costoEnvio !== null;
    const deja = hayCosto ? monto - (costoTaller || 0) - (costoEnvio || 0) : null;
    const margen = deja !== null && monto > 0 ? Math.round((deja / monto) * 100) : null;

    /* Lo que falta, en el orden en que aparece en el formulario. Se nombra en
       vez de sólo apagar el botón: un botón apagado sin explicación obliga a
       repasar catorce campos buscando cuál es. */
    const falta = useMemo(() => {
        const f = [];
        if (!texto(form.customer_name)) f.push('el nombre');
        if (!texto(form.customer_phone)) f.push('el WhatsApp');
        if (!conNombre.length) f.push('la pieza');
        if (!monto) f.push('el monto');
        return f;
    }, [form.customer_name, form.customer_phone, conNombre.length, monto]);

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
            /* El resumen pegado y el id de la primera, como los deja
               `create-preference`. Las piezas de verdad van a `order_items`
               justo después de guardar. */
            product_id: conNombre[0]?.product_id || null,
            product_name: nombrePegado(conNombre),
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
            /* Vacío es "todavía no se sabe", no cero. Un costo de cero diría
               que la pieza salió gratis, y el margen mentiría hacia arriba. */
            costo_taller: costoTaller,
            costo_envio: costoEnvio,
            /* La fecha se pone la primera vez y no se vuelve a mover: sirve
               para distinguir un margen que es un hecho de uno que es un
               hueco, no para auditar ediciones. */
            costo_anotado_en: hayCosto ? (order?.costo_anotado_en || new Date().toISOString()) : null,
        };
        if (!isEdit) {
            payload.order_source = 'manual';
            /* La atribución de la conversación, si la trae.
             *
             * Va SÓLO al crear: en una edición sobrescribiría la que el pedido
             * ya tenga —la del checkout de la web, por ejemplo— con la del
             * chat, y esa venta se le acreditaría al anuncio equivocado.
             *
             * Y sólo lo que exista: escribir `null` encima de un identificador
             * bueno es perderlo. */
            if (atribucion?.ctwa_clid) payload.ctwa_clid = atribucion.ctwa_clid;
            if (atribucion?.anuncio_id) payload.anuncio_id = atribucion.anuncio_id;
        }

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

        /* Las piezas, a su tabla.
         *
         * Se borran y se vuelven a escribir en vez de intentar casar fila por
         * fila: son dos o tres líneas que alguien acaba de revisar en pantalla,
         * y un emparejamiento sutil aquí es un sitio donde perder una pieza sin
         * que se note. `order_items` cae en cascada con el pedido, así que el
         * borrado no puede dejar huérfanas.
         *
         * Si esto falla, el pedido ya quedó creado y cobrable —el total y el
         * nombre pegado están en `orders`—, así que no se tumba la venta por
         * esto. Pero se dice, porque sin las filas el correo enseña una pieza
         * sola, el taller no sabe qué fabricar y el certificado sale sin talla.
         * Es la misma decisión que toma `create-preference`. */
        const idPedido = isEdit ? order.id : creado?.id;
        if (idPedido) {
            const { error: errPiezas } = await guardarPiezas(idPedido, conNombre, isEdit);
            if (errPiezas) {
                setError(
                    `El pedido se guardó, pero sus piezas no: ${errPiezas.message}. ` +
                    'Ábrelo otra vez y vuelve a guardarlo.',
                );
                return;
            }
        }

        /* Un pedido cargado a mano y ya cobrado es una venta igual de real que
           las demás, y los anuncios tienen que enterarse. Y si se cancela uno
           que ya se contó, también: es la única forma de que la cancelación
           salga en el Administrador de eventos.

           Aquí es donde tiene que estar y no en changeStatus(), porque cancelar
           un pedido se hace editándolo, no avanzándolo — la tabla de Pedidos
           sólo ofrece el paso siguiente del flujo, y 'cancelado' nunca lo es.

           Los dos avisos son idempotentes del lado del servidor: cada uno tiene
           su candado y la cancelación además exige que la venta se haya avisado
           antes, así que no pasa nada si esto se dispara de más. */
        const id = isEdit ? order.id : creado?.id;
        /* `laVentaEntro` y no `status === 'pagado'`, que es lo que decía antes.
           En contraentrega `pagado` no significa que entró la plata —el abono,
           cuando lo había, no era la venta— y lo que cuenta es `entregado`. Con
           la condición vieja, una venta cerrada por WhatsApp y registrada a
           mano como entregada **no le llegaba a Meta**, que es justo lo único
           que este formulario viene a arreglar. La regla vive en dinero.js
           porque la comparte con el botón de estado de la tabla de Pedidos. */
        const aviso =
            laVentaEntro({ payment_method: form.payment_method }, form.status) ? {} :
            form.status === 'cancelado' ? { evento: 'cancelacion' } : null;

        if (id && aviso) {
            try {
                await supabase.functions.invoke('conversion-pedido', {
                    body: { pedidoId: id, ...aviso },
                });
            } catch (ex) {
                console.error('No se pudo avisar a los anuncios:', ex);
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
                            <Campo etiqueta="Añadir del catálogo">
                                <div className="pd-select">
                                    <select value="" onChange={agregarDelCatalogo}>
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
                                    Se añade a la lista con su precio. Puedes poner las que sean; para un
                                    encargo a la medida, escríbelo a mano abajo.
                                </span>
                            </Campo>
                        )}

                        <Campo etiqueta={piezas.length > 1 ? `Piezas · ${piezas.length}` : 'Pieza'} requerido>
                            <div className="pd-piezas">
                                {piezas.map((l) => {
                                    const p = products.find((x) => x.id === l.product_id);
                                    /* La foto es la comprobación: con nombres cortos y parecidos
                                       —«Anillo solitario clásico» y «Anillo solitario tallado»—
                                       elegir del desplegable es a ciegas, y el pedido sale con
                                       otra pieza sin que nada lo delate hasta el despacho. */
                                    const foto = p ? fotoProducto((Array.isArray(p.images) && p.images[0]) || p.image_url) : null;
                                    return (
                                        <div className="pd-pieza" key={l.clave}>
                                            <div className="pd-pieza-foto">
                                                {foto?.src
                                                    ? <img {...foto} sizes="56px" alt="" />
                                                    : <span className="pd-pieza-sinfoto" title="A la medida: no está en el catálogo">✦</span>}
                                            </div>

                                            <div className="pd-pieza-campos">
                                                <input
                                                    className="pd-input pd-pieza-nombre"
                                                    value={l.nombre}
                                                    onChange={e => cambiarLinea(l.clave, 'nombre', e.target.value)}
                                                    placeholder="Ej: Anillo solitario oro 18k"
                                                />
                                                <div className="pd-pieza-fila">
                                                    <div className="pd-plata pd-pieza-precio">
                                                        <span className="pd-plata-signo">$</span>
                                                        <input
                                                            inputMode="numeric"
                                                            value={l.precio ? fmt(numero(l.precio)) : ''}
                                                            onChange={e => cambiarLinea(l.clave, 'precio', e.target.value.replace(/\D/g, '').slice(0, 12))}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <input
                                                        className="pd-input pd-pieza-chico"
                                                        inputMode="numeric"
                                                        value={l.cantidad}
                                                        onChange={e => cambiarLinea(l.clave, 'cantidad', e.target.value.replace(/\D/g, '').slice(0, 2))}
                                                        onBlur={e => cambiarLinea(l.clave, 'cantidad', Math.max(1, Number(e.target.value) || 1))}
                                                        aria-label="Cantidad"
                                                        title="Cantidad"
                                                    />
                                                    {/* La talla viaja aquí y no en las notas: la lee el
                                                        correo de confirmación y el certificado. */}
                                                    <input
                                                        className="pd-input pd-pieza-chico"
                                                        value={l.talla}
                                                        onChange={e => cambiarLinea(l.clave, 'talla', e.target.value)}
                                                        placeholder="Talla"
                                                        aria-label="Talla"
                                                        title="Talla, si aplica"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className="pd-pieza-quitar"
                                                onClick={() => quitarLinea(l.clave)}
                                                disabled={piezas.length === 1}
                                                title={piezas.length === 1 ? 'Un pedido lleva al menos una pieza' : 'Quitar esta pieza'}
                                                aria-label="Quitar esta pieza"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                className="pd-anadir"
                                onClick={() => setPiezas((ls) => [...ls, lineaVacia()])}
                            >
                                + Añadir otra pieza
                            </button>
                        </Campo>

                        <Campo
                            etiqueta="Monto total"
                            requerido
                            apunte={piezas.length > 1 ? `${conNombre.length} pieza${conNombre.length !== 1 ? 's' : ''}` : undefined}
                        >
                            <div className="pd-plata">
                                <span className="pd-plata-signo">$</span>
                                <input
                                    inputMode="numeric"
                                    value={form.amount ? fmt(numero(form.amount)) : ''}
                                    onChange={e => {
                                        setMontoTocado(true);
                                        set('amount', e.target.value.replace(/\D/g, '').slice(0, 12));
                                    }}
                                    placeholder="0"
                                />
                                <span className="pd-plata-cop">COP</span>
                            </div>
                            {/* Que el total no cuadre con las piezas es legítimo —un descuento,
                                un redondeo—, así que se dice y no se corrige. Lo que no puede
                                pasar es que nadie se entere. */}
                            {suma > 0 && monto !== null && monto !== suma ? (
                                <span className="pd-ayuda">
                                    Las piezas suman ${fmt(suma)}. Estás cobrando ${fmt(monto)}
                                    {monto < suma ? ` — ${fmt(suma - monto)} menos.` : ` — ${fmt(monto - suma)} más.`}
                                    {' '}
                                    <button type="button" className="pd-enlace" onClick={() => { setMontoTocado(false); set('amount', String(suma)); }}>
                                        Usar la suma
                                    </button>
                                </span>
                            ) : (
                                <span className="pd-ayuda">Lo que paga la clienta por todo el pedido.</span>
                            )}
                        </Campo>

                        <Campo etiqueta="Estado">
                            <div className="pd-fichas">
                                {ORDER_STATUSES.map(s => (
                                    <button
                                        key={s} type="button"
                                        className={`pd-ficha${form.status === s ? ' pd-ficha--on' : ''}`}
                                        onClick={() => set('status', s)}
                                    >
                                        {STATUS_META[s]?.label ?? s}
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
                        <Regla extra={<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>3 a 4 días en Bogotá</>}>Entrega</Regla>

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

                        {/* Sólo al editar, y por la misma razón que la guía: cuando
                            se crea el pedido nadie sabe todavía qué va a costar. El
                            costo se anota cuando el taller entrega y el flete ya se
                            pagó — ese es el momento en que el número existe.

                            Antes esto vivía en el catálogo, como un costo fijo por
                            pieza. Con el oro moviéndose eso era imposible de mantener
                            y terminaba lleno de estimaciones, así que los márgenes del
                            panel salían de una predicción. Aquí salen de un hecho, y
                            queda congelado en este pedido igual que el precio. */}
                        {isEdit && (
                            <>
                                <Regla extra="cuando ya se sepa">Lo que costó</Regla>

                                <div className="pd-rejilla">
                                    <Campo etiqueta="Costo del taller" apunte="oro, mano de obra, estuche">
                                        <input
                                            className="pd-input"
                                            inputMode="numeric"
                                            value={form.costo_taller}
                                            onChange={e => set('costo_taller', e.target.value.replace(/\D/g, ''))}
                                            placeholder="Déjalo vacío si aún no lo sabes"
                                        />
                                    </Campo>
                                    <Campo etiqueta="Costo del flete" apunte="lo que se pagó, no lo que cobraste">
                                        <input
                                            className="pd-input"
                                            inputMode="numeric"
                                            value={form.costo_envio}
                                            onChange={e => set('costo_envio', e.target.value.replace(/\D/g, ''))}
                                            placeholder="Déjalo vacío si aún no lo sabes"
                                        />
                                    </Campo>
                                </div>

                                <span className="pd-ayuda">
                                    {deja === null
                                        ? 'Sin esto el panel puede decir cuánto vendiste, pero no cuánto te quedó.'
                                        : deja <= 0
                                            ? `Este pedido pierde $${fmt(-deja)}: cuesta más de lo que se cobró.`
                                            : <>Este pedido deja <strong>${fmt(deja)}</strong>{margen !== null && ` (${margen} %)`}, antes de pauta y comisiones.</>}
                                </span>
                            </>
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

                {/* El error se repite en el pie, y no es redundancia.
                    El banner vive arriba de `.pd-cuerpo`, que es lo que hace
                    scroll; quien acaba de llenar el formulario está abajo, con el
                    dedo en «Crear pedido», y el aviso le queda fuera de pantalla.
                    El 9 de septiembre de 2026 eso hizo que un pedido se creara dos
                    veces: el guardado de las piezas falló, el error salió arriba y
                    desde abajo parecía que el botón no hacía nada. El pie NO
                    scrollea, así que aquí no se puede perder. */}
                <footer className={`pd-pie${error ? ' pd-pie--error' : ''}`}>
                    <div className="pd-pie-estado">
                        <span className="pd-pie-rotulo">
                            {error ? 'No se pudo guardar' : listo ? 'Total del pedido' : 'Falta por completar'}
                        </span>
                        <span className={`pd-pie-valor${error ? ' pd-pie-valor--error' : listo ? '' : ' pd-pie-valor--falta'}`}>
                            {error
                                ? error
                                : listo
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
