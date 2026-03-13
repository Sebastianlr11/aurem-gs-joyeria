import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminSidebar from './AdminSidebar';
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
const fmtDateFull = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

const isSameDay = (a, b) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const truncate = (s, n = 50) => s && s.length > n ? s.slice(0, n) + '...' : s;

/* ─── Quick Replies ────────────────────────────────────────────── */
const QUICK_REPLIES_DEFAULT = [
    { label: '📦 En camino', text: 'Tu pedido esta en camino, pronto lo recibiras!' },
    { label: '📋 Catalogo', text: 'Visita nuestro catalogo completo en auremgs.com/catalogo' },
    { label: '🕐 Horario', text: 'Nuestro horario de atencion es de lunes a sabado, 9am a 6pm.' },
    { label: '💍 Talla', text: 'Para anillos necesitamos tu talla. Guia: auremgs.com/guia-de-tallas' },
    { label: '🙏 Gracias', text: 'Gracias por tu compra! Esperamos que disfrutes tu pieza.' },
    { label: '⏳ Entrega', text: 'El tiempo de entrega es de 2-3 dias habiles en Bogota, 3-5 en otras ciudades.' },
];

const parseQuickReplies = () => {
    const raw = localStorage.getItem('admin_quick_replies');
    if (!raw) return QUICK_REPLIES_DEFAULT;
    return raw.split('\n').filter(l => l.includes('|')).map(l => {
        const [label, ...rest] = l.split('|');
        return { label: label.trim(), text: rest.join('|').trim() };
    });
};

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
    const messagesEndRef = useRef(null);
    const activeContactRef = useRef(null);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [imageCaption, setImageCaption] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [sendingImage, setSendingImage] = useState(false);
    const [takeoverMap, setTakeoverMap] = useState({});
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [contactOrders, setContactOrders] = useState([]);
    const [contactCustomer, setContactCustomer] = useState(null);
    const [editingNotes, setEditingNotes] = useState(false);
    const [customerNotes, setCustomerNotes] = useState('');
    const quickReplies = useMemo(() => parseQuickReplies(), []);
    const quickRepliesRef = useRef(null);
    const imagePickerRef = useRef(null);
    const takeoverMapRef = useRef(takeoverMap);
    const navigate = useNavigate();

    /* ─── Auth ───────────────────────────────────────────────────── */
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) navigate('/admin/login'); else setSession(session);
        });
    }, [navigate]);

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

        // Fetch customer names
        const phones = [...contactMap.keys()];
        const { data: customers } = await supabase
            .from('customers')
            .select('phone, name');

        const customerMap = new Map();
        if (customers) {
            customers.forEach(c => {
                customerMap.set(normalizePhone(c.phone), c.name);
                customerMap.set(c.phone, c.name);
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

    /* ─── Load products for image picker ───────────────────────── */
    useEffect(() => {
        if (!session) return;
        supabase.from('products').select('id, name, image_url, price').then(({ data }) => {
            setProducts(data || []);
        });
    }, [session]);

    /* ─── Keep refs in sync ───────────────────────────────────── */
    useEffect(() => { takeoverMapRef.current = takeoverMap; }, [takeoverMap]);
    useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);

    /* ─── Load takeover status ─────────────────────────────────── */
    useEffect(() => {
        if (!session) return;
        const fetchTakeover = async () => {
            const { data } = await supabase.from('chat_takeover').select('phone_number, is_active, admin_email').eq('is_active', true);
            if (data) {
                const map = {};
                data.forEach(t => { map[t.phone_number] = t; });
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
    }, [session]);

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

    /* ─── Load messages for active contact ────────────────────────── */
    useEffect(() => {
        if (!activeContact) return;
        let cancelled = false;
        const load = async () => {
            setLoadingMsgs(true);
            const { data } = await supabase
                .from('whatsapp_conversaciones')
                .select('*')
                .eq('phone_number', activeContact)
                .order('created_at', { ascending: true })
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
        setShowContactInfo(false);
        return () => { cancelled = true; };
    }, [activeContact]);

    /* ─── Load contact info panel ──────────────────────────────── */
    useEffect(() => {
        if (!activeContact || !showContactInfo) return;
        // Customer data
        supabase.from('customers').select('*').eq('phone', activeContact).maybeSingle()
            .then(({ data }) => {
                setContactCustomer(data);
                setCustomerNotes(data?.notes || '');
            });
        // Orders
        supabase.from('orders').select('*').eq('customer_phone', activeContact).order('created_at', { ascending: false }).limit(10)
            .then(({ data }) => setContactOrders(data || []));
    }, [activeContact, showContactInfo]);

    /* ─── Scroll to bottom on new messages ────────────────────────── */
    const prevMsgCountRef = useRef(0);
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        }
        prevMsgCountRef.current = messages.length;
    }, [messages.length]);

    /* ─── Polling for new messages (replaces Realtime) ─────────────── */
    useEffect(() => {
        if (!session) return;
        let cancelled = false;
        let lastContactPoll = 0;
        const CONTACT_INTERVAL = 5000;
        const MSG_INTERVAL = 2500;

        const poll = async () => {
            if (cancelled) return;
            try {
                const now = Date.now();

                // Poll contacts periodically
                if (now - lastContactPoll >= CONTACT_INTERVAL) {
                    lastContactPoll = now;
                    fetchContacts(true);
                }

                // Poll messages for active contact
                const phone = activeContactRef.current;
                if (phone) {
                    const { data: rawData } = await supabase
                        .from('whatsapp_conversaciones')
                        .select('*')
                        .eq('phone_number', phone)
                        .order('created_at', { ascending: true })
                        .limit(200);
                    const data = rawData ? sortMessages(rawData) : null;

                    if (data && !cancelled && activeContactRef.current === phone) {
                        setMessages(prev => {
                            if (prev.length === data.length && prev[prev.length - 1]?.id === data[data.length - 1]?.id) {
                                return prev;
                            }
                            if (data.length > prev.length) {
                                const newest = data[data.length - 1];
                                if (newest?.role === 'user' && localStorage.getItem('admin_sound_enabled') !== 'false') {
                                    try { new Audio('/assets/notificacion.mp3').play().catch(() => {}); } catch (e) {}
                                }
                            }
                            return data;
                        });
                    }
                }
            } catch (e) {
                console.warn('Poll error:', e);
            }
            if (!cancelled) {
                setTimeout(poll, MSG_INTERVAL);
            }
        };

        // Start immediately
        poll();

        return () => { cancelled = true; };
    }, [session, fetchContacts]);

    /* ─── Send manual message ─────────────────────────────────────── */
    const handleSend = async () => {
        if (!newMessage.trim() || !activeContact || sending) return;
        setSending(true);
        const msg = newMessage.trim();

        const webhookUrl = localStorage.getItem('admin_chat_webhook_url');
        if (!webhookUrl) {
            alert('Configura la URL del webhook de respuesta manual en Ajustes (admin_chat_webhook_url)');
            setSending(false);
            return;
        }

        try {
            // 1. Fire-and-forget to n8n (sends WhatsApp via Meta API)
            fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ phone: activeContact, message: msg }),
            }).catch(() => {});

            // 2. Save to Supabase (Realtime will add it to messages)
            const { error } = await supabase.from('whatsapp_conversaciones').insert({
                phone_number: activeContact,
                role: 'assistant',
                content: msg,
            }).select();

            if (error) {
                console.error('Error guardando mensaje:', error);
                alert('Error al guardar mensaje en base de datos.');
            } else {
                setNewMessage('');
            }
        } catch (e) {
            console.error('Error enviando mensaje:', e);
            alert('Error de conexion al enviar mensaje.');
        }
        setSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    /* ─── Send image ────────────────────────────────────────────── */
    const handleSendImage = async (product) => {
        if (!activeContact || sendingImage) return;
        setSendingImage(true);
        const caption = imageCaption.trim() || `${product.name} - $${Number(product.price).toLocaleString('es-CO')}`;
        const webhookUrl = localStorage.getItem('admin_chat_webhook_url');

        if (webhookUrl) {
            fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ phone: activeContact, image_url: product.image_url, caption }),
            }).catch(() => {});
        }

        await supabase.from('whatsapp_conversaciones').insert({
            phone_number: activeContact,
            role: 'assistant',
            content: caption,
            message_type: 'image',
            media_url: product.image_url,
        });

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
                .insert({ phone_number: activeContact, admin_email: session?.user?.email, is_active: true });
        }
    };

    /* ─── Save customer notes ───────────────────────────────────── */
    const handleSaveNotes = async () => {
        if (!contactCustomer) return;
        await supabase.from('customers').update({ notes: customerNotes }).eq('id', contactCustomer.id);
        setContactCustomer(prev => ({ ...prev, notes: customerNotes }));
        setEditingNotes(false);
    };

    /* ─── Export conversation ───────────────────────────────────── */
    const handleExportChat = () => {
        if (!messages.length) return;
        const lines = messages.map(m => {
            const time = new Date(m.created_at).toLocaleString('es-CO');
            const sender = m.role === 'user' ? 'Cliente' : 'Valentina';
            return `[${time}] ${sender}: ${m.content}`;
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${activeContact}_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ─── Sidebar nav ─────────────────────────────────────────────── */
    const handleNavClick = (id) => {
        navigate('/admin');
    };

    /* ─── Filter contacts ─────────────────────────────────────────── */
    const filteredContacts = contacts.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (c.customer_name && c.customer_name.toLowerCase().includes(q))
            || c.phone_number.includes(q)
            || (c.last_message && c.last_message.toLowerCase().includes(q));
    });

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
    const totalUnread = contacts.reduce((s, c) => s + (c.unread || 0), 0);

    return (
        <div className="admin-layout">
            <AdminSidebar session={session} activeId="chat" onNavClick={handleNavClick} />

            <main className="admin-content">
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        <span className="admin-topbar-icon">{NAV.find(n => n.id === 'chat')?.icon}</span>
                        <h2 className="admin-topbar-title">
                            <span>Conversaciones</span>
                            {totalUnread > 0 ? <span className="chat-nav-badge">{totalUnread}</span> : null}
                        </h2>
                    </div>
                    <div className="admin-topbar-right">
                        <div className="admin-topbar-avatar">{session.user.email[0].toUpperCase()}</div>
                    </div>
                </header>

                <div className="chat-panel">
                    {/* Contact list */}
                    <div className={`chat-contacts ${mobileShowChat ? 'chat-contacts--hidden-mobile' : ''}`}>
                        <div className="chat-contacts-header">
                            <input
                                type="text"
                                className="chat-search"
                                placeholder="Buscar conversacion..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="chat-contacts-list">
                            {loading ? (
                                <div className="chat-loading">Cargando conversaciones...</div>
                            ) : filteredContacts.length === 0 ? (
                                <div className="chat-loading">No hay conversaciones</div>
                            ) : (
                                filteredContacts.map(c => (
                                    <button
                                        key={c.phone_number}
                                        className={`chat-contact-item ${activeContact === c.phone_number ? 'chat-contact-item--active' : ''}`}
                                        onClick={() => selectContact(c.phone_number)}
                                    >
                                        <div className="chat-contact-avatar">
                                            {c.customer_name ? c.customer_name[0].toUpperCase() : '#'}
                                            {takeoverMap[c.phone_number] && <span className="chat-contact-takeover-dot" />}
                                        </div>
                                        <div className="chat-contact-info">
                                            <div className="chat-contact-top">
                                                <span className="chat-contact-name">
                                                    {c.customer_name || c.phone_number}
                                                </span>
                                                <span className="chat-contact-time">{fmtDate(c.last_time)}</span>
                                            </div>
                                            <div className="chat-contact-preview">
                                                <span>{c.last_role === 'assistant' ? 'Valentina: ' : ''}</span>
                                                <span>{truncate(c.last_message, 45)}</span>
                                            </div>
                                        </div>
                                        {(c.unread || 0) > 0 && (
                                            <span className="chat-unread-badge">{c.unread}</span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat conversation */}
                    <div className={`chat-conversation ${!mobileShowChat ? 'chat-conversation--hidden-mobile' : ''}`}>
                        {!activeContact ? (
                            <div className="chat-empty-state">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                <p>Selecciona una conversacion para verla</p>
                            </div>
                        ) : (
                            <>
                                {/* Chat header */}
                                <div className="chat-conv-header">
                                    <button className="chat-back-btn" onClick={() => setMobileShowChat(false)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    </button>
                                    <div className="chat-conv-header-avatar">
                                        {activeContactData?.customer_name ? activeContactData.customer_name[0].toUpperCase() : '#'}
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
                                        <button
                                            className={`chat-takeover-btn ${isTakeover ? 'chat-takeover-btn--active' : ''}`}
                                            onClick={handleToggleTakeover}
                                            title={isTakeover ? 'Devolver al agente' : 'Tomar control'}
                                        >
                                            {isTakeover ? '🤖' : '🙋'}
                                        </button>
                                        <button className="chat-header-action-btn" onClick={handleExportChat} title="Exportar chat">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        </button>
                                        <button
                                            className={`chat-header-action-btn ${showContactInfo ? 'chat-header-action-btn--active' : ''}`}
                                            onClick={() => setShowContactInfo(!showContactInfo)}
                                            title="Info del contacto"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="chat-conv-body">
                                    {/* Messages */}
                                    <div className="chat-conv-messages">
                                        {loadingMsgs ? (
                                            <div className="chat-loading">Cargando mensajes...</div>
                                        ) : (
                                            messages.map((msg, i) => {
                                                const showDate = i === 0 || !isSameDay(messages[i - 1]?.created_at, msg.created_at);
                                                return (
                                                    <React.Fragment key={msg.id || `msg-${i}`}>
                                                        {showDate ? (
                                                            <div className="chat-date-separator">
                                                                <span>{fmtDateFull(msg.created_at)}</span>
                                                            </div>
                                                        ) : null}
                                                        <div className={`chat-bubble chat-bubble--${msg.role || 'user'}`}>
                                                            {msg.message_type === 'image' && msg.media_url ? (
                                                                <img src={msg.media_url} alt="" className="chat-bubble-image" />
                                                            ) : null}
                                                            <div className="chat-bubble-content"><span>{msg.content || ''}</span></div>
                                                            <div className="chat-bubble-time"><span>{fmtTime(msg.created_at)}</span></div>
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
                                                <h4>Info del contacto</h4>
                                                <button className="chat-info-close" onClick={() => setShowContactInfo(false)}>&times;</button>
                                            </div>
                                            <div className="chat-info-panel-body">
                                                {contactCustomer ? (
                                                    <>
                                                        <div className="chat-info-section">
                                                            <div className="chat-info-avatar">
                                                                {contactCustomer.name ? contactCustomer.name[0].toUpperCase() : '#'}
                                                            </div>
                                                            <h5>{contactCustomer.name || 'Sin nombre'}</h5>
                                                            <p className="chat-info-phone">{activeContact}</p>
                                                            {contactCustomer.email && <p className="chat-info-email">{contactCustomer.email}</p>}
                                                        </div>
                                                        <div className="chat-info-section">
                                                            <h6>Notas</h6>
                                                            {editingNotes ? (
                                                                <div>
                                                                    <textarea
                                                                        className="chat-info-notes-input"
                                                                        value={customerNotes}
                                                                        onChange={e => setCustomerNotes(e.target.value)}
                                                                        rows={3}
                                                                    />
                                                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
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
                                                        <div className="chat-info-section">
                                                            <h6>Pedidos recientes</h6>
                                                            {contactOrders.length === 0 ? (
                                                                <p className="chat-info-empty">Sin pedidos</p>
                                                            ) : (
                                                                contactOrders.map(o => (
                                                                    <div key={o.id} className="chat-info-order">
                                                                        <span className="chat-info-order-name">{o.product_name}</span>
                                                                        <span className="chat-info-order-amount">${Number(o.amount).toLocaleString('es-CO')}</span>
                                                                        <span className={`chat-info-order-status chat-info-order-status--${o.status}`}>{o.status}</span>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                        <div className="chat-info-section">
                                                            <h6>Estado</h6>
                                                            <span className={`chat-mode-badge ${isTakeover ? 'chat-mode-badge--manual' : 'chat-mode-badge--ai'}`}>
                                                                {isTakeover ? 'Control manual' : 'Agente IA'}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="chat-info-section">
                                                        <p className="chat-info-empty">Cliente no registrado</p>
                                                        <p className="chat-info-phone">{activeContact}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

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
                                                    <button key={i} className="chat-quick-reply-btn" onClick={() => { setNewMessage(qr.text); setShowQuickReplies(false); }}>
                                                        {qr.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Image picker panel */}
                                        {showImagePicker && (
                                            <div className="chat-image-picker" ref={imagePickerRef}>
                                                {!selectedProduct ? (
                                                    <>
                                                        <input
                                                            type="text"
                                                            className="chat-image-search"
                                                            placeholder="Buscar producto..."
                                                            value={productSearch}
                                                            onChange={e => setProductSearch(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="chat-image-grid">
                                                            {filteredProducts.slice(0, 12).map(p => (
                                                                <button key={p.id} className="chat-image-picker-item" onClick={() => { setSelectedProduct(p); setImageCaption(`${p.name} - $${Number(p.price).toLocaleString('es-CO')}`); }}>
                                                                    <img src={p.image_url} alt={p.name} />
                                                                    <span className="chat-image-picker-name">{p.name}</span>
                                                                    <span className="chat-image-picker-price">${Number(p.price).toLocaleString('es-CO')}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="chat-image-preview">
                                                        <img src={selectedProduct.image_url} alt={selectedProduct.name} />
                                                        <input
                                                            type="text"
                                                            className="chat-image-caption"
                                                            value={imageCaption}
                                                            onChange={e => setImageCaption(e.target.value)}
                                                            placeholder="Caption..."
                                                        />
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button className="chat-image-send-btn" onClick={() => handleSendImage(selectedProduct)} disabled={sendingImage}>
                                                                {sendingImage ? 'Enviando...' : 'Enviar imagen'}
                                                            </button>
                                                            <button className="chat-image-cancel-btn" onClick={() => setSelectedProduct(null)}>Cancelar</button>
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
                                        rows={1}
                                    />
                                    <button
                                        className="chat-send-btn"
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
                </div>
            </main>
        </div>
    );
};

const ChatPanelWithErrorBoundary = () => (
    <ChatErrorBoundary><ChatPanel /></ChatErrorBoundary>
);

export default ChatPanelWithErrorBoundary;
