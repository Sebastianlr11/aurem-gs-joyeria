import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { recibidoDe, estaVivo } from '../../lib/dinero';
import AdminSidebar from './AdminSidebar';
import EliminarChat from './EliminarChat';
import { descargarChat, borrarFotosDe } from '../../lib/chatArchivo';
import { leerRespuestas } from '../../lib/respuestasRapidas';
import { NAV } from './adminNav.jsx';

/* ─── Helpers ───────────────────────────────────────────────────── */
const normalizePhone = (p) => {
    if (!p) return '';
    const digits = p.replace(/\D/g, '');
    if (digits.length === 10) return '57' + digits;
    return digits;
};

const fmtTime = (d) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
/* Iniciales del nombre, hasta dos, como en el retrato del diseño. */
const iniciales = (nombre) => {
    if (!nombre) return '#';
    const partes = String(nombre).trim().split(/\s+/).filter(Boolean);
    return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
};
/* Cómo se lee cada estado en la ficha, en vez del valor crudo. */
const STATUS_PEDIDO = {
    pendiente: 'Pago pendiente', pagado: 'Pagado', procesando: 'Procesando',
    enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
};
/* El separador del hilo: "Hoy", "Ayer", el día de la semana si es de
   este año, y la fecha completa si es más viejo. */
/* Qué significa cada acuse al pasar el cursor. */
/**
 * Lo que se lee bajo la foto de un cliente.
 *
 * El contenido guardado es "📷 <lo que vio el modelo>" y, si el cliente
 * escribió un pie, sus palabras entre comillas al final. Esa descripción
 * existe para Valentina: es lo que lee en su siguiente turno, y sin ella
 * vería "[image]" y perdería el hilo. Pero con la foto delante, al joyero no
 * le aporta nada — le quita sitio a lo único que importa, que es la pieza y
 * lo que el cliente pidió con sus palabras.
 *
 * Así que se enseña el pie del cliente y la descripción queda a un clic, por
 * si alguna vez hay que revisar qué entendió el modelo.
 */
function PieDeFoto({ contenido }) {
    const [abierta, setAbierta] = useState(false);

    const texto = String(contenido || '');
    if (!texto) return null;

    const conPie = texto.match(/^📷\s*([\s\S]*?)\n\n"([\s\S]*)"$/);
    const descripcion = conPie ? conPie[1].trim() : texto.replace(/^📷\s*/, '').trim();
    const pie = conPie ? conPie[2].trim() : null;

    return (
        <div className="chat-bubble-content">
            {pie ? <span>{pie}</span> : null}
            {descripcion ? (
                <div className="chat-foto-visto">
                    <button type="button" onClick={() => setAbierta(v => !v)}>
                        {abierta ? 'Ocultar lo que vio Valentina' : 'Lo que vio Valentina'}
                    </button>
                    {abierta ? <p>{descripcion}</p> : null}
                </div>
            ) : null}
        </div>
    );
}

/**
 * La imagen de un mensaje, venga de donde venga.
 *
 * Hay dos clases y se distinguen por la forma: las que mandamos nosotros son
 * fotos del catálogo y llevan URL pública completa; las que manda el cliente
 * viven en un bucket privado y sólo se guarda su ruta, porque son
 * correspondencia suya —mandan comprobantes, capturas, fotos de su mano— y
 * eso no puede quedar colgando de un enlace público.
 *
 * La firma dura una hora, de sobra para mirar un chat, y se pide sólo cuando
 * la burbuja se pinta: firmar todo el historial de entrada sería pedir
 * decenas de URLs que nadie va a abrir.
 */
function ImagenDelChat({ ruta, onAbrir }) {
    const [src, setSrc] = useState(() => (String(ruta).startsWith('http') ? ruta : null));

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- La URL firmada de Storage llega después, y la ruta puede cambiar sin que el componente se desmonte. El estado inicial ya resuelve el caso de una URL directa; esto cubre el resto.
        if (String(ruta).startsWith('http')) { setSrc(ruta); return; }
        let vivo = true;
        supabase.storage.from('chat-media').createSignedUrl(ruta, 3600)
            .then(({ data }) => { if (vivo && data?.signedUrl) setSrc(data.signedUrl); });
        return () => { vivo = false; };
    }, [ruta]);

    // Mientras se firma se deja el hueco, para que el hilo no salte al cargar.
    if (!src) return <div className="chat-bubble-image chat-bubble-image--cargando" />;

    return (
        <img
            src={src}
            alt=""
            className="chat-bubble-image chat-bubble-image--clickable"
            onClick={() => onAbrir(src)}
        />
    );
}

