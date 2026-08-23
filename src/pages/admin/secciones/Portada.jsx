/**
 * Panel · Portada — La portada del panel: qué hay que atender hoy.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026 con los ayudantes que sólo usa
 * esta pantalla. El código se movió tal cual: lo que comparte con otras
 * secciones vive en `comunes.jsx`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { cajaDeLosUltimos } from '../../../lib/caja';
import { netoDeMercadoPago, porCobrarDe, recibidoDe } from '../../../lib/dinero';
import { supabase } from '../../../lib/supabase';
import { STATUS_META, VENTAS_VIVAS, despacharPedido, enGrupo, fmt, isCOD } from './comunes';
import { ShipModal } from './piezas';

const DIAS_PROMESA = 3;

/* La talla dentro del texto de la nota: "… | Ciudad: Bogotá | Talla: 4.5 ·
   Pedido tomado por Valentina". Aguanta coma o punto decimal. */

const JIcon = ({ name, size = 20 }) => {
    const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (name) {
        case 'bag': return <svg {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
        case 'truck': return <svg {...p}><rect x="1" y="6" width="13" height="11" rx="1" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>;
        case 'chevron': return <svg {...p} strokeWidth="1.6"><polyline points="9 18 15 12 9 6" /></svg>;
        case 'whatsapp': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.5a9.5 9.5 0 0 1-4.84-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.27-9.49 9.51-9.49 2.54 0 4.92.99 6.72 2.78a9.42 9.42 0 0 1 2.78 6.72c0 5.23-4.27 9.49-9.51 9.49M20.5 3.49A11.4 11.4 0 0 0 12.05 0C5.77 0 .66 5.1.66 11.37c0 2 .52 3.96 1.52 5.68L.56 24l7.1-1.86a11.4 11.4 0 0 0 5.44 1.38c6.28 0 11.39-5.1 11.39-11.37 0-3.04-1.19-5.9-3.34-8.05" /></svg>;
        default: return null;
    }
};

const RE_TALLA = /talla[:\s]+(\d+(?:[.,]\d+)?)/i;

/* Ingresos de un conjunto de pedidos. MercadoPago va neto de comisión y
   retenciones; el contraentrega cuenta lo que de verdad entró.

   Antes 'enviado' contaba como cobrado, y no lo es: el paquete va en camino
   y el cliente no ha pagado nada más que el abono del envío.

   La cuenta de la comisión de Mercado Pago estaba escrita aquí y otra vez en
   calcMPNet(), unas mil setecientas líneas más abajo. Ahora las dos llaman a
   netoDeMercadoPago() de src/lib/dinero.js: una sola fórmula, un solo sitio
   donde cambiarla si Mercado Pago sube sus tarifas. */

const ingresosDe = (pedidos) => {
    const mp = pedidos.filter(o => VENTAS_VIVAS.includes(o.status) && !isCOD(o));
    const mpNeto = mp.reduce((s, o) => s + netoDeMercadoPago(Number(o.amount)), 0);

    /* El abono del contraentrega también es plata que entró, aunque el
       pedido no esté cobrado del todo. Sin esto, los $20.000 de cada pedido
       confirmado no aparecían por ningún lado. */
    const cod = pedidos.filter(isCOD);
    const codCobrado = cod.reduce((s, o) => s + recibidoDe(o), 0);

    const porCobrar = cod.filter(o => porCobrarDe(o) > 0);

    return {
        mpNeto,
        codCobrado,
        total: mpNeto + codCobrado,
        entregados: cod.filter(o => ['entregado', 'pagado'].includes(o.status)).length,
        porCobrar,
        porCobrarTotal: porCobrar.reduce((s, o) => s + porCobrarDe(o), 0),
    };
};

const DashboardHome = ({ products, orders, chatsPendientes, actualizadoEn, verPruebas, onRecargar, onNavigate }) => {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 86400000);

    /* El minutero corre solo, para que "hace un momento" deje de serlo cuando
       deja de serlo. Treinta segundos: el texto se cuenta en minutos, así que
       basta para que nunca se vea un minuto de más. De paso refresca los
       "hace X" de la línea de tiempo, que también se calculaban una vez y se
       quedaban quietos. */
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setAhora(Date.now()), 30000);
        return () => clearInterval(t);
    }, []);

    const frescura = (() => {
        if (!actualizadoEn) return 'Cargando…';
        const min = Math.floor((ahora - actualizadoEn) / 60000);
        if (min < 1) return 'Actualizado hace un momento';
        if (min < 60) return `Actualizado hace ${min} min`;
        const h = Math.round(min / 60);
        return `Actualizado hace ${h} h`;
    })();

    /* Lo que el sistema ya sabía y el panel no. La vigilancia encontraba
       cosas rotas y las mandaba por correo; el correo se marca como leído y
       se olvida, y el panel podía verse impecable con tres averías encima. */
    const [revision, setRevision] = useState(null);
    const [gastoPauta, setGastoPauta] = useState(null);
    const [ultimosMensajes, setUltimosMensajes] = useState([]);
    const [valentina, setValentina] = useState(null);

    /* La caja de verdad: lo que ENTRÓ en los últimos 30 días, con su fecha,
       del libro de movimientos. Antes esta cifra salía del estado actual de
       los pedidos creados en 30 días, que es otra pregunta — y la de abajo,
       el retorno de la pauta, dividía esa cifra por un gasto que sí venía
       fechado. Sigue el lente de pruebas, o el interruptor dejaría de valer
       para este bloque. */
    /* El pedido que se está despachando desde la cola del taller, si hay uno. */
    const [despachando, setDespachando] = useState(null);

    const confirmarDespacho = async (transportadora, guia) => {
        const pedido = despachando;
        const r = await despacharPedido(pedido, transportadora, guia);
        setDespachando(null);

        if (!r.guardado) { alert('Error: ' + r.motivo); return; }
        onRecargar();

        /* Mismo aviso que en Pedidos: el pedido quedó despachado pase lo que
           pase con el correo, pero quien despacha tiene que enterarse si no
           salió — si no, la clienta se queda esperando un aviso que nadie
           escribió. */
        if (!r.correo?.enviado) {
            alert(`El pedido quedó marcado como enviado, pero el correo no salió.\n\n${r.correo?.motivo || 'Motivo desconocido'}`);
        }
    };

    const [caja, setCaja] = useState(null);
    useEffect(() => {
        if (!actualizadoEn) return;
        let vigente = true;
        cajaDeLosUltimos(30, { incluirPruebas: verPruebas })
            .then(c => { if (vigente) setCaja(c); });
        return () => { vigente = false; };
    }, [actualizadoEn, verPruebas]);

    /* Cuelga de actualizadoEn para que estas cuatro consultas se recarguen con
       el resto del panel y no queden congeladas desde el montaje. Se espera a
       que el padre haya cargado —hasta entonces es null— para no dispararlas
       dos veces en cada visita. */
    useEffect(() => {
        if (!actualizadoEn) return;

        supabase.from('vigilancia_ultima').select('*').eq('id', 1).maybeSingle()
            .then(({ data }) => setRevision(data))
            .catch(() => {});

        /* Los últimos mensajes, para mezclarlos con los pedidos en una sola
           línea de tiempo. Un pedido y la conversación que lo produjo son el
           mismo hecho contado dos veces, y en dos listas separadas nadie los
           relaciona. */
        /* Cómo le va a Valentina. Es el canal por el que entra casi todo y en
           el panel eran dos contadores anónimos —"mensajes hoy", "chats
           activos"— que no dicen si está vendiendo. */
        Promise.all([
            supabase.rpc('analiticas_whatsapp', { p_dias: 30 }),
            supabase.from('chat_takeover')
                .select('phone_number')
                .gte('started_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        ]).then(([{ data: a }, { data: t }]) => {
            if (!a) return;
            setValentina({
                ...a,
                escalados: new Set((t || []).map(x => x.phone_number)).size,
            });
        }).catch(() => {});

        supabase.from('whatsapp_conversaciones')
            .select('phone_number, role, content, message_type, created_at')
            .order('created_at', { ascending: false })
            .limit(12)
            .then(({ data }) => setUltimosMensajes(data || []))
            .catch(() => {});

        const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        Promise.all([
            supabase.from('gasto_pauta').select('monto').gte('fecha', desde),
            supabase.from('taller_precios').select('iva_pauta').limit(1).maybeSingle(),
        ]).then(([{ data: g }, { data: t }]) => {
            const sinIva = (g || []).reduce((a, x) => a + Number(x.monto), 0);
            if (sinIva > 0) setGastoPauta(sinIva * (1 + Number(t?.iva_pauta ?? 0.19)));
        }).catch(() => {});
    }, [actualizadoEn]);

    const pedidos30 = orders.filter(o => new Date(o.created_at) >= hace30);
    /* ingresos sigue respondiendo "qué falta cobrar", que es una pregunta del
       estado de ahora y no tiene fecha. Lo que YA entró lo responde el libro. */
    const ingresos = ingresosDe(pedidos30);
    const cobrado = caja?.total ?? 0;

    /* El trabajo del día mira todos los pedidos, no solo los últimos 30 días:
       uno de hace dos meses sin despachar sigue siendo trabajo de hoy. */
    const porConfirmar = orders.filter(o => enGrupo(o, 'confirmar')).length;
    const porDespachar = orders.filter(o => enGrupo(o, 'despachar')).length;
    const sinResponder = chatsPendientes.length;


    /* ─── La cola del taller ──────────────────────────────────────────
       Lo único que el taller hace todos los días y no salía en ninguna
       pantalla: qué hay que fabricar, para quién, de qué talla y para cuándo.
       Hasta ahora había que abrir pedido por pedido para saberlo.

       En este sitio ocupa el lugar que tenía el aviso de piezas agotadas, que
       filtraba por `stock === 0` y `stock === 1`. Las cinco piezas tienen
       `stock` en null y nada en el sistema lo mueve nunca —no hay disparador
       que descuente al vender, sólo se edita a mano—, así que ese bloque no se
       podía encender jamás. Con todo fabricándose por encargo, el inventario
       no significa nada y la cola sí.

       El plazo son los DIAS_PROMESA de arriba: los días que tiene el taller
       para despachar, no para entregar.

       Cuelga de `ahora` —el minutero de arriba— y no de Date.now(): llamar al
       reloj dentro de un useMemo es impuro mientras React renderiza, y además
       dejaría los días congelados hasta que cambiara un pedido. */
    const cola = useMemo(() => {
        const porId = new Map(products.map(p => [p.id, p]));

        return orders
            .filter(o => enGrupo(o, 'despachar'))
            .map(o => {
                const dias = Math.floor((ahora - new Date(o.created_at).getTime()) / 86400000);

                /* La talla de los pedidos que tomó Valentina viene dentro del
                   texto de la nota —"… | Talla: 4.5 · Pedido tomado por
                   Valentina"— porque order_items es más nueva que ellos. Se
                   rescata de ahí cuando la fila no la trae. */
                const deLaNota = o.notes?.match(RE_TALLA)?.[1] ?? null;

                const piezas = (o.piezas?.length
                    ? o.piezas
                    : [{ product_id: o.product_id, nombre: o.product_name, cantidad: 1, talla: null }]
                ).map(p => ({
                    ...p,
                    talla: p.talla || deLaNota,
                    esAnillo: porId.get(p.product_id)?.category === 'Anillos',
                }));

                return {
                    id: o.id,
                    /* El pedido crudo, para el diálogo de despacho: necesita
                       customer_name, product_name y la transportadora y guía
                       que ya tuviera. */
                    pedido: o,
                    cliente: o.customer_name || 'Sin nombre',
                    piezas,
                    dias,
                    restan: DIAS_PROMESA - dias,
                    /* El checkout del sitio todavía no captura la talla —está
                       dicho así en ProductPage.jsx— y sin ella un anillo no se
                       puede empezar. Es lo que de verdad frena al taller, y
                       hasta ahora no se veía hasta abrir el pedido. */
                    faltaTalla: piezas.some(p => p.esAnillo && !p.talla),
                };
            })
            .sort((a, b) => a.restan - b.restan);
    }, [orders, products, ahora]);

    const hallazgos = revision?.hallazgos ?? [];
    /* Con `ahora` y no con Date.now(): llamar al reloj mientras React
       renderiza es impuro, y de paso esto se refresca con el minutero en vez
       de quedarse clavado en la hora en que se montó la pantalla. */
    const revisadoHace = revision?.corrida_en
        ? Math.round((ahora - new Date(revision.corrida_en).getTime()) / 60000)
        : null;

    const pendiente = porConfirmar + porDespachar + sinResponder;

    const tareas = [
        {
            clave: 'confirmar', icono: 'bag', n: porConfirmar,
            titulo: 'Por confirmar',
            sub: 'Pedidos nuevos que esperan tu llamada o mensaje',
            ir: () => onNavigate('orders'),
        },
        {
            clave: 'despachar', icono: 'truck', n: porDespachar,
            titulo: 'Por despachar',
            sub: 'Confirmados que el taller despacha en 2 a 3 días',
            ir: () => onNavigate('orders'),
        },
        {
            clave: 'responder', icono: 'whatsapp', n: sinResponder,
            titulo: 'Sin responder',
            sub: 'Chats de WhatsApp esperando tu respuesta',
            ir: () => onNavigate('chat'),
        },
    ];

    /* Puesta a punto: cada paso se marca solo cuando el dato existe. */

    /* Una sola línea de tiempo con lo que pasó, pedidos y conversaciones
       mezclados. El panel entero eran contadores y pendientes: cuántos hay,
       qué falta. Ninguna pantalla respondía "¿qué pasó desde que miré?", que
       es con lo que uno abre el panel en la mañana. */
    /* El comienzo de hoy, aparte. Así el gráfico no llama a Date.now() dentro
       del useMemo —impuro mientras React renderiza— y la ventana se corre sola
       al pasar la medianoche: colgando sólo de orders, un panel abierto de
       noche seguía dibujando los catorce días de ayer hasta que entrara un
       pedido. */
    const inicioDeHoy = useMemo(() => {
        const d = new Date(ahora);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }, [ahora]);

    /* Catorce días de pedidos, un palito por día. Responde lo único que ningún
       otro bloque responde: si la cosa va subiendo o bajando.

       Antes cada barra sumaba recibidoDe() de los pedidos CREADOS ese día y el
       pie decía "Hoy entraron $X". No era lo que entró ese día: un pedido que
       nació el 1 y se entregó el 10 ponía su plata entera en la barra del 1.
       Con contraentrega —donde pedir y cobrar están separados por días— las
       dos fechas casi nunca coinciden, y el gráfico se leía como caja diaria
       sin serlo.

       Fechar la plata de verdad pedía un libro de movimientos que no existía:
       orders sólo tiene abono_pagado_en y status_updated_at, y el segundo es
       el ÚLTIMO cambio de estado, así que se pisa solo — cuando un pedido
       llega a entregado ya no queda rastro de cuándo se pagó.

       ESO YA ESTÁ RESUELTO. La tabla `pagos` existe desde el 22 de agosto de
       2026 y anota cada movimiento con su fecha: el abono el día que entró y
       el saldo el día de la entrega, por separado. Un disparador en `orders`
       la mantiene cuadrada con recibidoDe() sola.

       Esta barra sigue midiendo pedidos y no caja por una razón de calendario,
       no de datos: cuando se hizo el libro no había ocurrido todavía ninguna
       venta real, así que un gráfico de caja habría salido vacío catorce días
       seguidos. Se dejó armado a propósito, para llenarlo cuando haya con qué.

       CÓMO CAMBIARLO CUANDO LLEGUE EL MOMENTO
       Traer del servidor las filas de `pagos` de los últimos catorce días,
       excluyendo los pedidos de prueba:

         select p.ocurrido_en::date as dia, sum(p.monto) as caja
           from pagos p join orders o on o.id = p.order_id
          where not o.es_prueba and p.ocurrido_en >= now() - interval '14 days'
          group by 1;

       y usar `caja` donde ahora va `pedido`. El texto de abajo vuelve a "Hoy
       entraron $X" y la nota "Lo que se pidió, no lo que se cobró" sobra,
       porque entonces sí será lo cobrado. */
    /* Mientras tanto, la barra mide lo que sí se puede fechar sin inventar:
       lo que se pidió cada día, y el texto lo dice con esas palabras.

       Los cancelados no cuentan: un pedido que se cayó no es demanda. */
    const DIAS_TENDENCIA = 14;
    const tendencia = useMemo(() => {
        const dias = [];
        for (let i = DIAS_TENDENCIA - 1; i >= 0; i--) {
            const d = new Date(inicioDeHoy - i * 86400000);
            const desde = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const hasta = new Date(desde.getTime() + 86400000);
            const delDia = orders.filter(o => {
                if (o.status === 'cancelado') return false;
                const c = new Date(o.created_at);
                return c >= desde && c < hasta;
            });
            dias.push({
                fecha: desde,
                pedido: delDia.reduce((a, o) => a + Number(o.amount || 0), 0),
                pedidos: delDia.length,
            });
        }
        return dias;
    }, [orders, inicioDeHoy]);

    /* El alto va por plata y no por cantidad: con uno o dos pedidos al día,
       contar da barras casi iguales y no se ve nada. */
    const topTendencia = Math.max(...tendencia.map(d => d.pedido), 0);
    const hayTendencia = tendencia.some(d => d.pedidos > 0);
    const hoyTendencia = tendencia[tendencia.length - 1];

    const haceCuanto = (fecha) => {
        const min = Math.round((ahora - new Date(fecha).getTime()) / 60000);
        if (min < 1) return 'ahora';
        if (min < 60) return `hace ${min} min`;
        const h = Math.round(min / 60);
        if (h < 24) return `hace ${h} h`;
        const d = Math.round(h / 24);
        return d === 1 ? 'ayer' : `hace ${d} días`;
    };

    const telCorto = (t) => (t || '').replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');

    /* Los tipos que Meta no entrega llegan como "[unsupported]", y eso en la
       pantalla del joyero no dice nada ni sugiere qué hacer. Lo que hay que
       saber es que alguien escribió y no se pudo leer: es un mensaje que
       necesita a una persona, no uno que se responde leyéndolo. */
    const leerContenido = (m) => {
        if (m.message_type === 'image') return 'Mandó una foto';
        if (m.message_type === 'audio') return 'Mandó una nota de voz';
        const c = m.content || '';
        if (c === '[unsupported]') return 'Mandó algo que no se pudo abrir';
        if (/^\[[a-z_]+\]$/.test(c)) return `Mandó un ${c.slice(1, -1)}`;
        return c.slice(0, 70) + (c.length > 70 ? '…' : '');
    };

    const lineaDeTiempo = [
        ...orders.slice(0, 8).map(o => ({
            cuando: o.created_at,
            tipo: 'pedido',
            que: `${o.customer_name || 'Alguien'} pidió ${o.product_name}`,
            dato: `$${fmt(o.amount)}`,
            estado: STATUS_META[o.status]?.label ?? o.status,
            ir: () => onNavigate('orders'),
        })),
        ...ultimosMensajes
            /* Sólo lo que escribe la clienta. Las respuestas de Valentina son
               consecuencia, no noticia, y duplicarían cada línea. */
            .filter(m => m.role === 'user')
            .slice(0, 8)
            .map(m => ({
                cuando: m.created_at,
                tipo: 'chat',
                que: `${telCorto(m.phone_number)} escribió`,
                dato: leerContenido(m),
                ilegible: m.content === '[unsupported]',
                ir: () => onNavigate('chat'),
            })),
    ].sort((a, b) => new Date(b.cuando) - new Date(a.cuando)).slice(0, 7);

    return (
        <div className="jornada">

            <div className="jornada-head">
                <span className="jornada-fecha">
                    {hoy.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                {pendiente === 0 ? (
                    <h1 className="jornada-titulo">
                        Hoy no hay nada
                        <em>que esté esperando.</em>
                    </h1>
                ) : (
                    <h1 className="jornada-titulo">
                        Hoy tienes {pendiente} cosa{pendiente !== 1 ? 's' : ''}
                        <em>por atender.</em>
                    </h1>
                )}
                <p className="jornada-lead">
                    {products.length} pieza{products.length !== 1 ? 's' : ''} publicada{products.length !== 1 ? 's' : ''},{' '}
                    {orders.length === 0 ? 'ningún pedido todavía' : `${orders.length} pedido${orders.length !== 1 ? 's' : ''} en total`} y{' '}
                    {sinResponder === 0 ? 'la bandeja de WhatsApp al día' : `${sinResponder} chat${sinResponder !== 1 ? 's' : ''} sin responder`}.
                    {' '}Lo que sigue está abajo, en orden.
                </p>
            </div>

            {/* Lo roto va antes que lo pendiente. Un pedido sin despachar espera;
                un pago colgado o una foto que no llegó ya salió mal, y cada
                hora que pasa cuesta más. */}
            {hallazgos.length > 0 && (
                <section className="jornada-averia">
                    <div className="jornada-averia-head">
                        <span className="jornada-averia-titulo">
                            {hallazgos.length === 1 ? 'Hay algo que no está funcionando' : `Hay ${hallazgos.length} cosas que no están funcionando`}
                        </span>
                        {revisadoHace != null && (
                            <span className="jornada-averia-nota">
                                Revisado hace {revisadoHace < 60 ? `${revisadoHace} min` : `${Math.round(revisadoHace / 60)} h`}
                            </span>
                        )}
                    </div>
                    {hallazgos.map((h, i) => (
                        <div key={i} className={`jornada-averia-fila${h.grave === false ? ' jornada-averia-fila--leve' : ''}`}>
                            <span className="jornada-averia-que">{h.que}</span>
                            {h.detalle && <span className="jornada-averia-detalle">{h.detalle}</span>}
                        </div>
                    ))}
                </section>
            )}

            {/* Lo que hay que fabricar. Va antes de "Atender hoy" porque una
                pieza que se pasa de los ocho días ya no se arregla atendiendo
                un pedido: hay que sentarse a hacerla. */}
            {cola.length > 0 && (
                <section className="jornada-panel jornada-taller">
                    <div className="jornada-panel-head">
                        <span className="jornada-panel-titulo">En el taller</span>
                        <span className="jornada-panel-nota">
                            {cola.length} pedido{cola.length !== 1 ? 's' : ''} por fabricar · salen en 3 días
                        </span>
                    </div>
                    {cola.map(t => (
                        /* Una fila, dos botones. El grande lleva a Pedidos y el
                           de la punta despacha sin salir de aquí — y por eso la
                           fila es un div: un botón dentro de otro botón no es
                           HTML válido y el navegador hace lo que quiere. */
                        <div key={t.id} className="jornada-taller-fila">
                        <button className="jornada-taller-ir" onClick={() => onNavigate('orders')}>
                            <span className="jornada-taller-texto">
                                <span className="jornada-taller-cliente">{t.cliente}</span>
                                <span className="jornada-taller-piezas">
                                    {t.piezas.map((p, i) => (
                                        <span key={i}>
                                            {i > 0 && ' · '}
                                            {p.cantidad > 1 ? `${p.cantidad}× ` : ''}{p.nombre}
                                            {p.talla
                                                ? <em> talla {p.talla}</em>
                                                : p.esAnillo ? <em className="jornada-taller-sinTalla"> sin talla</em> : null}
                                        </span>
                                    ))}
                                </span>
                            </span>
                            {t.faltaTalla && (
                                <span className="jornada-taller-aviso">Falta la talla</span>
                            )}
                            <span className={`jornada-taller-plazo${t.restan < 0 ? ' jornada-taller-plazo--tarde' : t.restan <= 2 ? ' jornada-taller-plazo--justo' : ''}`}>
                                <span className="jornada-taller-dias">
                                    {t.restan < 0
                                        ? `${-t.restan} día${-t.restan !== 1 ? 's' : ''} tarde`
                                        : t.restan === 0 ? 'vence hoy'
                                        : `${t.restan} día${t.restan !== 1 ? 's' : ''}`}
                                </span>
                                <span className="jornada-taller-desde">
                                    pedido hace {t.dias === 0 ? 'hoy' : `${t.dias} día${t.dias !== 1 ? 's' : ''}`}
                                </span>
                            </span>
                            <span className="jornada-tarea-chevron"><JIcon name="chevron" size={18} /></span>
                        </button>
                        {/* La acción que cierra el trabajo del taller. Abre el
                            mismo diálogo de Pedidos —transportadora y guía— y
                            usa la misma función, así que manda el mismo correo.
                            Sin esto había que ir a Pedidos y buscar el pedido
                            que acabas de ver aquí. */}
                        <button
                            type="button"
                            className="jornada-taller-despachar"
                            onClick={() => setDespachando(t.pedido)}
                        >
                            Despachar
                        </button>
                        </div>
                    ))}
                </section>
            )}

            {despachando && (
                <ShipModal
                    order={despachando}
                    onClose={() => setDespachando(null)}
                    onConfirm={confirmarDespacho}
                />
            )}

            <section className="jornada-panel">
                <div className="jornada-panel-head">
                    <span className="jornada-panel-titulo">Atender hoy</span>
                    {/* Se puede tocar: si dice "hace 4 h" lo primero que uno
                        quiere es que diga otra cosa. */}
                    <button
                        type="button"
                        className="jornada-panel-nota jornada-panel-nota--btn"
                        onClick={onRecargar}
                        title="Volver a consultar"
                    >
                        {frescura}
                    </button>
                </div>
                {/* Con todo en cero, tres filas de "0 AL DÍA" son 328 píxeles
                    repitiendo lo que el titular acaba de decir. Se encoge a una
                    línea. En cuanto hay trabajo vuelven las tres, incluidas las
                    que están en cero: ahí el cero sí informa, porque dice que
                    esa parte está al día mientras otra no. */}
                {pendiente === 0 ? (
                    <p className="jornada-aldia">
                        Nada por confirmar, nada por despachar y ningún chat esperando.
                    </p>
                ) : tareas.map(t => (
                    <button key={t.clave} className="jornada-tarea" onClick={t.ir}>
                        <span className={`jornada-tarea-icono ${t.icono === 'whatsapp' ? 'jornada-tarea-icono--wa' : ''}`}>
                            <JIcon name={t.icono} />
                        </span>
                        <span className="jornada-tarea-texto">
                            <span className="jornada-tarea-t">{t.titulo}</span>
                            <span className="jornada-tarea-s">{t.sub}</span>
                        </span>
                        <span className="jornada-tarea-n">
                            <span className={`jornada-tarea-num ${t.n > 0 ? 'jornada-tarea-num--hay' : ''}`}>{t.n}</span>
                            <span className="jornada-tarea-estado">{t.n === 0 ? 'al día' : 'pendiente'}</span>
                        </span>
                        <span className="jornada-tarea-chevron"><JIcon name="chevron" size={18} /></span>
                    </button>
                ))}
            </section>

            <section className="jornada-dinero">
                <div className="jornada-dinero-col">
                    <span className="jornada-dinero-label">Cobrado · últimos 30 días</span>
                    <div className="jornada-dinero-cifra">
                        <span className="jornada-dinero-valor">${fmt(cobrado)}</span>
                        <span className="jornada-dinero-moneda">COP</span>
                    </div>
                    <span className="jornada-dinero-sub">
                        Plata que entró en estos 30 días, con su fecha
                    </span>
                    <div className="jornada-dinero-detalle">
                        <div className="jornada-dinero-fila">
                            <span><span className="jornada-punto" />MercadoPago (neto)</span>
                            <strong>${fmt(caja?.mercadoPago ?? 0)}</strong>
                        </div>
                        <div className="jornada-dinero-fila">
                            <span><span className="jornada-punto jornada-punto--cod" />Efectivo y transferencias</span>
                            <strong>${fmt(caja?.efectivo ?? 0)}</strong>
                        </div>
                    </div>
                </div>

                <div className="jornada-dinero-col">
                    <span className="jornada-dinero-label">Falta cobrar</span>
                    <div className="jornada-dinero-cifra">
                        <span className="jornada-dinero-valor">${fmt(ingresos.porCobrarTotal)}</span>
                        <span className="jornada-dinero-moneda">COP</span>
                    </div>
                    <span className="jornada-dinero-sub">
                        Contra entrega en tránsito · {ingresos.porCobrar.length} pedido{ingresos.porCobrar.length !== 1 ? 's' : ''}
                    </span>
                    <div className="jornada-dinero-detalle">
                        <span className="punzon punzon--dark">Pago contra entrega</span>
                        <span className="jornada-dinero-sub">
                            {ingresos.porCobrar.length === 0
                                ? 'Cuando el primer pedido se entregue, aquí verás cuánto queda por recaudar.'
                                : 'Se cobra al entregar. Confirma con el mensajero para cerrarlo.'}
                        </span>
                    </div>
                </div>

                {/* Sólo cuando hay algo que dibujar. Catorce palitos en cero no
                    son una tendencia, son ruido con aspecto de gráfico. */}
                {hayTendencia && (
                    <div className="jornada-tendencia">
                        <span className="jornada-dinero-label">Pedidos · últimos 14 días</span>
                        <div className="jornada-tendencia-barras">
                            {tendencia.map((d, i) => (
                                <span
                                    key={i}
                                    className={`jornada-tendencia-barra${d.pedidos === 0 ? ' jornada-tendencia-barra--cero' : ''}`}
                                    style={{ height: d.pedidos === 0 ? '2px' : `${Math.max(6, Math.round((d.pedido / (topTendencia || 1)) * 100))}%` }}
                                    title={`${d.fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · ${d.pedidos} pedido${d.pedidos !== 1 ? 's' : ''} · $${fmt(d.pedido)}`}
                                />
                            ))}
                        </div>
                        <span className="jornada-dinero-sub">
                            {hoyTendencia.pedidos > 0
                                ? `Hoy entraron ${hoyTendencia.pedidos} pedido${hoyTendencia.pedidos !== 1 ? 's' : ''} por $${fmt(hoyTendencia.pedido)}`
                                : 'Hoy todavía no ha entrado ningún pedido'}
                        </span>
                        {/* Va pegado a dos cifras de plata cobrada, así que hay
                            que decir que esta no lo es. */}
                        <span className="jornada-tendencia-nota">Lo que se pidió, no lo que se cobró</span>
                    </div>
                )}
            </section>


            {/* El retorno vive en Reportes, pero el número que hay que ver todos
                los días es uno solo: ¿la pauta se está pagando? Sólo aparece
                cuando hay gasto anotado; antes de eso sería un cero sin
                significado. */}
            {gastoPauta != null && (
                <section className="jornada-pauta">
                    <div className="jornada-pauta-col">
                        <span className="jornada-dinero-label">Pauta · últimos 30 días</span>
                        <span className="jornada-pauta-valor">${fmt(gastoPauta)}</span>
                        <span className="jornada-dinero-sub">Con el IVA, que es lo que sale de la cuenta</span>
                    </div>
                    <div className="jornada-pauta-col">
                        <span className="jornada-dinero-label">Por cada peso gastado</span>
                        <span className={`jornada-pauta-valor ${cobrado >= gastoPauta ? 'jornada-pauta--bien' : 'jornada-pauta--mal'}`}>
                            ${fmt(cobrado / gastoPauta)}
                        </span>
                        <span className="jornada-dinero-sub">
                            {cobrado >= gastoPauta
                                ? 'De lo cobrado en estos 30 días, no de lo prometido'
                                : `Faltan $${fmt(gastoPauta - cobrado)} para que se pague sola`}
                        </span>
                    </div>
                    <button className="jornada-pauta-link" onClick={() => onNavigate('reports')}>Ver el detalle →</button>
                </section>
            )}

            <section className="jornada-panel">
                <div className="jornada-panel-head">
                    <span className="jornada-panel-titulo">Lo último</span>
                    <span className="jornada-panel-nota">Pedidos y conversaciones, juntos</span>
                </div>
                {lineaDeTiempo.length === 0 ? (
                    <p className="jornada-vacio">
                        Todavía no ha pasado nada. Acá van a ir apareciendo los pedidos y los
                        mensajes a medida que lleguen, del más reciente al más viejo.
                    </p>
                ) : lineaDeTiempo.map((e, i) => (
                    <button key={i} className="jornada-hecho" onClick={e.ir}>
                        <span className={`jornada-hecho-punto jornada-hecho-punto--${e.ilegible ? 'ilegible' : e.tipo}`} />
                        <span className="jornada-hecho-texto">
                            <span className="jornada-hecho-q">{e.que}</span>
                            <span className="jornada-hecho-d">{e.dato}</span>
                        </span>
                        {e.estado && <span className="jornada-hecho-estado">{e.estado}</span>}
                        <span className="jornada-hecho-cuando">{haceCuanto(e.cuando)}</span>
                    </button>
                ))}
            </section>

            {/* Sólo con conversaciones de verdad. Cuatro celdas en cero no
                dicen "va mal", dicen "todavía no hay nada", y eso ya lo dice
                el resto de la pantalla. */}
            {valentina?.total_conversaciones > 0 && (
                <section className="jornada-panel">
                    <div className="jornada-panel-head">
                        <span className="jornada-panel-titulo">Cómo le va a Valentina</span>
                        <span className="jornada-panel-nota">Últimos 30 días</span>
                    </div>
                    <div className="jornada-wa">
                        <div className="jornada-wa-celda">
                            <span className="jornada-wa-v">{valentina.total_conversaciones}</span>
                            <span className="jornada-wa-l">Conversaciones</span>
                            <span className="jornada-wa-s">{valentina.mensajes_totales} mensajes en total</span>
                        </div>
                        <div className="jornada-wa-celda">
                            <span className="jornada-wa-v">
                                {valentina.conversaciones_con_pedido}
                            </span>
                            <span className="jornada-wa-l">Terminaron en pedido</span>
                            <span className="jornada-wa-s">
                                {valentina.total_conversaciones
                                    ? `${Math.round(valentina.tasa_conversion)} % de las que hablaron`
                                    : '—'}
                            </span>
                        </div>
                        <div className="jornada-wa-celda">
                            <span className="jornada-wa-v">
                                {valentina.tiempo_respuesta_seg > 0
                                    ? (valentina.tiempo_respuesta_seg < 60
                                        ? `${Math.round(valentina.tiempo_respuesta_seg)} s`
                                        : `${valentina.tiempo_respuesta_min} min`)
                                    : '—'}
                            </span>
                            <span className="jornada-wa-l">Tarda en contestar</span>
                            <span className="jornada-wa-s">Desde que la clienta escribe</span>
                        </div>
                        <div className="jornada-wa-celda">
                            <span className={`jornada-wa-v${valentina.escalados > 0 ? ' jornada-wa-v--ojo' : ''}`}>
                                {valentina.escalados}
                            </span>
                            <span className="jornada-wa-l">Necesitaron a una persona</span>
                            <span className="jornada-wa-s">
                                {valentina.escalados === 0
                                    ? 'Las resolvió todas sola'
                                    : 'Se pasaron al joyero'}
                            </span>
                        </div>
                    </div>
                </section>
            )}

            <div className="jornada-acciones">
                <button className="btn-pill black" onClick={() => onNavigate('products')}>Publicar pieza nueva</button>
                <button className="btn-pill light" onClick={() => onNavigate('chat')}>Abrir la bandeja</button>
            </div>
        </div>
    );
};

/* ─── ProductsSection ────────────────────────────────────────────── */

export default DashboardHome;
