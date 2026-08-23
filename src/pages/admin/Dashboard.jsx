import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminSidebar from './AdminSidebar';
import { NAV } from './adminNav.jsx';
import DashboardHome from './secciones/Portada';
import ProductsSection from './secciones/Productos';
import OrdersSection from './secciones/Pedidos';
import CustomersSection from './secciones/Clientes';
import ReportsSection from './secciones/Reportes';
import NotesSection from './secciones/Anotaciones';
import SettingsSection from './secciones/Ajustes';
import '../../panel.css';

/**
 * El panel, y sólo el panel: qué sección se ve, de dónde salen los datos y
 * cuándo se recargan.
 *
 * Este archivo tenía 4.398 líneas y era siete pantallas metidas en una. Las
 * siete salieron a `secciones/` el 23 de agosto de 2026: ya recibían props y no
 * compartían estado, así que se fueron enteras. Aquí queda lo que de verdad es
 * del contenedor — la sección activa, las consultas y el riel lateral.
 */

const Dashboard = () => {
    const [searchParams] = useSearchParams();
    const [session, setSession]     = useState(null);
    const [section, setSection]     = useState(() => searchParams.get('tab') || 'dashboard');
    const [products, setProducts]   = useState([]);
    const [orders, setOrders]       = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loadingP, setLoadingP]   = useState(true);
    const [loadingO, setLoadingO]   = useState(true);
    const [loadingC, setLoadingC]   = useState(true);
    const [chatsPendientes, setChatsPendientes] = useState([]);
    const navigate = useNavigate();

    /* Una conversación está sin responder cuando su último mensaje es de la
       cliente. El campo is_read no se mantiene, así que no sirve para esto.

       Lo resuelve la base con un DISTINCT ON por teléfono. Antes se hacía acá:
       se traían los 300 mensajes más recientes, se guardaba el último de cada
       teléfono y la lista se recortaba a 3. Ese recorte era el único consumidor
       del dato —nadie usa la lista, sólo su largo—, así que el contador "Sin
       responder" tenía techo en 3 y el titular "Hoy tienes N cosas por atender"
       también: con ocho clientas esperando, el panel decía tres y se veía al
       día. El límite de 300 era el segundo techo, silencioso, para cuando
       Valentina tenga volumen. */
    const fetchChatsPendientes = useCallback(async () => {
        const { data } = await supabase.rpc('chats_sin_responder');
        setChatsPendientes(data || []);
    }, []);

    /* Los mensajes sin leer, para el globo del sidebar. ChatPanel ya lo
       pasaba; el Dashboard montaba AdminSidebar sin la prop, así que el globo
       sólo aparecía estando ya en el chat — justo donde no hace falta.

       Se cuenta IGUAL que allá (is_read = false y role = 'user') y no con
       chatsPendientes, que es otra pregunta: un chat puede estar leído y sin
       responder. Dos pantallas del mismo panel enseñando números distintos
       bajo el mismo globo es el bug que ya costó caro con el dinero. */
    const [chatNoLeidos, setChatNoLeidos] = useState(0);
    const fetchNoLeidos = useCallback(async () => {
        const { count } = await supabase
            .from('whatsapp_conversaciones')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false)
            .eq('role', 'user');
        setChatNoLeidos(count || 0);
    }, []);

    const irA = useCallback((id) => {
        const destino = NAV.find(n => n.id === id);
        if (destino?.path) navigate(destino.path); else setSection(id);
    }, [navigate]);

    /* Se recuerda entre recargas: quien está probando algo no quiere volver
       a prender el interruptor cada vez que refresca. */
    const [verPruebas, setVerPruebas] = useState(() => localStorage.getItem('aurem:ver-pruebas') === 'si');
    useEffect(() => { localStorage.setItem('aurem:ver-pruebas', verPruebas ? 'si' : 'no'); }, [verPruebas]);

    /* Sólo para tener los datos del usuario en el sidebar. El portero es
       ProtectedRoute, que desde el 23 de agosto de 2026 escucha
       onAuthStateChange: si no hay sesión no se llega hasta aquí, y si
       caduca estando dentro, saca solo. Este efecto tenía su propio
       navigate('/admin/login') y sobraba. */
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSession(session);
        });
    }, []);

    const fetchProducts = useCallback(async () => {
        setLoadingP(true);
        const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        setProducts(data || []); setLoadingP(false);
    }, []);

    /* Las piezas vienen con el pedido, en la misma consulta.
       Un pedido puede llevar varias desde que existe order_items, y el nombre
       pegado que guarda orders —"Anillo A + Anillo B x2"— sirve para leerlo
       de un vistazo pero no para saber qué talla lleva cada una. Eso es
       justo lo que el taller necesita antes de fabricar. */
    const fetchOrders = useCallback(async () => {
        setLoadingO(true);
        const { data } = await supabase
            .from('orders')
            .select('*, piezas:order_items(product_id, nombre, precio, cantidad, talla, creado_en)')
            .order('created_at', { ascending: false });
        setOrders(data || []); setLoadingO(false);
    }, []);

    const fetchCustomers = useCallback(async () => {
        setLoadingC(true);
        const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        setCustomers(data || []); setLoadingC(false);
    }, []);

    /* El panel cargaba una vez al montar y no volvía a consultar nada, pero
       decía "Actualizado hace un momento" con un texto fijo. Quien lo deja
       abierto desde las ocho —que es como se usa— a mediodía leía "hace un
       momento" sobre datos de hace cuatro horas, justo en el bloque que existe
       para decidir qué atender.

       Ahora se guarda cuándo se cargó y el panel lo dice de verdad. */
    const [actualizadoEn, setActualizadoEn] = useState(null);

    const recargarTodo = useCallback(async () => {
        await Promise.all([fetchProducts(), fetchOrders(), fetchCustomers(), fetchChatsPendientes(), fetchNoLeidos()]);
        setActualizadoEn(Date.now());
    }, [fetchProducts, fetchOrders, fetchCustomers, fetchChatsPendientes, fetchNoLeidos]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Cargar al montar. recargarTodo es un useCallback estable y marca la hora al terminar, que es de lo que vive el "Actualizado hace…".
        if (session) recargarTodo();
    }, [session, recargarTodo]);

    /* Volver a la pestaña es el momento exacto en que alguien mira el panel,
       así que es cuando vale la pena recargar. No hay temporizador de fondo:
       refrescar cada minuto una pestaña que nadie está mirando son consultas
       regaladas. El minuto de gracia evita que un alt-tab rápido dispare
       cuatro consultas seguidas. */
    const actualizadoRef = useRef(null);
    useEffect(() => { actualizadoRef.current = actualizadoEn; }, [actualizadoEn]);

    useEffect(() => {
        if (!session) return;
        const alVolver = () => {
            if (document.hidden) return;
            const ultima = actualizadoRef.current;
            if (ultima && Date.now() - ultima < 60000) return;
            recargarTodo();
        };
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener('focus', alVolver);
        return () => {
            document.removeEventListener('visibilitychange', alVolver);
            window.removeEventListener('focus', alVolver);
        };
    }, [session, recargarTodo]);

    /* Las pruebas del equipo se esconden en TODO el panel, no sección por
       sección. Es un lente sobre los mismos datos, no un filtro de la tabla
       de pedidos: si el informe y la lista pudieran discrepar, volveríamos
       al problema de tener dos verdades.

       Se esconden por defecto y a propósito. La opción de verlas está ahí
       para cuando se prueba algo; el resto del tiempo, un panel que suma
       pedidos falsos a las ventas reales miente sin avisar. */
    const pruebas = orders.filter(o => o.es_prueba).length;
    const ordersVisibles = verPruebas ? orders : orders.filter(o => !o.es_prueba);
    /* Los clientes también. El panel llegó a decir "ningún pedido todavía" y
       "6 clientes nuevos" a la vez — los seis venían de esos mismos pedidos de
       prueba. Un lente que tapa la mitad de una contradicción la deja peor que
       antes. */
    const customersVisibles = verPruebas ? customers : customers.filter(c => !c.es_prueba);

    if (!session) return null;

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <AdminSidebar session={session} activeId={section} onNavClick={setSection} chatUnread={chatNoLeidos} />

            {/* Main content */}
            <main className="admin-content">
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        <h2 className="admin-topbar-title">{NAV.find(n => n.id === section)?.label ?? 'Dashboard'}</h2>
                        <span className="admin-topbar-sep" />
                        <span className="admin-topbar-fecha">
                            {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <div className="admin-topbar-right">
                        {pruebas > 0 && (
                            <button
                                type="button"
                                className={`admin-lente${verPruebas ? ' admin-lente--on' : ''}`}
                                onClick={() => setVerPruebas(v => !v)}
                                title={verPruebas
                                    ? 'Los pedidos de prueba están sumando en todos los números'
                                    : 'Hay pedidos de prueba escondidos del panel'}
                            >
                                {verPruebas ? `Con ${pruebas} prueba${pruebas !== 1 ? 's' : ''}` : `${pruebas} prueba${pruebas !== 1 ? 's' : ''} oculta${pruebas !== 1 ? 's' : ''}`}
                            </button>
                        )}
                        <a className="admin-topbar-tienda" href="/" target="_blank" rel="noopener noreferrer">Ver la tienda</a>
                        <div className="admin-topbar-avatar">{session.user.email[0].toUpperCase()}</div>
                    </div>
                </header>
                <div className="admin-main">
                    {section === 'dashboard' && (
                        <DashboardHome
                            products={products} orders={ordersVisibles}
                            chatsPendientes={chatsPendientes}
                            actualizadoEn={actualizadoEn}
                            verPruebas={verPruebas}
                            onRecargar={recargarTodo}
                            onNavigate={irA}
                        />
                    )}
                    {section === 'products' && (
                        <ProductsSection products={products} loading={loadingP} onRefresh={fetchProducts} />
                    )}
                    {section === 'orders' && (
                        <OrdersSection orders={ordersVisibles} products={products} loading={loadingO} onRefresh={fetchOrders} />
                    )}
                    {section === 'customers' && (
                        <CustomersSection customers={customersVisibles} orders={ordersVisibles} loading={loadingC} onRefresh={fetchCustomers} />
                    )}
                    {section === 'reports' && (
                        <ReportsSection orders={ordersVisibles} products={products} verPruebas={verPruebas} onNavigate={irA} />
                    )}
                    {section === 'notes' && (
                        <NotesSection />
                    )}
                    {section === 'settings' && (
                        <SettingsSection />
                    )}
                </div>
            </main>

            {/* Inline styles for new components */}
            <style>{`
                /* Source badge */
                .source-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    white-space: nowrap;
                }
                .source--blue  { background: #dbeafe; color: #1d4ed8; }
                .source--green { background: #dcfce7; color: #15803d; }
                .source--pink  { background: #fce7f3; color: #be185d; }
                .source--gray  { background: #f3f4f6; color: #4b5563; }

                /* Badge orange for procesando */
                .badge--orange { background: #fff7ed; color: #c2410c; }

                /* Quick action buttons */
                .admin-quick-action {
                    padding: 0.38rem 0.85rem;
                    border-radius: 9px;
                    font-size: 0.74rem;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
                    letter-spacing: 0.01em;
                }
                .admin-quick-action:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
                .action--green  { background: #dcfce7; color: #15803d; }
                .action--blue   { background: #dbeafe; color: #1d4ed8; }
                .action--purple { background: #ede9fe; color: #6d28d9; }
                .action--teal   { background: #ccfbf1; color: #0f766e; }

                /* Small action button variants */
                .admin-action-btn--sm {
                    font-size: 0.75rem !important;
                    padding: 3px 8px !important;
                }
                .admin-action-btn--icon {
                    padding: 4px 6px !important;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: auto !important;
                }

                /* Reports grid */
                .admin-reports-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.25rem;
                }
                @media (min-width: 900px) {
                    .admin-reports-grid {
                        grid-template-columns: 1fr 1fr;
                    }
                }

                /* Vertical bar chart */
                .admin-bar-chart {
                    display: flex;
                    align-items: flex-end;
                    gap: 4px;
                    height: 200px;
                    padding: 1rem 0.5rem 0;
                }
                .admin-bar-col {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                    justify-content: flex-end;
                }
                .admin-bar-value {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #555;
                    margin-bottom: 4px;
                }
                .admin-bar {
                    width: 100%;
                    max-width: 32px;
                    border-radius: 4px 4px 0 0;
                    transition: height 0.3s ease;
                    min-height: 4px;
                }
                .admin-bar-label {
                    font-size: 0.6rem;
                    color: #888;
                    margin-top: 6px;
                    text-align: center;
                    white-space: nowrap;
                }

                /* Horizontal bar chart */
                .admin-hbar-chart {
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                    padding: 0.5rem 0;
                }
                .admin-hbar-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .admin-hbar-label {
                    min-width: 100px;
                    max-width: 160px;
                    font-size: 0.8rem;
                    color: #444;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .admin-hbar-track {
                    flex: 1;
                    height: 20px;
                    background: #f3f4f6;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .admin-hbar {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                    min-width: 4px;
                }
                .admin-hbar-value {
                    min-width: 30px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #555;
                    text-align: right;
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