const ACUSE = {
    sending: 'Enviando…',
    sent: 'Enviado a WhatsApp',
    delivered: 'Entregado en el teléfono',
    read: 'Leído por el cliente',
    failed: 'No se pudo enviar',
};
const fmtSeparador = (d) => {
    const f = new Date(d);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dia = new Date(f); dia.setHours(0, 0, 0, 0);
    const dias = Math.round((hoy - dia) / 86400000);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    if (dias < 7) return f.toLocaleDateString('es-CO', { weekday: 'long' });
    if (f.getFullYear() === hoy.getFullYear()) {
        return f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtDateFull = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const isSameDay = (a, b) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

/* Cuánto silencio antes de que una conversación sea candidata a purga. Un año
   deja pasar la temporada entera de regalos —diciembre, San Valentín, día de la
   madre— antes de dar a alguien por perdido. Es también el valor por defecto de
   `conversaciones_purgables` en la base; se pasa explícito para que cambiarlo
   sea esta línea y no una migración. */
const MESES_PURGA = 12;

const truncate = (s, n = 50) => s && s.length > n ? s.slice(0, n) + '...' : s;

/* ─── Sort helper: user before assistant when same timestamp ─── */
const sortMessages = (msgs) => {
    if (!msgs) return [];
    return [...msgs].sort((a, b) => {
        const t = new Date(a.created_at) - new Date(b.created_at);
        if (t !== 0) return t;
        if (a.role === 'user' && b.role === 'assistant') return -1;
        if (a.role === 'assistant' && b.role === 'user') return 1;
        return 0;
    });
};

const PRESET_TAGS = [
    { label: 'Interesado', color: '#3b82f6' },
    { label: 'Cliente', color: '#10b981' },
    { label: 'Seguimiento', color: '#f59e0b' },
    { label: 'VIP', color: '#D4AF37' },
    { label: 'Mayorista', color: '#8b5cf6' },
];

/* ─── Error Boundary ───────────────────────────────────────────── */
class ChatErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(err, info) { console.error('ChatPanel crash:', err, info); }
    render() {
        if (this.state.error) {
            return React.createElement('div', { style: { padding: 40, textAlign: 'center' } },
                React.createElement('h3', null, 'Error en el panel de chat'),
                React.createElement('p', { style: { color: '#ef4444', fontFamily: 'monospace', fontSize: '0.85rem' } }, String(this.state.error)),
                React.createElement('button', { onClick: () => this.setState({ error: null }), style: { marginTop: 16, padding: '8px 16px', cursor: 'pointer' } }, 'Reintentar')
            );
        }
        return this.props.children;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   CHAT PANEL
═══════════════════════════════════════════════════════════════════ */
const ChatPanel = () => {
    const [session, setSession] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [sending, setSending] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(false);
    /* Mientras el campo tiene el foco, el celular muestra el teclado. La
       barra de navegación estorba ahí: se esconde, como hace WhatsApp. */
    const [escribiendo, setEscribiendo] = useState(false);
    const messagesEndRef = useRef(null);

    /* Baja al último mensaje. Se desplaza el contenedor y no la página. */
    const bajarAlFinal = useCallback((suave = true) => {
        const lista = messagesEndRef.current?.parentElement;
        if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    }, []);

    const activeContactRef = useRef(null);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [products, setProducts] = useState([]);
    /* Qué parte de lo enviado lo escribió Valentina. Sólo cuenta los mensajes
       que llevan el dato: los anteriores al bot propio no lo tienen, y
       promediarlos con los nuevos daría una cifra falsa. */
    const respondidoPorIA = (() => {
        const salientes = messages.filter(m => m.role === 'assistant' && m.enviado_por);
        if (!salientes.length) return null;
        const deIA = salientes.filter(m => m.enviado_por === 'ia').length;
        return `${Math.round((deIA / salientes.length) * 100)} %`;
    })();

    const imagenDePedido = (o) => (
        products.find(p => p.id === o.product_id) || products.find(p => p.name === o.product_name)
    )?.image_url || null;
    const [productSearch, setProductSearch] = useState('');
    const [imageCaption, setImageCaption] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [sendingImage, setSendingImage] = useState(false);
    const [takeoverMap, setTakeoverMap] = useState({});
    const [showContactInfo, setShowContactInfo] = useState(() => window.innerWidth >= 1200);
    const [contactOrders, setContactOrders] = useState([]);
    const [contactCustomer, setContactCustomer] = useState(null);
    const [editingNotes, setEditingNotes] = useState(false);
    const [customerNotes, setCustomerNotes] = useState('');
    const [sendError, setSendError] = useState(null);
    const [contactFilter, setContactFilter] = useState('todos');
    const [pendingPhones, setPendingPhones] = useState(new Set());
    const [msgSearchQuery, setMsgSearchQuery] = useState('');
    const [msgSearchResults, setMsgSearchResults] = useState([]);
    const [searchingMsgs, setSearchingMsgs] = useState(false);
    const [showMsgSearch, setShowMsgSearch] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [statusMap, setStatusMap] = useState({});   // { [phone]: { is_resolved, is_archived } }
    const [tagsMap, setTagsMap] = useState({});        // { [phone]: [{ id, tag_name, color }] }
    const [lightboxImg, setLightboxImg] = useState(null);
    const [lightboxClosing, setLightboxClosing] = useState(false);
    const [confirmArchive, setConfirmArchive] = useState(null); // phone to archive
    /* Lo que se está a punto de borrar —una conversación o un lote entero— y el
       menú de la fila que está abierto. Son dos cosas distintas: el menú se abre
       desde la lista y el diálogo puede abrirse también desde la cabecera. */
    const [aBorrar, setABorrar] = useState(null);           // [{ telefono, nombre }]
    const [menuFila, setMenuFila] = useState(null);         // { phone, arriba }
    /* El borrado de sólo las fotos, que es otra cosa: no se lleva el hilo. */
    const [confirmFotos, setConfirmFotos] = useState(false);
    const [borrandoFotos, setBorrandoFotos] = useState(false);
    /* Cuántas fotos guarda el hilo abierto. No se cuenta sobre `messages`
       porque eso son los 200 últimos: un hilo viejo tiene fotos más atrás y el
       menú prometería borrar tres cuando hay veinte. */
    const [fotosDelHilo, setFotosDelHilo] = useState(0);
    const [resumenHilo, setResumenHilo] = useState(null);   // { mensajes, desde }
    /* La selección múltiple. `null` es el modo apagado; un Set, encendido.
       Se distingue del conjunto vacío a propósito: "modo activo sin nada
       marcado" y "modo apagado" pintan cosas distintas. */
    const [seleccion, setSeleccion] = useState(null);
    const [archivandoLote, setArchivandoLote] = useState(false);
    /* Los fallos de la lista tienen que verse en la lista. El aviso del
       compositor sólo existe con un chat abierto, así que archivar un lote sin
       abrir ninguno fallaba en silencio — justo lo que este trabajo vino a
       quitar del panel. */
    const [errorLote, setErrorLote] = useState('');
    /* Las candidatas a purga las calcula la base, no el navegador: hace falta
       cruzar los hilos con los pedidos por los diez últimos dígitos, y eso aquí
       serían dos tablas enteras traídas para descartarlas casi todas. */
    const [purgables, setPurgables] = useState(null);   // [{ phone_number, ultimo_mensaje, … }]
    const [cargandoPurga, setCargandoPurga] = useState(false);
    const exportMenuRef = useRef(null);
    const menuFilaRef = useRef(null);
    const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('admin_sound_enabled') !== 'false');
    const quickReplies = useMemo(() => leerRespuestas(), []);
    const quickRepliesRef = useRef(null);
    const imagePickerRef = useRef(null);
    const takeoverMapRef = useRef(takeoverMap);
    const searchInputRef = useRef(null);
    const notifAudioRef = useRef(null);
    const contactsRef = useRef(contacts);
    const fetchContactsTimerRef = useRef(null);
    const toastTimersRef = useRef([]);
    const navigate = useNavigate();

    /* ─── Cached notification sound ───────────────────────────────── */
    const playNotifSound = useCallback(() => {
        if (localStorage.getItem('admin_sound_enabled') === 'false') return;
        if (!notifAudioRef.current) notifAudioRef.current = new Audio('/assets/notificacion.mp3');
        notifAudioRef.current.currentTime = 0;
        notifAudioRef.current.play().catch(() => {});
    }, []);

    /* ─── Auth ─────────────────────────────────────────────────────
       Sólo para el sidebar. Quien vigila la sesión es ProtectedRoute, que
       escucha onAuthStateChange y saca del panel si caduca. */
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSession(session);
        });
    }, []);

    /* ─── Load contacts ──────────────────────────────────────────── */
    const fetchContacts = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const { data } = await supabase
            .from('whatsapp_conversaciones')
            .select('phone_number, content, role, created_at')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (!data) { if (!silent) setLoading(false); return; }

        // Group by phone_number, keep most recent
        const contactMap = new Map();
        data.forEach(row => {
            if (!contactMap.has(row.phone_number)) {
                contactMap.set(row.phone_number, row);
            }
        });

        // Fetch customer names + unread counts in parallel
        const phones = [...contactMap.keys()];
        const [{ data: customers }, { data: unreadData }] = await Promise.all([
            supabase.from('customers').select('phone, name'),
            supabase.from('whatsapp_conversaciones').select('phone_number').eq('is_read', false).eq('role', 'user'),
        ]);

        const customerMap = new Map();
        if (customers) {
            customers.forEach(c => {
                customerMap.set(normalizePhone(c.phone), c.name);
                customerMap.set(c.phone, c.name);
            });
        }

        const unreadMap = new Map();
        if (unreadData) {
            unreadData.forEach(row => {
                unreadMap.set(row.phone_number, (unreadMap.get(row.phone_number) || 0) + 1);
            });
        }

        const contactList = phones.map(phone => {
            const row = contactMap.get(phone);
            const name = customerMap.get(normalizePhone(phone)) || customerMap.get(phone) || null;
            return {
                phone_number: phone,
                last_message: row.content,
                last_role: row.role,
                last_time: row.created_at,
                customer_name: name,
                unread: unreadMap.get(phone) || 0,
            };
        });

        // Sort by last message time (most recent first)
        contactList.sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
        setContacts(contactList);
        if (!silent) setLoading(false);
    }, []);

    useEffect(() => {
        if (session) fetchContacts();
    }, [session, fetchContacts]);

    /* ─── Load chat_status and contact_tags ──────────────────── */
    useEffect(() => {
        if (!session) return;
        const fetchStatusAndTags = async () => {
            const [{ data: statusData }, { data: tagsData }] = await Promise.all([
                supabase.from('chat_status').select('phone_number, is_resolved, is_archived'),
                supabase.from('contact_tags').select('id, phone_number, tag_name, color'),
            ]);
            if (statusData) {
                const map = {};
                statusData.forEach(s => { map[s.phone_number] = s; });
                setStatusMap(map);
            }
            if (tagsData) {
                const map = {};
                tagsData.forEach(t => {
                    if (!map[t.phone_number]) map[t.phone_number] = [];
                    map[t.phone_number].push(t);
                });
                setTagsMap(map);
            }
        };
        fetchStatusAndTags();
    }, [session]);

    /* ─── Load products for image picker ───────────────────────── */
    useEffect(() => {
        if (!session) return;
        supabase.from('products').select('id, name, image_url, price').then(({ data }) => {
            setProducts(data || []);
        });
    }, [session]);

    /* ─── Load pending order phones ──────────────────────────── */
    useEffect(() => {
        if (!session) return;
        supabase.from('orders').select('customer_phone').eq('status', 'pendiente')
            .then(({ data }) => {
                if (data) setPendingPhones(new Set(data.map(o => normalizePhone(o.customer_phone)).filter(Boolean)));
            });
    }, [session]);

    /* ─── Debounced message search ────────────────────────────── */
    useEffect(() => {
        if (!msgSearchQuery.trim()) { setMsgSearchResults([]); return; }
        const timer = setTimeout(async () => {
            setSearchingMsgs(true);
            const { data } = await supabase.rpc('buscar_conversaciones', { p_query: msgSearchQuery.trim() });
            setMsgSearchResults(data || []);
            setSearchingMsgs(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [msgSearchQuery]);

    /* ─── Keep refs in sync ───────────────────────────────────── */
    useEffect(() => { takeoverMapRef.current = takeoverMap; }, [takeoverMap]);
    useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);
    useEffect(() => { contactsRef.current = contacts; }, [contacts]);

    /* ─── Load takeover status ─────────────────────────────────── */
    const prevTakeoverRef = useRef({});
    useEffect(() => {
        if (!session) return;
        const fetchTakeover = async () => {
            const { data } = await supabase.from('chat_takeover').select('phone_number, is_active, admin_email').eq('is_active', true);
            if (data) {
                const map = {};
                data.forEach(t => { map[t.phone_number] = t; });

                // Detectar nuevos takeovers para alerta
                const prev = prevTakeoverRef.current;
                Object.keys(map).forEach(phone => {
                    if (!prev[phone]) {
                        // Nuevo takeover — sonido + notificación
                        playNotifSound();
                        if (document.hidden && Notification.permission === 'granted') {
                            try {
                                new Notification('Takeover activado - Aurem Gs', {
                                    body: `El chat ${phone} necesita atención manual`,
                                    icon: '/assets/logo-isotipo.png',
                                });
                            } catch { /* El navegador puede negarse a mostrar el aviso; no es motivo para romper nada. */ }
                        }
                    }
                });
                prevTakeoverRef.current = map;
                setTakeoverMap(map);
            }
        };
        fetchTakeover();

        // Realtime for takeover changes
        const channel = supabase
            .channel('takeover-updates')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'chat_takeover' },
                () => { fetchTakeover(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchTakeover no está memorizada: añadirla volvería a suscribir el canal de Realtime en cada render. La suscripción tiene que vivir mientras viva la sesión, que es lo que dice la dependencia.
    }, [session]);

    /* ─── Load messages for active contact ────────────────────────── */
    useEffect(() => {
        if (!activeContact) return;
        let cancelled = false;
        const load = async () => {
            setLoadingMsgs(true);
            /* Ascendente + limit(200) traía los DOSCIENTOS PRIMEROS: en un hilo
               largo el panel enseñaba el principio de la conversación y lo
               llamaba "los últimos mensajes". Se pide al revés y `sortMessages`
               los devuelve al orden de lectura. */
            const { data } = await supabase
                .from('whatsapp_conversaciones')
                .select('id, phone_number, content, role, created_at, is_read, message_type, media_url')
                .eq('phone_number', activeContact)
                .order('created_at', { ascending: false })
                .limit(200);
            if (!cancelled) {
                setMessages(sortMessages(data));
                setLoadingMsgs(false);
                // Mark as read
                supabase.from('whatsapp_conversaciones')
                    .update({ is_read: true })
                    .eq('phone_number', activeContact)
                    .eq('is_read', false)
                    .then(() => {});
            }
        };
        load();
        return () => { cancelled = true; };
    }, [activeContact]);

    /* ─── Load contact info panel ──────────────────────────────── */
    useEffect(() => {
        if (!activeContact) return;
        // Customer data — search with normalized phone variants
        const norm = normalizePhone(activeContact);
        const short = norm.startsWith('57') ? norm.slice(2) : norm;
        supabase.from('customers').select('*')
            .or(`phone.eq.${norm},phone.eq.${short},phone.eq.${activeContact}`)
            .maybeSingle()
            .then(({ data }) => {
                setContactCustomer(data);
                setCustomerNotes(data?.notes || '');
            });
        // Orders — search with normalized phone variants
        supabase.from('orders').select('*')
            .or(`customer_phone.eq.${norm},customer_phone.eq.${short},customer_phone.eq.${activeContact}`)
            .order('created_at', { ascending: false }).limit(10)
            .then(({ data }) => setContactOrders(data || []));
    }, [activeContact]);

    /**
     * Los números del hilo abierto, contados en la base.
     *
     * Antes la ficha decía `messages.length`, que son los mensajes cargados en
     * pantalla: un hilo de 252 figuraba como "200 mensajes" y la fecha de
     * "Desde" era la del mensaje 53, no la del primero. Con el diálogo de
     * eliminar diciendo la cifra de verdad, el panel se contradecía solo.
     */
    useEffect(() => {
        if (!activeContact) { setFotosDelHilo(0); setResumenHilo(null); return; }
        let vigente = true;

        supabase.from('whatsapp_conversaciones')
            .select('id', { count: 'exact', head: true })
            .eq('phone_number', activeContact)
            .eq('message_type', 'image')
            .not('media_url', 'is', null)
            .then(({ count }) => { if (vigente) setFotosDelHilo(count ?? 0); });

        Promise.all([
            supabase.from('whatsapp_conversaciones')
                .select('id', { count: 'exact', head: true }).eq('phone_number', activeContact),
            supabase.from('whatsapp_conversaciones')
                .select('created_at').eq('phone_number', activeContact)
                .order('created_at', { ascending: true }).limit(1).maybeSingle(),
        ]).then(([todos, primero]) => {
            if (!vigente) return;
            setResumenHilo({ mensajes: todos.count ?? 0, desde: primero.data?.created_at ?? null });
        }).catch(() => { if (vigente) setResumenHilo(null); });

        return () => { vigente = false; };
    }, [activeContact]);

    /* ─── Scroll to bottom on new messages ────────────────────────── */
    const prevMsgCountRef = useRef(0);
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            /* Se desplaza el contenedor, no scrollIntoView: ese arrastra a
               TODOS los ancestros desplazables, y en móvil terminaba
               moviendo la página entera además de la lista. */
            setTimeout(() => bajarAlFinal(true), 50);
        }
        prevMsgCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- A propósito sólo messages.length: esto baja la lista cuando LLEGA un mensaje, no cuando cambia cualquier cosa de uno que ya estaba.
    }, [messages.length]);

    /* En el celular el chat ocupa la pantalla completa y se ancla entre las
       dos barras, así que el documento no tiene por qué desplazarse. Si
       puede, iOS lo desplaza solo al enfocar el campo —para "revelarlo"— y
       se lleva la página de lado, dejando la cabecera y la barra cortadas.
       Quitándole el desplazamiento al documento, no tiene a dónde ir. */
    useEffect(() => {
        const html = document.documentElement;
        html.classList.add('chat-abierto');
        return () => html.classList.remove('chat-abierto');
    }, []);

    /* La clase la lee el CSS para esconder la barra de navegación. */
    useEffect(() => {
        document.body.classList.toggle('chat-escribiendo', escribiendo);
        return () => document.body.classList.remove('chat-escribiendo');
    }, [escribiendo]);

    /* El teclado en iOS NO encoge el layout: encoge el viewport VISUAL y
       deja el de layout igual. Por eso un panel anclado con position fixed
       se queda donde estaba y aparece una franja arriba — la meta
       interactive-widget que sirve en Android ahí no hace nada.

       Se miden el alto y el desplazamiento del viewport visual y se
       publican como variables CSS, para que el panel se acomode encima del
       teclado en vez de quedar debajo. */
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const medir = () => {
            const raiz = document.documentElement;
            raiz.style.setProperty('--vv-alto', `${Math.round(vv.height)}px`);
            raiz.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
        };

        medir();
        vv.addEventListener('resize', medir);
        vv.addEventListener('scroll', medir);
        return () => {
            vv.removeEventListener('resize', medir);
            vv.removeEventListener('scroll', medir);
            document.documentElement.style.removeProperty('--vv-alto');
            document.documentElement.style.removeProperty('--vv-top');
        };
    }, []);

    /* Al abrirse el teclado la conversación queda arriba y hay que
       desplazarla a mano. Se baja sola, esperando a que el teclado termine
       de subir: antes de eso el alto todavía no es el definitivo. */
    useEffect(() => {
        if (!escribiendo) return;
        const t1 = setTimeout(() => bajarAlFinal(false), 120);
        const t2 = setTimeout(() => bajarAlFinal(true), 420);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [escribiendo, bajarAlFinal]);

    /* ─── Supabase Realtime subscription ──────────────────────────── */
    const fetchContactsRef = useRef(fetchContacts);
    useEffect(() => { fetchContactsRef.current = fetchContacts; }, [fetchContacts]);

    useEffect(() => {
        if (!session) return;
        let fallbackInterval = null;
        let fallbackMsgInterval = null;

        const channel = supabase
            .channel('chat-realtime', { config: { broadcast: { self: true } } })
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'whatsapp_conversaciones' },
                (payload) => {
                    const newMsg = payload.new;
                    if (!newMsg) return;
                    console.log('[Realtime] Nuevo mensaje:', newMsg.role, newMsg.phone_number);

                    // Play sound for incoming user messages
                    if (newMsg.role === 'user') {
                        playNotifSound();
                    }

                    // Desktop notification for user messages when tab is hidden
                    if (newMsg.role === 'user' && document.hidden && Notification.permission === 'granted') {
                        try {
                            new Notification('Nuevo mensaje - Aurem Gs', {
                                body: truncate(newMsg.content, 80),
                                icon: '/assets/logo-isotipo.png',
                            });
                        } catch { /* Igual que arriba: si el aviso no sale, el mensaje ya llegó al panel. */ }
                    }

                    // Auto-unarchive if new message from archived contact
                    if (newMsg.role === 'user') {
                        setStatusMap(prev => {
                            if (prev[newMsg.phone_number]?.is_archived) {
                                supabase.from('chat_status').upsert({
                                    phone_number: newMsg.phone_number,
                                    is_archived: false,
                                    updated_at: new Date().toISOString(),
                                }, { onConflict: 'phone_number' }).then(() => {});
                                return { ...prev, [newMsg.phone_number]: { ...prev[newMsg.phone_number], is_archived: false } };
                            }
                            return prev;
                        });
                    }

                    // If message belongs to active contact, add to messages (dedup by id)
                    const phone = activeContactRef.current;
                    if (phone && newMsg.phone_number === phone) {
                        setMessages(prev => {
                            // Skip if already exists (dedup by real id or temp id)
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            // Replace optimistic temp message if this is our own sent message
                            if (newMsg.role === 'assistant') {
                                const tempIdx = prev.findIndex(m => String(m.id).startsWith('temp-') && m.content === newMsg.content);
                                if (tempIdx !== -1) {
                                    const updated = [...prev];
                                    updated[tempIdx] = newMsg;
                                    return updated;
                                }
                            }
                            return sortMessages([...prev, newMsg]);
                        });

                        // Mark as read since user is viewing this contact
                        if (newMsg.role === 'user') {
                            supabase.from('whatsapp_conversaciones')
                                .update({ is_read: true })
                                .eq('id', newMsg.id)
                                .then(() => {});
                        }
                    } else if (newMsg.role === 'user') {
                        // Toast for message from non-active contact
                        const contactName = contactsRef.current.find(c => c.phone_number === newMsg.phone_number)?.customer_name || newMsg.phone_number;
                        const toastId = `toast-${Date.now()}`;
                        setToasts(prev => [...prev.slice(-4), { id: toastId, name: contactName, text: truncate(newMsg.content, 50), phone: newMsg.phone_number }]);
                        const toastTimer = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 5000);
                        toastTimersRef.current.push(toastTimer);
                    }

                    // Refresh contacts list (debounced to avoid flooding with rapid messages)
                    clearTimeout(fetchContactsTimerRef.current);
                    fetchContactsTimerRef.current = setTimeout(() => fetchContactsRef.current(true), 800);
                }
            )
            /* Los mensajes cambian DESPUÉS de guardarse, y hasta ahora eso no
               llegaba: el panel sólo escuchaba INSERT.

               Una foto se guarda al instante como "[image]" y sin imagen,
               porque descargarla de Meta y describirla tarda unos segundos.
               Lo mismo una nota de voz, que entra como "[audio]" hasta que se
               transcribe. Quien tuviera el chat abierto se quedaba mirando el
               marcador para siempre, aunque en la base ya estuviera todo.

               También trae los acuses de entrega, que antes sólo aparecían al
               recargar. */
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversaciones' },
                (payload) => {
                    const cambiado = payload.new;
                    if (!cambiado) return;

                    const phone = activeContactRef.current;
                    if (!phone || cambiado.phone_number !== phone) return;

                    setMessages(prev => {
                        const i = prev.findIndex(m => m.id === cambiado.id);
                        if (i === -1) return prev;
                        const copia = [...prev];
                        copia[i] = { ...copia[i], ...cambiado };
                        return copia;
                    });
                }
            )
            .subscribe((status, err) => {
                console.log('[Realtime] Estado:', status, err || '');
                setRealtimeStatus(status);

                // Fallback polling if Realtime disconnects
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[Realtime] Desconectado, activando polling de respaldo');
                    if (!fallbackInterval) {
                        fallbackInterval = setInterval(() => fetchContactsRef.current(true), 10000);
                    }
                    if (!fallbackMsgInterval) {
                        fallbackMsgInterval = setInterval(() => {
                            const phone = activeContactRef.current;
                            if (!phone) return;
                            supabase.from('whatsapp_conversaciones')
                                .select('*').eq('phone_number', phone)
                                .order('created_at', { ascending: true }).limit(200)
                                .then(({ data }) => {
                                    if (data && activeContactRef.current === phone) {
                                        setMessages(prev => {
                                            const sorted = sortMessages(data);
                                            if (prev.length === sorted.length && prev[prev.length - 1]?.id === sorted[sorted.length - 1]?.id) return prev;
                                            return sorted;
                                        });
                                    }
                                });
                        }, 5000);
                    }
                } else if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Conectado correctamente');
                    if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
                    if (fallbackMsgInterval) { clearInterval(fallbackMsgInterval); fallbackMsgInterval = null; }
                }
            });

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            supabase.removeChannel(channel);
            if (fallbackInterval) clearInterval(fallbackInterval);
            if (fallbackMsgInterval) clearInterval(fallbackMsgInterval);
            clearTimeout(fetchContactsTimerRef.current);
            toastTimersRef.current.forEach(t => clearTimeout(t));
            toastTimersRef.current = [];
        };
    }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ─── Enviar un mensaje escrito por una persona ───────────────
       Va por la función wa-send, que habla con la Cloud API y guarda la
       fila con enviado_por='humano'. Antes salía a un webhook de n8n en
       localhost con mode:'no-cors', así que el navegador no podía leer la
       respuesta y un fallo se veía igual que un envío correcto. */
    const handleSend = async () => {
        if (!newMessage.trim() || !activeContact || sending) return;
        setSending(true);
        setSendError(null);
        const msg = newMessage.trim();
        const tempId = `temp-${Date.now()}`;

        const optimisticMsg = {
            id: tempId,
            phone_number: activeContact,
            role: 'assistant',
            content: msg,
            enviado_por: 'humano',
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');

        try {
            const { data, error } = await supabase.functions.invoke('wa-send', {
                body: { telefono: activeContact, texto: msg },
            });
            if (error || data?.error) throw new Error(data?.error || error.message);
            // La fila real llega por la suscripción en vivo; se retira la burbuja
            // provisional cuando aparezca.
        } catch (e) {
            console.error('No se pudo enviar:', e);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _failed: true } : m));
            setSendError(e.message || 'No se pudo enviar el mensaje.');
        }
        setSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    /* ─── Enviar una foto del catálogo ───────────────────────────── */
    const handleSendImage = async (product) => {
        if (!activeContact || sendingImage) return;
        setSendingImage(true);
        const caption = imageCaption.trim() || `${product.name} - $${Number(product.price).toLocaleString('es-CO')}`;

        try {
            const { data, error } = await supabase.functions.invoke('wa-send', {
                body: { telefono: activeContact, texto: caption, imagenUrl: product.image_url },
            });
            if (error || data?.error) throw new Error(data?.error || error.message);
        } catch (e) {
            console.error('No se pudo enviar la imagen:', e);
            setSendError(e.message || 'No se pudo enviar la imagen.');
        }

        setShowImagePicker(false);
        setSelectedProduct(null);
        setImageCaption('');
        setProductSearch('');
        setSendingImage(false);
    };

    /* ─── Toggle takeover ───────────────────────────────────────── */
    const handleToggleTakeover = async () => {
        if (!activeContact) return;
        const isTakeover = !!takeoverMap[activeContact];
        if (isTakeover) {
            await supabase.from('chat_takeover')
                .update({ is_active: false, ended_at: new Date().toISOString() })
                .eq('phone_number', activeContact)
                .eq('is_active', true);
        } else {
            await supabase.from('chat_takeover')
                .upsert(
                    { phone_number: activeContact, admin_email: session?.user?.email, is_active: true, started_at: new Date().toISOString(), ended_at: null },
                    { onConflict: 'phone_number' }
                );
        }
    };

    /* ─── Save customer notes ───────────────────────────────────── */
    const handleSaveNotes = async () => {
        if (!contactCustomer) return;
        await supabase.from('customers').update({ notes: customerNotes }).eq('id', contactCustomer.id);
        setContactCustomer(prev => ({ ...prev, notes: customerNotes }));
        setEditingNotes(false);
    };

    /* ─── Toggle resolved ───────────────────────────────────────── */
    const handleToggleResolved = async (phone) => {
        if (!phone) return;
        const current = statusMap[phone];
        const newVal = !(current?.is_resolved);
        await supabase.from('chat_status').upsert({
            phone_number: phone,
            is_resolved: newVal,
            resolved_at: newVal ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'phone_number' });
        setStatusMap(prev => ({ ...prev, [phone]: { ...prev[phone], is_resolved: newVal } }));
    };

    /* ─── Archive conversation ───────────────────────────────────── */
    const handleArchive = async (phone) => {
        if (!phone) return;
        await supabase.from('chat_status').upsert({
            phone_number: phone,
            is_archived: true,
            archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'phone_number' });
        setStatusMap(prev => ({ ...prev, [phone]: { ...prev[phone], is_archived: true } }));
        setConfirmArchive(null);
        if (activeContact === phone) { setActiveContact(null); setMobileShowChat(false); }
    };

    /**
     * Archivar lo marcado de una vez.
     *
     * Un solo upsert con todas las filas en vez de una vuelta por conversación:
     * archivar es reversible y barato, así que no necesita el desfile de
     * progreso que sí lleva el borrado.
     */
    const handleArchivarLote = async () => {
        if (!seleccion?.size || archivandoLote) return;
        setArchivandoLote(true); setErrorLote('');
        const ahora = new Date().toISOString();
        const filas = [...seleccion].map(phone => ({
            phone_number: phone,
            is_archived: true,
            archived_at: ahora,
            updated_at: ahora,
        }));
        const { error } = await supabase.from('chat_status').upsert(filas, { onConflict: 'phone_number' });
        setArchivandoLote(false);
        if (error) { setErrorLote(`No se pudieron archivar: ${error.message}`); return; }

        setStatusMap(prev => {
            const n = { ...prev };
            seleccion.forEach(p => { n[p] = { ...n[p], is_archived: true }; });
            return n;
        });
        if (seleccion.has(activeContact)) { setActiveContact(null); setMobileShowChat(false); }
        salirDeSeleccion();
    };

    /* Sacar del archivo a mano. Volver a archivar lo ya archivado no hace
       nada, así que el menú ofrece lo contrario cuando ya está guardada. */
    const handleUnarchive = async (phone) => {
        if (!phone) return;
        await supabase.from('chat_status').upsert({
            phone_number: phone,
            is_archived: false,
            archived_at: null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'phone_number' });
        setStatusMap(prev => ({ ...prev, [phone]: { ...prev[phone], is_archived: false } }));
    };

    /* ─── Eliminar una conversación ─────────────────────────────── */
    /**
     * El borrado en sí vive en EliminarChat, que es quien sabe qué hay dentro
     * del hilo, quien pide confirmación y quien mira los errores. Aquí sólo se
     * recoge la lista después: se quitan los rastros que el panel tenía en
     * memoria para que el contacto no reaparezca hasta el próximo refresco.
     */
    const alBorrarChat = (telefonos, opciones) => {
        const idos = new Set([].concat(telefonos || []));
        if (!idos.size && !opciones?.abierto) { setABorrar(null); return; }

        const sinLosIdos = (mapa) => {
            const n = { ...mapa };
            idos.forEach(p => delete n[p]);
            return n;
        };

        setContacts(prev => prev.filter(c => !idos.has(c.phone_number)));
        setStatusMap(sinLosIdos);
        setTagsMap(sinLosIdos);
        setTakeoverMap(sinLosIdos);
        setToasts(prev => prev.filter(t => !idos.has(t.phone)));
        setSeleccion(prev => (prev ? new Set([...prev].filter(p => !idos.has(p))) : prev));
        setMenuFila(null);

        /* Si alguna falló, el diálogo se queda abierto con el parte de lo que
           no se pudo: cerrarlo sería tragarse el error. */
        if (!opciones?.abierto) setABorrar(null);

        if (idos.has(activeContact)) { setActiveContact(null); setMessages([]); setMobileShowChat(false); }
    };

    /* ─── Borrar sólo las fotos ─────────────────────────────────── */
    /**
     * Las fotos son lo único que pesa en Storage; el texto de un hilo largo no
     * llega a un par de kilobytes. Esto las suelta y deja el hilo entero: el pie
     * que escribió la clienta y lo que Valentina entendió de la imagen siguen
     * ahí, con un sello de que la foto ya no está.
     */
    const handleBorrarFotos = async () => {
        if (!activeContact || borrandoFotos) return;
        setBorrandoFotos(true);
        const { error } = await borrarFotosDe(activeContact);
        setBorrandoFotos(false);
        setConfirmFotos(false);
        if (error) { setSendError(`No se pudieron borrar las fotos: ${error}`); return; }
        setMessages(prev => prev.map(m => (m.message_type === 'image' ? { ...m, media_url: null } : m)));
        setFotosDelHilo(0);
    };

    /* ─── Add tag ────────────────────────────────────────────────── */
    const handleAddTag = async (phone, tagName, color) => {
        if (!phone || !tagName) return;
        const { data } = await supabase.from('contact_tags')
            .upsert({ phone_number: phone, tag_name: tagName, color }, { onConflict: 'phone_number,tag_name' })
            .select().single();
        if (data) {
            setTagsMap(prev => {
                const existing = (prev[phone] || []).filter(t => t.tag_name !== tagName);
                return { ...prev, [phone]: [...existing, data] };
            });
        }
    };

    /* ─── Remove tag ─────────────────────────────────────────────── */
    const handleRemoveTag = async (phone, tagId) => {
        if (!phone || !tagId) return;
        await supabase.from('contact_tags').delete().eq('id', tagId);
        setTagsMap(prev => ({
            ...prev,
            [phone]: (prev[phone] || []).filter(t => t.id !== tagId),
        }));
    };

    /* ─── Lightbox ───────────────────────────────────────────────── */
    const openLightbox = (url) => { setLightboxImg(url); setLightboxClosing(false); };
    const closeLightbox = () => {
        setLightboxClosing(true);
        setTimeout(() => { setLightboxImg(null); setLightboxClosing(false); }, 300);
    };

    /* ─── Llevarse el hilo ───────────────────────────────────────── */
    /**
     * Antes esto exportaba `messages`, que es lo que hay cargado en pantalla:
     * los 200 últimos. Un hilo de dos años se descargaba recortado y sin
     * decirlo. Ahora lo trae entero el módulo, que además le pone el BOM al
     * CSV para que Excel no rompa las tildes.
     */
    const handleExport = async (formato) => {
        if (!activeContact) return;
        const { error } = await descargarChat(activeContact, formato);
        if (error) setSendError(`No se pudo descargar: ${error}`);
    };

    /* ─── Close panels on outside click ─────────────────────────── */
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target)) {
                setShowQuickReplies(false);
            }
            if (imagePickerRef.current && !imagePickerRef.current.contains(e.target)) {
                setShowImagePicker(false);
                setSelectedProduct(null);
            }
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setShowExportMenu(false);
            }
            if (menuFilaRef.current && !menuFilaRef.current.contains(e.target)) {
                setMenuFila(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ─── Tab title with unread badge ─────────────────────────────── */
    const totalUnreadMemo = useMemo(() => contacts.reduce((s, c) => s + (c.unread || 0), 0), [contacts]);
    useEffect(() => {
        document.title = totalUnreadMemo > 0 ? `(${totalUnreadMemo}) Chat - Aurem Gs` : 'Chat - Aurem Gs';
        return () => { document.title = 'Aurem Gs'; };
    }, [totalUnreadMemo]);

    /* ─── Keyboard shortcuts ──────────────────────────────────────── */
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Ctrl+K → focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }
            // Escape → close panels cascade
            if (e.key === 'Escape') {
                if (lightboxImg) { closeLightbox(); return; }
                if (confirmArchive) { setConfirmArchive(null); return; }
                if (showMsgSearch) { setShowMsgSearch(false); setMsgSearchQuery(''); setMsgSearchResults([]); return; }
                if (showExportMenu) { setShowExportMenu(false); return; }
                if (showContactInfo) { setShowContactInfo(false); return; }
                if (showQuickReplies) { setShowQuickReplies(false); return; }
                if (showImagePicker) { setShowImagePicker(false); setSelectedProduct(null); return; }
                if (activeContact) { setActiveContact(null); setMobileShowChat(false); return; }
            }
        };
        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, [showContactInfo, showQuickReplies, showImagePicker, activeContact, showMsgSearch, showExportMenu, lightboxImg, confirmArchive]);

    /* ─── Sidebar nav ─────────────────────────────────────────────── */
    const handleNavClick = (id) => {
        navigate(`/admin?tab=${id}`);
    };

    /* ─── Filter & sort contacts (takeover first) ───────────────── */
    const filteredContacts = useMemo(() => {
        const now = Date.now();
        const filtered = contacts.filter(c => {
            /* Las archivadas no salen en ningún filtro salvo el suyo… y el de
               purga: haberla archivado hace un año es un motivo más para
               borrarla, no uno para esconderla de la limpieza. */
            const isArchived = statusMap[c.phone_number]?.is_archived;
            if (contactFilter !== 'archivado' && contactFilter !== 'purgar' && isArchived) return false;
            if (contactFilter === 'archivado' && !isArchived) return false;

            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (c.customer_name && c.customer_name.toLowerCase().includes(q))
                || c.phone_number.includes(q)
                || (c.last_message && c.last_message.toLowerCase().includes(q));
        });
        // Apply contact filter
        let result = filtered;
        if (contactFilter === 'hoy') {
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            result = result.filter(c => new Date(c.last_time) >= todayStart);
        } else if (contactFilter === 'takeover') {
            result = result.filter(c => !!takeoverMap[c.phone_number]);
        } else if (contactFilter === 'pendiente') {
            result = result.filter(c => pendingPhones.has(normalizePhone(c.phone_number)));
        } else if (contactFilter === 'no_leidos') {
            result = result.filter(c => (c.unread || 0) > 0);
        } else if (contactFilter === 'sin_responder') {
            // Last message from user more than 24h ago
            result = result.filter(c => c.last_role === 'user' && (now - new Date(c.last_time)) > 86400000);
        } else if (contactFilter === 'resuelto') {
            result = result.filter(c => !!statusMap[c.phone_number]?.is_resolved);
        } else if (contactFilter === 'purgar') {
            /* Mientras la base contesta no se enseña nada: una lista completa
               que en un segundo se recorta a dos es peor que un momento vacío. */
            const candidatas = new Set((purgables || []).map(f => f.phone_number));
            result = purgables === null ? [] : result.filter(c => candidatas.has(c.phone_number));
            /* Las más viejas primero: son las que menos duele soltar. */
            return [...result].sort((a, b) => new Date(a.last_time) - new Date(b.last_time));
        }
        // Takeover contacts always appear first
        return result.sort((a, b) => {
            const aTakeover = takeoverMap[a.phone_number] ? 1 : 0;
            const bTakeover = takeoverMap[b.phone_number] ? 1 : 0;
            if (aTakeover !== bTakeover) return bTakeover - aTakeover;
            return new Date(b.last_time) - new Date(a.last_time);
        });
    }, [contacts, searchQuery, takeoverMap, contactFilter, pendingPhones, statusMap, purgables]);

    /* Cuántas conversaciones esperan respuesta: el último mensaje es de la
       cliente y la conversación no está archivada ni resuelta. */
    const esperanRespuesta = useMemo(() => contacts.filter(c => {
        const s = statusMap[c.phone_number];
        return c.last_role === 'user' && !s?.is_archived && !s?.is_resolved;
    }).length, [contacts, statusMap]);

    /* Cuántas lleva alguien a mano ahora mismo. */
    const enManual = useMemo(
        () => contacts.filter(c => !!takeoverMap[c.phone_number] && !statusMap[c.phone_number]?.is_archived).length,
        [contacts, takeoverMap, statusMap]
    );

    /* ─── Candidatas a purga ──────────────────────────────────────── */
    /**
     * Al entrar al filtro se piden a la base y se marcan todas de una: quien
     * llega aquí viene a limpiar, no a elegir una. Lo que se revisa es qué
     * salvar, y para eso se desmarca.
     */
    useEffect(() => {
        /* Cambiar de filtro cierra la selección. Sin esto, salir de la purga
           dejaba el modo encendido sobre una lista distinta: el siguiente clic
           marcaba una conversación en vez de abrirla, y nadie entendía por qué.
           Lo marcado se refiere a una lista que acaba de cambiar debajo. */
        setSeleccion(null);

        if (contactFilter !== 'purgar') { setPurgables(null); return; }
        let vigente = true;
        setCargandoPurga(true); setErrorLote('');
        supabase.rpc('conversaciones_purgables', { p_meses: MESES_PURGA })
            .then(({ data, error }) => {
                if (!vigente) return;
                setCargandoPurga(false);
                if (error) { setPurgables([]); setErrorLote(`No se pudo calcular la purga: ${error.message}`); return; }
                setPurgables(data || []);
                setSeleccion(new Set((data || []).map(f => f.phone_number)));
            });
        return () => { vigente = false; };
    }, [contactFilter]);

    /* ─── Selección múltiple ──────────────────────────────────────── */
    /* Entrar y salir del modo. Al salir se olvida lo marcado a propósito: una
       selección que sobrevive escondida es una trampa para el siguiente clic. */
    const entrarEnSeleccion = (marcadas) => setSeleccion(new Set(marcadas || []));
    const salirDeSeleccion = () => setSeleccion(null);

    const alternarMarca = (phone) => {
        setSeleccion(prev => {
            const n = new Set(prev || []);
            if (n.has(phone)) n.delete(phone); else n.add(phone);
            return n;
        });
    };

    /* ─── Select contact ──────────────────────────────────────────── */
    const selectContact = (phone) => {
        setActiveContact(phone);
        setMobileShowChat(true);
    };

    const filteredProducts = products.filter(p => {
        if (!productSearch) return true;
        return p.name.toLowerCase().includes(productSearch.toLowerCase());
    });

    if (!session) return null;

    const activeContactData = contacts.find(c => c.phone_number === activeContact);
    const activeDisplayName = activeContactData?.customer_name || activeContact;
    const isTakeover = !!takeoverMap[activeContact];
    const totalUnread = totalUnreadMemo;

    return (
        <>
        <div className="admin-layout">
            <AdminSidebar session={session} activeId="chat" onNavClick={handleNavClick} chatUnread={totalUnreadMemo} />

            <main className="admin-content">
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        <span className="admin-topbar-icon">{NAV.find(n => n.id === 'chat')?.icon}</span>
                        <h2 className="admin-topbar-title">
                            <span>Conversaciones</span>
                            <span className={`chat-rt-status ${realtimeStatus === 'SUBSCRIBED' ? 'chat-rt-status--ok' : 'chat-rt-status--err'}`}
                                  title={realtimeStatus === 'SUBSCRIBED' ? 'Conectado en tiempo real' : `Estado: ${realtimeStatus}`} />
                            {totalUnread > 0 ? <span className="chat-nav-badge">{totalUnread}</span> : null}
                        </h2>
                    </div>
                    <div className="admin-topbar-right">
                        <button
                            className={`chat-sound-toggle ${soundEnabled ? '' : 'chat-sound-toggle--muted'}`}
                            onClick={() => {
                                const next = !soundEnabled;
                                setSoundEnabled(next);
                                localStorage.setItem('admin_sound_enabled', String(next));
                            }}
                            title={soundEnabled ? 'Silenciar notificaciones' : 'Activar notificaciones'}
                        >
                            {soundEnabled ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                            )}
                        </button>
                        <div className="admin-topbar-avatar">{session.user.email[0].toUpperCase()}</div>
                    </div>
                </header>

                <div className="chat-panel">
                    {/* Contact list */}
                    <div className={`chat-contacts ${mobileShowChat ? 'chat-contacts--hidden-mobile' : ''}`}>
                        <div className="chat-contacts-header">
                            <div className="chat-contacts-titulo">
                                <h2>Chats</h2>
                                <span className={`chat-agente ${enManual > 0 ? 'chat-agente--manual' : ''}`}>
                                    <span className="chat-agente-punto" />
                                    {enManual > 0
                                        ? `${enManual} en manual`
                                        : esperanRespuesta > 0
                                            ? `${esperanRespuesta} espera${esperanRespuesta !== 1 ? 'n' : ''}`
                                            : 'Valentina activa'}
                                </span>
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="chat-search"
                                placeholder="Buscar conversacion... (Ctrl+K)"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <div className="riel" role="group" aria-label="Filtrar conversaciones">
                                {[
                                    ['todos', 'Todos'],
                                    ['hoy', 'Hoy'],
                                    ['no_leidos', 'No leídos'],
                                    ['sin_responder', '+24h'],
                                    ['takeover', 'Manual'],
                                    ['pendiente', 'Pedido'],
                                    ['resuelto', 'Resuelto'],
                                    ['archivado', 'Archivados'],
                                    ['purgar', 'Para purgar'],
                                ].map(([f, label]) => (
                                    <button key={f} type="button"
                                            className={`riel-btn${contactFilter === f ? ' riel-btn--on' : ''}`}
                                            aria-pressed={contactFilter === f}
                                            onClick={() => setContactFilter(f)}>
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Ni oculta tras un gesto ni ocupando sitio de más:
                                una línea que en reposo sólo ofrece entrar, y que
                                al entrar se convierte en el mando del lote. */}
                            <div className="chat-seleccion-barra">
                                {seleccion ? (
                                    <>
                                        <span className="chat-seleccion-cuenta">
                                            {seleccion.size === 0
                                                ? 'Ninguna marcada'
                                                : seleccion.size === 1
                                                    ? '1 marcada'
                                                    : `${seleccion.size} marcadas`}
                                        </span>
                                        <button type="button" onClick={() => entrarEnSeleccion(filteredContacts.map(c => c.phone_number))}>Todas</button>
                                        <button type="button" onClick={() => entrarEnSeleccion([])}>Ninguna</button>
                                        <button type="button" className="chat-seleccion-salir" onClick={salirDeSeleccion}>Cancelar</button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => entrarEnSeleccion([])}>Seleccionar varias</button>
                                )}
                            </div>
                        </div>
                        {contactFilter === 'purgar' && (
                            <p className="chat-purga-aviso">
                                Sin ningún pedido y sin escribir desde hace más de {MESES_PURGA} meses.
                                Quien ya compró no aparece aquí nunca: la garantía del metal es de por vida.
                            </p>
                        )}
                        <div className="chat-contacts-list">
                            {loading || cargandoPurga ? (
                                <div className="chat-loading">
                                    {cargandoPurga ? 'Buscando conversaciones para purgar…' : 'Cargando conversaciones...'}
                                </div>
                            ) : filteredContacts.length === 0 ? (
                                <div className="chat-loading">
                                    {contactFilter === 'purgar'
                                        ? 'Nada que purgar: no hay conversaciones que cumplan el plazo.'
                                        : 'No hay conversaciones'}
                                </div>
                            ) : (
                                filteredContacts.map(c => {
                                    const cTakeover = !!takeoverMap[c.phone_number];
                                    const cResolved = !!statusMap[c.phone_number]?.is_resolved;
                                    const cTags = tagsMap[c.phone_number] || [];
                                    const marcada = !!seleccion?.has(c.phone_number);
                                    /* En modo selección la fila marca en vez de abrir:
                                       tener que apuntar a una casilla de 16 px para
                                       elegir siete conversaciones es puntería, no
                                       interfaz. */
                                    const alPulsar = () => (seleccion ? alternarMarca(c.phone_number) : selectContact(c.phone_number));
                                    return (
                                    /* Deja de ser un <button> porque ahora lleva
                                       otro botón dentro —el de los tres puntos— y un
                                       botón dentro de otro no es HTML válido: el
                                       navegador desarma la fila entera. Con role y
                                       tabIndex sigue enfocándose y respondiendo a
                                       Enter y a la barra espaciadora igual que antes. */
                                    <div
                                        key={c.phone_number}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={seleccion ? marcada : undefined}
                                        className={`chat-contact-item ${activeContact === c.phone_number && !seleccion ? 'chat-contact-item--active' : ''} ${cTakeover ? 'chat-contact-item--takeover' : ''} ${(c.unread || 0) > 0 ? 'chat-contact-item--unread' : ''} ${marcada ? 'chat-contact-item--marcada' : ''}`}
                                        onClick={alPulsar}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                alPulsar();
                                            }
                                        }}
                                    >
                                        {seleccion && (
                                            <input
                                                type="checkbox"
                                                className="chat-contact-casilla"
                                                checked={marcada}
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                onChange={() => alternarMarca(c.phone_number)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        )}
                                        <div className="chat-contact-avatar">
                                            {c.customer_name ? c.customer_name[0].toUpperCase() : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            )}
                                            {cTakeover && <span className="chat-contact-takeover-dot" />}
                                            {cResolved && !cTakeover && <span className="chat-contact-resolved-dot" title="Resuelto">✓</span>}
                                        </div>
                                        <div className="chat-contact-info">
                                            <div className="chat-contact-top">
                                                <span className={`chat-contact-name ${(c.unread || 0) > 0 ? 'chat-contact-name--unread' : ''}`}>
                                                    {c.customer_name || c.phone_number}
                                                </span>
                                                {cTakeover && <span className="chat-takeover-badge">MANUAL</span>}
                                                <span className="chat-contact-time">
                                                    {contactFilter === 'purgar' ? fmtDateFull(c.last_time) : fmtDate(c.last_time)}
                                                </span>
                                            </div>
                                            <div className="chat-contact-preview">
                                                <span>{truncate(c.last_message, 45)}</span>
                                            </div>
                                            {cTags.length > 0 && (
                                                <div className="chat-contact-tags">
                                                    {cTags.slice(0, 3).map(t => (
                                                        <span key={t.id} className="chat-tag-pill" style={{ '--tag-color': t.color }}>{t.tag_name}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {(c.unread || 0) > 0
                                            ? <span className="chat-unread-badge">{c.unread}</span>
                                            : c.last_role === 'assistant' && !cTakeover && <span className="chat-contact-ia">IA</span>}

                                        {/* Archivar y eliminar, en la fila. Antes había que
                                            abrir el chat y entrar al menú de exportar para
                                            encontrar el borrado; aquí está donde se mira la
                                            lista, que es donde se decide de qué sobra.

                                            Se calla mientras hay una selección abierta: dos
                                            formas de borrar la misma fila, una para esta y
                                            otra para el lote, es una invitación a equivocarse. */}
                                        {!seleccion && (
                                        <div
                                            className="chat-contact-menu"
                                            ref={menuFila?.phone === c.phone_number ? menuFilaRef : null}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                className={`chat-contact-menu-btn ${menuFila?.phone === c.phone_number ? 'chat-contact-menu-btn--abierto' : ''}`}
                                                aria-label={`Opciones de ${c.customer_name || c.phone_number}`}
                                                aria-expanded={menuFila?.phone === c.phone_number}
                                                onClick={e => {
                                                    if (menuFila?.phone === c.phone_number) { setMenuFila(null); return; }
                                                    /* La lista tiene su propio scroll, así que un menú
                                                       que se abre hacia abajo en la última fila queda
                                                       cortado. Si no cabe, se abre hacia arriba. */
                                                    const lista = e.currentTarget.closest('.chat-contacts-list');
                                                    const fondo = e.currentTarget.getBoundingClientRect().bottom;
                                                    const cabe = !lista || fondo + 150 < lista.getBoundingClientRect().bottom;
                                                    setMenuFila({ phone: c.phone_number, arriba: !cabe });
                                                }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                                            </button>
                                            {menuFila?.phone === c.phone_number && (
                                                <div className={`chat-fila-menu ${menuFila.arriba ? 'chat-fila-menu--arriba' : ''}`}>
                                                    {statusMap[c.phone_number]?.is_archived ? (
                                                        <button type="button" onClick={() => { setMenuFila(null); handleUnarchive(c.phone_number); }}>
                                                            Sacar del archivo
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={() => { setMenuFila(null); setConfirmArchive(c.phone_number); }}>
                                                            Archivar
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => { setMenuFila(null); handleToggleResolved(c.phone_number); }}>
                                                        {cResolved ? 'Marcar sin resolver' : 'Marcar resuelta'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="chat-fila-menu-danger"
                                                        onClick={() => { setMenuFila(null); setABorrar([{ telefono: c.phone_number, nombre: c.customer_name }]); }}
                                                    >
                                                        Eliminar conversación
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                    );
                                })
                            )}
                        </div>

                        {/* La barra vive al pie de la columna, no de la ventana:
                            la lista es una columna con su propio scroll y una barra
                            pegada al borde del navegador quedaría suelta encima del
                            chat abierto, que no tiene nada que ver con lo marcado. */}
                        {errorLote && (
                            <p className="chat-lote-error" onClick={() => setErrorLote('')} title="Descartar">
                                {errorLote}
                            </p>
                        )}
                        {seleccion?.size > 0 && (
                            <div className="chat-lote-barra">
                                <span>
                                    {seleccion.size === 1 ? '1 conversación' : `${seleccion.size} conversaciones`}
                                </span>
                                <button type="button" className="chat-lote-btn" onClick={handleArchivarLote} disabled={archivandoLote}>
                                    {archivandoLote ? 'Archivando…' : 'Archivar'}
                                </button>
                                <button
                                    type="button"
                                    className="chat-lote-btn chat-lote-btn--danger"
                                    onClick={() => setABorrar([...seleccion].map(p => ({
                                        telefono: p,
                                        nombre: contacts.find(c => c.phone_number === p)?.customer_name,
                                    })))}
                                >
                                    Eliminar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Chat conversation */}
                    <div className={`chat-conversation ${!mobileShowChat ? 'chat-conversation--hidden-mobile' : ''}`}>
                        {!activeContact ? (
                            <div className="chat-empty-state">
                                <div className="chat-empty-state-icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                </div>
                                <p>Selecciona una conversación</p>
                                <span className="chat-empty-state-sub">Elige un contacto de la lista para ver sus mensajes</span>
                            </div>
                        ) : (
                            <>
                                {/* Chat header */}
                                <div className="chat-conv-header">
                                    <button className="chat-back-btn" onClick={() => setMobileShowChat(false)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    </button>
                                    <div className="chat-conv-header-avatar">
                                        {activeContactData?.customer_name ? activeContactData.customer_name[0].toUpperCase() : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        )}
                                    </div>
                                    <div className="chat-conv-header-info">
                                        <div className="chat-conv-header-name">
                                            <span>{activeDisplayName}</span>
                                            <span className={`chat-mode-badge ${isTakeover ? 'chat-mode-badge--manual' : 'chat-mode-badge--ai'}`}>
                                                {isTakeover ? 'Control manual' : 'Agente IA'}
                                            </span>
                                        </div>
                                        {activeContactData?.customer_name ? (
                                            <div className="chat-conv-header-phone">{activeContact}</div>
                                        ) : null}
                                    </div>
                                    <div className="chat-conv-header-actions">
                                        <button className={`chat-header-action-btn chat-header-action-btn--secundaria ${showMsgSearch ? 'chat-header-action-btn--active' : ''}`}
                                                onClick={() => setShowMsgSearch(!showMsgSearch)} title="Buscar en mensajes">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                        </button>
                                        <button
                                            className={`chat-header-action-btn chat-header-action-btn--secundaria ${statusMap[activeContact]?.is_resolved ? 'chat-header-action-btn--resolved' : ''}`}
                                            onClick={() => handleToggleResolved(activeContact)}
                                            title={statusMap[activeContact]?.is_resolved ? 'Marcar como no resuelto' : 'Marcar como resuelto'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        </button>
                                        <button
                                            className="chat-header-action-btn chat-header-action-btn--secundaria"
                                            onClick={() => setConfirmArchive(activeContact)}
                                            title="Archivar conversación"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                                        </button>
                                        <button
                                            className={`chat-takeover-btn ${isTakeover ? 'chat-takeover-btn--active' : ''}`}
                                            onClick={handleToggleTakeover}
                                            title={isTakeover ? 'Devolver al agente IA' : 'Tomar control manual'}
                                        >
                                            {isTakeover ? (
                                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z"/><path d="M4.93 13.5a8 8 0 0014.14 0"/><path d="M12 18v4"/></svg> <span>Devolver a IA</span></>
                                            ) : (
                                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> <span>Tomar control</span></>
                                            )}
                                        </button>
                                        <div className="chat-export-dropdown" ref={exportMenuRef} style={{position:'relative'}}>
                                            {/* Era un icono de descarga y dentro estaba el
                                                único sitio del panel donde se podía borrar un
                                                chat. Nadie busca "eliminar" detrás de una
                                                flecha de descargar: ahora son tres puntos, que
                                                es donde todo el mundo mira cuando falta algo. */}
                                            <button className="chat-header-action-btn chat-header-action-btn--secundaria" onClick={() => setShowExportMenu(!showExportMenu)} title="Más opciones" aria-label="Más opciones" aria-expanded={showExportMenu}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
                                            </button>
                                            {showExportMenu && (
                                                <div className="chat-export-menu">
                                                    <button onClick={() => { handleExport('txt'); setShowExportMenu(false); }}>Exportar TXT</button>
                                                    <button onClick={() => { handleExport('csv'); setShowExportMenu(false); }}>Exportar CSV</button>
                                                    {fotosDelHilo > 0 && (
                                                        <button onClick={() => { setConfirmFotos(true); setShowExportMenu(false); }}>
                                                            Borrar sólo las fotos ({fotosDelHilo})
                                                        </button>
                                                    )}
                                                    <button className="chat-export-menu-danger" onClick={() => { setABorrar([{ telefono: activeContact, nombre: activeContactData?.customer_name }]); setShowExportMenu(false); }}>Eliminar conversación</button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className={`chat-header-action-btn ${showContactInfo ? 'chat-header-action-btn--active' : ''}`}
                                            onClick={() => setShowContactInfo(!showContactInfo)}
                                            title="Info del contacto"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Message search bar */}
                                {showMsgSearch && (
                                    <div className="chat-msg-search-bar">
                                        <input type="text" className="chat-msg-search-input" placeholder="Buscar en mensajes..."
                                               value={msgSearchQuery} onChange={e => setMsgSearchQuery(e.target.value)} autoFocus />
                                        {searchingMsgs && <span className="chat-msg-search-spinner" />}
                                        {msgSearchResults.length > 0 && (
                                            <div className="chat-msg-search-results">
                                                {msgSearchResults.slice(0, 8).map((r, i) => (
                                                    <button key={i} className="chat-msg-search-result" onClick={() => {
                                                        setActiveContact(r.phone_number);
                                                        setShowMsgSearch(false);
                                                        setMsgSearchQuery('');
                                                        setMsgSearchResults([]);
                                                    }}>
                                                        <span className="chat-msg-search-phone">{r.phone_number}</span>
                                                        <span className="chat-msg-search-text">{truncate(r.content, 60)}</span>
                                                        <span className="chat-msg-search-time">{fmtDate(r.created_at)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Takeover banner */}
                                {isTakeover && (
                                    <div className="chat-takeover-banner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        <span>Modo manual activo — Valentina no responde en este chat. Tus mensajes se envían directamente al cliente.</span>
                                        <button className="chat-takeover-banner-end" onClick={handleToggleTakeover}>Devolver a IA</button>
                                    </div>
                                )}

                                <div className="chat-conv-body">
                                    {/* Messages */}
                                    <div className="chat-conv-messages">
                                        {loadingMsgs ? (
                                            <div className="chat-loading">Cargando mensajes...</div>
                                        ) : (
                                            messages.map((msg, i) => {
                                                const showDate = i === 0 || !isSameDay(messages[i - 1]?.created_at, msg.created_at);
                                                /* La hora sólo en el último mensaje de una tanda seguida
                                                   del mismo minuto: el hilo se lee mucho más limpio. */
                                                const sig = messages[i + 1];
                                                const showTime = !sig
                                                    || (sig.role || 'user') !== (msg.role || 'user')
                                                    || fmtTime(sig.created_at) !== fmtTime(msg.created_at);
                                                return (
                                                    <React.Fragment key={msg.id || `msg-${i}`}>
                                                        {showDate ? (
                                                            <div className="chat-date-separator">
                                                                <span>{fmtSeparador(msg.created_at)}</span>
                                                            </div>
                                                        ) : null}
                                                        <div className={`chat-msg chat-msg--${msg.role || 'user'}`}>
                                                        <div className={`chat-bubble chat-bubble--${msg.role || 'user'}${msg.enviado_por === 'humano' ? ' chat-bubble--admin' : ''}${msg._failed ? ' chat-bubble--error' : ''}`}>
                                                            {/* Una foto borrada sigue siendo un mensaje. Antes el
                                                                pie dependía de que hubiera archivo, así que al
                                                                soltar las fotos la burbuja pasaba a enseñar el
                                                                contenido crudo —"📷 descripción…"— en vez de lo
                                                                que la clienta escribió. Ahora manda el tipo de
                                                                mensaje y el archivo sólo decide si hay imagen o
                                                                sello. */}
                                                            {msg.message_type === 'image' ? (
                                                                msg.media_url
                                                                    ? <ImagenDelChat ruta={msg.media_url} onAbrir={openLightbox} />
                                                                    : <div className="chat-foto-borrada">Foto borrada</div>
                                                            ) : null}
                                                            {msg.message_type === 'image' && msg.role === 'user'
                                                                ? <PieDeFoto contenido={msg.content} />
                                                                : msg.content ? <div className="chat-bubble-content"><span>{msg.content}</span></div> : null}
                                                        </div>
                                                            {(msg._failed || showTime) && (
                                                            <div className="chat-bubble-time">
                                                                {msg._failed ? <span style={{ color: '#ef4444' }}>Error al enviar</span> : (
                                                                    <>
                                                                        <span>{fmtTime(msg.created_at)}</span>
                                                                        {msg.role === 'assistant' && (() => {
                                                                            const acuse = msg.delivery_status || (String(msg.id).startsWith('temp-') ? 'sending' : 'sent');
                                                                            return (
                                                                                <span
                                                                                    className={`chat-delivery-status chat-delivery-status--${acuse}`}
                                                                                    title={ACUSE[acuse] || acuse}
                                                                                >
                                                                                    {acuse === 'sending' ? '·' : acuse === 'read' || acuse === 'delivered' ? '✓✓' : '✓'}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </>
                                                                )}
                                                            </div>
                                                            )}
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Contact info panel */}
                                    {showContactInfo && (
                                        <div className="chat-info-panel">
                                            <div className="chat-info-panel-header">
                                                <h4>Contacto</h4>
                                                <button className="chat-info-close" onClick={() => setShowContactInfo(false)}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                </button>
                                            </div>
                                            <div className="chat-info-panel-body">
                                                {/* ── Profile card ── */}
                                                <div className="chat-info-profile">
                                                    <div className="chat-info-avatar">
                                                        {iniciales(contactCustomer?.name || (contactOrders.length > 0 && contactOrders[0].customer_name))}
                                                    </div>
                                                    <div className="chat-info-identity">
                                                        <h5>{contactCustomer?.name || (contactOrders.length > 0 && contactOrders[0].customer_name) || 'Sin nombre'}</h5>
                                                        <span className="chat-info-phone">
                                                            {activeContact}
                                                            {messages.length > 0 && ` · Cliente desde ${fmtDate(messages[0].created_at)}`}
                                                        </span>
                                                    </div>
                                                    <span className={`chat-info-modo ${isTakeover ? 'chat-info-modo--manual' : ''}`}>
                                                        {isTakeover ? 'La llevas tú' : 'Atendida por la IA'}
                                                    </span>
                                                </div>

                                                {/* ── Meta pills ── */}
                                                <div className="chat-info-meta">
                                                    {/* Había aquí un `!== 'noreply@auremgs.com'` para esconder un
                                                        correo de relleno. Nada en el proyecto escribe nunca ese
                                                        correo y ningún pedido de la base lo tiene: era una guardia
                                                        contra un valor que no puede aparecer, y encima nombraba un
                                                        dominio que no existe. */}
                                                    {(contactCustomer?.email || (contactOrders.length > 0 && contactOrders[0].customer_email)) && (
                                                        <div className="chat-info-meta-row">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                                            <span>{contactCustomer?.email || contactOrders[0].customer_email}</span>
                                                        </div>
                                                    )}
                                                    {contactCustomer?.city && (
                                                        <div className="chat-info-meta-row">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                            <span>{contactCustomer.city}</span>
                                                        </div>
                                                    )}
                                                    <div className="chat-info-meta-row">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                        <span>Desde {resumenHilo?.desde ? fmtDateFull(resumenHilo.desde) : '—'}</span>
                                                    </div>
                                                </div>

                                                {/* ── Stats grid ── */}
                                                <div className="chat-info-stats">
                                                    {/* La misma cuenta que el dashboard, del mismo archivo.
                                                        Antes esta ficha contaba sólo 'pagado' y 'entregado' y
                                                        el dashboard contaba cuatro estados: el mismo cliente
                                                        daba números distintos según dónde se mirara. */}
                                                    <div className="chat-info-stat">
                                                        <span className="chat-info-stat-value">${contactOrders.reduce((s, o) => s + recibidoDe(o), 0).toLocaleString('es-CO')}</span>
                                                        <span className="chat-info-stat-label">Ha pagado</span>
                                                    </div>
                                                    <div className="chat-info-stat">
                                                        {/* Los vivos. Contar cancelados al lado de "$0 gastado"
                                                            daba fichas que se contradecían solas. */}
                                                        <span className="chat-info-stat-value">{contactOrders.filter(estaVivo).length}</span>
                                                        <span className="chat-info-stat-label">Pedidos</span>
                                                    </div>
                                                    <div className="chat-info-stat">
                                                        <span className="chat-info-stat-value">{resumenHilo?.mensajes ?? messages.length}</span>
                                                        <span className="chat-info-stat-label">Mensajes</span>
                                                    </div>
                                                    <div className="chat-info-stat">
                                                        <span className="chat-info-stat-value">{respondidoPorIA ?? '—'}</span>
                                                        <span className="chat-info-stat-label">Resp. por IA</span>
                                                    </div>
                                                </div>

                                                {/* ── Tags ── */}
                                                <div className="chat-info-section">
                                                    <div className="chat-info-section-head">
                                                        <h6>Etiquetas</h6>
                                                    </div>
                                                    <div className="chat-info-tags">
                                                        {(tagsMap[activeContact] || []).map(t => (
                                                            <span key={t.id} className="chat-tag-pill chat-tag-pill--removable" style={{ '--tag-color': t.color }}>
                                                                {t.tag_name}
                                                                <button className="chat-tag-remove" onClick={() => handleRemoveTag(activeContact, t.id)}>×</button>
                                                            </span>
                                                        ))}
                                                        <div className="chat-tag-picker">
                                                            {PRESET_TAGS.filter(pt => !(tagsMap[activeContact] || []).some(t => t.tag_name === pt.label)).map(pt => (
                                                                <button key={pt.label} className="chat-tag-add-btn" style={{ '--tag-color': pt.color }}
                                                                        onClick={() => handleAddTag(activeContact, pt.label, pt.color)}>
                                                                    + {pt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {contactCustomer && (
                                                    <>
                                                        {/* ── Notes ── */}
                                                        <div className="chat-info-section">
                                                            <div className="chat-info-section-head">
                                                                <h6>Notas</h6>
                                                                {!editingNotes && (
                                                                    <button className="chat-info-edit-btn" onClick={() => setEditingNotes(true)}>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {editingNotes ? (
                                                                <div className="chat-info-notes-edit">
                                                                    <textarea
                                                                        className="chat-info-notes-input"
                                                                        value={customerNotes}
                                                                        onChange={e => setCustomerNotes(e.target.value)}
                                                                        rows={3}
                                                                        autoFocus
                                                                    />
                                                                    <div className="chat-info-notes-actions">
                                                                        <button className="chat-info-btn" onClick={handleSaveNotes}>Guardar</button>
                                                                        <button className="chat-info-btn chat-info-btn--outline" onClick={() => setEditingNotes(false)}>Cancelar</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="chat-info-notes" onClick={() => setEditingNotes(true)}>
                                                                    {contactCustomer.notes || 'Click para agregar notas...'}
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
                                                    {contactOrders.length === 0 ? (
                                                        <div className="chat-info-empty">
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
                                                            <span>Sin pedidos aún</span>
                                                        </div>
                                                    ) : (
                                                        <div className="chat-info-orders">
                                                            {contactOrders.map(o => (
                                                                <div key={o.id} className="chat-info-order">
                                                                    <div className="chat-info-order-thumb">
                                                                        {imagenDePedido(o) ? <img src={imagenDePedido(o)} alt="" loading="lazy" /> : <span>✦</span>}
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
                                        </div>
                                    )}
                                </div>

                                {/* Send error banner */}
                                {sendError && (
                                    <div className="chat-send-error">
                                        <span>{sendError}</span>
                                        <button onClick={() => setSendError(null)}>&times;</button>
                                    </div>
                                )}

                                {/* Input area */}
                                <div className="chat-conv-input">
                                    <div className="chat-input-actions" style={{ position: 'relative' }}>
                                        <button
                                            className="chat-quick-trigger"
                                            onClick={() => { setShowQuickReplies(!showQuickReplies); setShowImagePicker(false); }}
                                            title="Respuestas rapidas"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                        </button>
                                        <button
                                            className="chat-image-trigger"
                                            onClick={() => { setShowImagePicker(!showImagePicker); setShowQuickReplies(false); setSelectedProduct(null); }}
                                            title="Enviar imagen de producto"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        </button>

                                        {/* Quick replies panel */}
                                        {showQuickReplies && (
                                            <div className="chat-quick-replies" ref={quickRepliesRef}>
                                                {quickReplies.map((qr, i) => (
                                                    <button key={i} className="chat-quick-reply-btn" onClick={() => {
                                                        const nombre = activeContactData?.customer_name || '';
                                                        setNewMessage(qr.text.replace(/\{\{nombre\}\}/gi, nombre));
                                                        setShowQuickReplies(false);
                                                    }}>
                                                        {qr.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Image picker panel */}
                                        {showImagePicker && (
                                            <div className="chat-image-picker" ref={imagePickerRef}>
                                                <div className="chat-image-picker-head">
                                                    <h4>{selectedProduct ? 'Enviar imagen' : 'Selecciona un producto'}</h4>
                                                    <button className="chat-image-picker-close" onClick={() => { setShowImagePicker(false); setSelectedProduct(null); }}>&times;</button>
                                                </div>
                                                {!selectedProduct ? (
                                                    <>
                                                        <div className="chat-image-search-wrap">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                                            <input
                                                                type="text"
                                                                className="chat-image-search"
                                                                placeholder="Buscar producto..."
                                                                value={productSearch}
                                                                onChange={e => setProductSearch(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="chat-image-grid">
                                                            {filteredProducts.slice(0, 12).map(p => (
                                                                <button key={p.id} className="chat-image-picker-item" onClick={() => { setSelectedProduct(p); setImageCaption(`${p.name} - $${Number(p.price).toLocaleString('es-CO')}`); }}>
                                                                    <div className="chat-image-picker-thumb">
                                                                        <img src={p.image_url} alt={p.name} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                                                        <div className="chat-image-picker-fallback" style={{display:'none'}}>
                                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                                        </div>
                                                                    </div>
                                                                    <div className="chat-image-picker-details">
                                                                        <span className="chat-image-picker-name">{p.name}</span>
                                                                        <span className="chat-image-picker-price">${Number(p.price).toLocaleString('es-CO')}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                            {filteredProducts.length === 0 && (
                                                                <div className="chat-image-empty">No se encontraron productos</div>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="chat-image-preview">
                                                        <div className="chat-image-preview-img-wrap">
                                                            <img src={selectedProduct.image_url} alt={selectedProduct.name} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                                            <div className="chat-image-preview-fallback" style={{display:'none'}}>
                                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                                <span>{selectedProduct.name}</span>
                                                            </div>
                                                        </div>
                                                        <div className="chat-image-preview-info">
                                                            <strong>{selectedProduct.name}</strong>
                                                            <span>${Number(selectedProduct.price).toLocaleString('es-CO')}</span>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="chat-image-caption"
                                                            value={imageCaption}
                                                            onChange={e => setImageCaption(e.target.value)}
                                                            placeholder="Escribe un mensaje para acompañar..."
                                                        />
                                                        <div className="chat-image-preview-actions">
                                                            <button className="chat-image-cancel-btn" onClick={() => setSelectedProduct(null)}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                                                Volver
                                                            </button>
                                                            <button className="chat-image-send-btn" onClick={() => handleSendImage(selectedProduct)} disabled={sendingImage}>
                                                                {sendingImage ? (
                                                                    <><div className="chat-send-spinner" /> Enviando...</>
                                                                ) : (
                                                                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <textarea
                                        className="chat-input-field"
                                        placeholder="Escribe un mensaje..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onFocus={() => setEscribiendo(true)}
                                        onBlur={() => setEscribiendo(false)}
                                        rows={1}
                                    />
                                    <button
                                        className="chat-send-btn"
                                        /* Sin esto el campo pierde el foco ANTES del clic: la barra
                                           de navegación reaparece, el layout se mueve y el toque
                                           puede caer en otro lado. */
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={handleSend}
                                        disabled={!newMessage.trim() || sending}
                                    >
                                        {sending ? (
                                            <div className="chat-send-spinner" />
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    {/* Archivar. Eliminar tiene su propio diálogo: archivar se
                        deshace solo en cuanto el cliente vuelva a escribir, y
                        eliminar no se deshace nunca. */}
                    {confirmArchive && (
                        <div className="chat-confirm-overlay" onClick={() => setConfirmArchive(null)}>
                            <div className="chat-confirm-modal" onClick={e => e.stopPropagation()}>
                                <h4>¿Archivar conversación?</h4>
                                <p>El contacto desaparecerá de la lista. Volverá automáticamente si envía un nuevo mensaje.</p>
                                <div className="chat-confirm-actions">
                                    <button className="chat-confirm-btn chat-confirm-btn--cancel" onClick={() => setConfirmArchive(null)}>Cancelar</button>
                                    <button className="chat-confirm-btn chat-confirm-btn--primary" onClick={() => handleArchive(confirmArchive)}>Archivar</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {aBorrar && (
                        <EliminarChat
                            objetivos={aBorrar}
                            onClose={() => setABorrar(null)}
                            onDeleted={alBorrarChat}
                        />
                    )}

                    {/* Sólo las fotos. Sin escribir nada: es permanente, pero no
                        se lleva la conversación. */}
                    {confirmFotos && (
                        <div className="chat-confirm-overlay" onClick={() => !borrandoFotos && setConfirmFotos(false)}>
                            <div className="chat-confirm-modal" onClick={e => e.stopPropagation()}>
                                <h4>{fotosDelHilo === 1 ? '¿Borrar la foto?' : `¿Borrar las ${fotosDelHilo} fotos?`}</h4>
                                <p>
                                    Se van los archivos y el hilo se queda entero: sigues viendo el
                                    pie que escribió y lo que Valentina entendió de cada imagen, con
                                    un sello de que la foto ya no está. No se puede deshacer.
                                </p>
                                <div className="chat-confirm-actions">
                                    <button className="chat-confirm-btn chat-confirm-btn--cancel" onClick={() => setConfirmFotos(false)} disabled={borrandoFotos}>Cancelar</button>
                                    <button className="chat-confirm-btn chat-confirm-btn--danger" onClick={handleBorrarFotos} disabled={borrandoFotos}>
                                        {borrandoFotos ? 'Borrando…' : 'Borrar las fotos'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Toast notifications */}
                    {toasts.length > 0 && (
                        <div className="chat-toast-container">
                            {toasts.map(t => (
                                <div key={t.id} className="chat-toast" onClick={() => { selectContact(t.phone); setToasts(prev => prev.filter(x => x.id !== t.id)); }}>
                                    <strong>{t.name}</strong>
                                    <span>{t.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>

        {/* Lightbox */}
        {lightboxImg && (
            <div className={`pg-lightbox ${lightboxClosing ? 'lb-closing' : ''}`} onClick={closeLightbox}>
                <button className="pg-lightbox-close" onClick={closeLightbox} aria-label="Cerrar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <img className="pg-lightbox-img" src={lightboxImg} alt="" onClick={e => e.stopPropagation()} />
            </div>
        )}
        </>
    );
};

const ChatPanelWithErrorBoundary = () => (
    <ChatErrorBoundary><ChatPanel /></ChatErrorBoundary>
);

export default ChatPanelWithErrorBoundary;
