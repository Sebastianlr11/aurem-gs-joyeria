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
    const [webhookMissing, setWebhookMissing] = useState(false);
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
    const exportMenuRef = useRef(null);
    const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('admin_sound_enabled') !== 'false');
    const quickReplies = useMemo(() => parseQuickReplies(), []);
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
                                    icon: '/assets/hero1.png',
                                });
                            } catch (e) {}
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
    }, [session]);

    /* ─── Load messages for active contact ────────────────────────── */
    useEffect(() => {
        if (!activeContact) return;
        let cancelled = false;
        const load = async () => {
            setLoadingMsgs(true);
            const { data } = await supabase
                .from('whatsapp_conversaciones')
                .select('id, phone_number, content, role, created_at, is_read, message_type, media_url')
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
                                icon: '/assets/hero1.png',
                            });
                        } catch (e) {}
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

    /* ─── Webhook URLs ─────────────────────────────────────────────── */
    const MANUAL_WEBHOOK = 'http://localhost:5678/webhook/respuesta-manual-admin';

    /* ─── Send manual message (optimistic UI) ────────────────────── */
    const handleSend = async () => {
        if (!newMessage.trim() || !activeContact || sending) return;
        setSending(true);
        setSendError(null);
        const msg = newMessage.trim();
        const tempId = `temp-${Date.now()}`;
        const isManual = !!takeoverMapRef.current[activeContact];

        // Para modo normal, necesita webhook configurado
        if (!isManual) {
            const webhookUrl = localStorage.getItem('admin_chat_webhook_url');
            if (!webhookUrl) {
                setWebhookMissing(true);
                setSending(false);
                return;
            }
        }

        // Optimistic: show message immediately and clear input
        const optimisticMsg = {
            id: tempId,
            phone_number: activeContact,
            role: 'assistant',
            content: msg,
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');

        try {
            // 1. Enviar via webhook correspondiente
            const webhookUrl = isManual
                ? MANUAL_WEBHOOK
                : localStorage.getItem('admin_chat_webhook_url');

            if (webhookUrl) {
                const body = isManual
                    ? { phone_number: activeContact, message: msg }
                    : { phone: activeContact, message: msg };
                fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(body),
                }).catch(() => {});
            }

            // 2. Save to Supabase (solo si NO es manual — el workflow ya guarda)
            if (!isManual) {
                const { data, error } = await supabase.from('whatsapp_conversaciones').insert({
                    phone_number: activeContact,
                    role: 'assistant',
                    content: msg,
                }).select().single();

                if (error) {
                    console.error('Error guardando mensaje:', error);
                    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _failed: true } : m));
                    setSendError('Error al guardar mensaje en base de datos.');
                } else if (data) {
                    setMessages(prev => {
                        const hasReal = prev.some(m => m.id === data.id);
                        if (hasReal) return prev.filter(m => m.id !== tempId);
                        return prev.map(m => m.id === tempId ? data : m);
                    });
                }
            }
        } catch (e) {
            console.error('Error enviando mensaje:', e);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _failed: true } : m));
            setSendError('Error de conexion al enviar mensaje.');
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
        const isManual = !!takeoverMapRef.current[activeContact];
        const webhookUrl = isManual
            ? MANUAL_WEBHOOK
            : localStorage.getItem('admin_chat_webhook_url');

        if (webhookUrl) {
            const body = isManual
                ? { phone_number: activeContact, image_url: product.image_url, caption }
                : { phone: activeContact, image_url: product.image_url, caption };
            fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(body),
            }).catch(() => {});
        }

        // Solo guardar desde frontend si NO es manual (el workflow ya guarda)
        if (!isManual) {
            await supabase.from('whatsapp_conversaciones').insert({
                phone_number: activeContact,
                role: 'assistant',
                content: caption,
                message_type: 'image',
                media_url: product.image_url,
            });
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

    /* ─── Export CSV ──────────────────────────────────────────────── */
    const handleExportCSV = () => {
        if (!messages.length) return;
        const header = 'Fecha,Hora,Remitente,Mensaje';
        const rows = messages.map(m => {
            const d = new Date(m.created_at);
            const date = d.toLocaleDateString('es-CO');
            const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
            const sender = m.role === 'user' ? 'Cliente' : 'Valentina';
            const content = `"${(m.content || '').replace(/"/g, '""')}"`;
            return `${date},${time},${sender},${content}`;
        });
        const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${activeContact}_${new Date().toISOString().slice(0,10)}.csv`;
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
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setShowExportMenu(false);
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
    }, [showContactInfo, showQuickReplies, showImagePicker, activeContact, showMsgSearch, showExportMenu]);

    /* ─── Sidebar nav ─────────────────────────────────────────────── */
    const handleNavClick = (id) => {
        navigate('/admin');
    };

    /* ─── Filter & sort contacts (takeover first) ───────────────── */
    const filteredContacts = useMemo(() => {
        const filtered = contacts.filter(c => {
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
        }
        // Takeover contacts always appear first
        return result.sort((a, b) => {
            const aTakeover = takeoverMap[a.phone_number] ? 1 : 0;
            const bTakeover = takeoverMap[b.phone_number] ? 1 : 0;
            if (aTakeover !== bTakeover) return bTakeover - aTakeover;
            return new Date(b.last_time) - new Date(a.last_time);
        });
    }, [contacts, searchQuery, takeoverMap, contactFilter, pendingPhones]);

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
        <div className="admin-layout">
            <AdminSidebar session={session} activeId="chat" onNavClick={handleNavClick} />

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
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="chat-search"
                                placeholder="Buscar conversacion... (Ctrl+K)"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <div className="chat-filter-chips">
                                {['todos', 'hoy', 'takeover', 'pendiente'].map(f => (
                                    <button key={f} className={`chat-filter-chip${contactFilter === f ? ' chat-filter-chip--active' : ''}`}
                                            onClick={() => setContactFilter(f)}>
                                        {f === 'todos' ? 'Todos' : f === 'hoy' ? 'Hoy' : f === 'takeover' ? 'Manual' : 'Pendiente'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="chat-contacts-list">
                            {loading ? (
                                <div className="chat-loading">Cargando conversaciones...</div>
                            ) : filteredContacts.length === 0 ? (
                                <div className="chat-loading">No hay conversaciones</div>
                            ) : (
                                filteredContacts.map(c => {
                                    const cTakeover = !!takeoverMap[c.phone_number];
                                    return (
                                    <button
                                        key={c.phone_number}
                                        className={`chat-contact-item ${activeContact === c.phone_number ? 'chat-contact-item--active' : ''} ${cTakeover ? 'chat-contact-item--takeover' : ''}`}
                                        onClick={() => selectContact(c.phone_number)}
                                    >
                                        <div className="chat-contact-avatar">
                                            {c.customer_name ? c.customer_name[0].toUpperCase() : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            )}
                                            {cTakeover && <span className="chat-contact-takeover-dot" />}
                                        </div>
                                        <div className="chat-contact-info">
                                            <div className="chat-contact-top">
                                                <span className="chat-contact-name">
                                                    {c.customer_name || c.phone_number}
                                                </span>
                                                {cTakeover && <span className="chat-takeover-badge">MANUAL</span>}
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
                                    );
                                })
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
                                        <button className={`chat-header-action-btn ${showMsgSearch ? 'chat-header-action-btn--active' : ''}`}
                                                onClick={() => setShowMsgSearch(!showMsgSearch)} title="Buscar en mensajes">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                        </button>
                                        <button
                                            className={`chat-takeover-btn ${isTakeover ? 'chat-takeover-btn--active' : ''}`}
                                            onClick={handleToggleTakeover}
                                            title={isTakeover ? 'Devolver al agente IA' : 'Tomar control manual'}
                                        >
                                            {isTakeover ? (
                                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z"/><path d="M4.93 13.5a8 8 0 0014.14 0"/><path d="M12 18v4"/></svg> Devolver a IA</>
                                            ) : (
                                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Tomar control</>
                                            )}
                                        </button>
                                        <div className="chat-export-dropdown" ref={exportMenuRef} style={{position:'relative'}}>
                                            <button className="chat-header-action-btn" onClick={() => setShowExportMenu(!showExportMenu)} title="Exportar chat">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            </button>
                                            {showExportMenu && (
                                                <div className="chat-export-menu">
                                                    <button onClick={() => { handleExportChat(); setShowExportMenu(false); }}>Exportar TXT</button>
                                                    <button onClick={() => { handleExportCSV(); setShowExportMenu(false); }}>Exportar CSV</button>
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
                                                return (
                                                    <React.Fragment key={msg.id || `msg-${i}`}>
                                                        {showDate ? (
                                                            <div className="chat-date-separator">
                                                                <span>{fmtDateFull(msg.created_at)}</span>
                                                            </div>
                                                        ) : null}
                                                        <div className={`chat-bubble chat-bubble--${msg.role || 'user'}${msg._failed ? ' chat-bubble--error' : ''}`}>
                                                            {msg.message_type === 'image' && msg.media_url ? (
                                                                <img src={msg.media_url} alt="" className="chat-bubble-image" />
                                                            ) : null}
                                                            <div className="chat-bubble-content"><span>{msg.content || ''}</span></div>
                                                            <div className="chat-bubble-time">
                                                                {msg._failed ? <span style={{ color: '#ef4444' }}>Error al enviar</span> : <span>{fmtTime(msg.created_at)}</span>}
                                                            </div>
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
                                                            {contactCustomer.city && <p className="chat-info-detail">Ciudad: {contactCustomer.city}</p>}
                                                            <p className="chat-info-detail">Total gastado: ${contactOrders.filter(o => o.status === 'pagado' || o.status === 'entregado').reduce((s, o) => s + Number(o.amount || 0), 0).toLocaleString('es-CO')}</p>
                                                            {messages.length > 0 && <p className="chat-info-detail">Primer mensaje: {fmtDateFull(messages[0]?.created_at)}</p>}
                                                            <p className="chat-info-detail">Mensajes: {messages.length}</p>
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
                                                        <div className="chat-info-avatar">
                                                            {contactOrders.length > 0 && contactOrders[0].customer_name ? contactOrders[0].customer_name[0].toUpperCase() : '#'}
                                                        </div>
                                                        <h5>{contactOrders.length > 0 && contactOrders[0].customer_name ? contactOrders[0].customer_name : 'Cliente no registrado'}</h5>
                                                        <p className="chat-info-phone">{activeContact}</p>
                                                        {contactOrders.length > 0 && contactOrders[0].customer_email && contactOrders[0].customer_email !== 'noreply@auremgs.com' && (
                                                            <p className="chat-info-email">{contactOrders[0].customer_email}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Webhook missing banner */}
                                {webhookMissing && (
                                    <div className="chat-webhook-banner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        <span>Configura el webhook en <strong>Ajustes</strong> para enviar mensajes por WhatsApp.</span>
                                        <button className="chat-webhook-banner-close" onClick={() => setWebhookMissing(false)}>&times;</button>
                                    </div>
                                )}

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
                                                    <button key={i} className="chat-quick-reply-btn" onClick={() => { setNewMessage(qr.text); setShowQuickReplies(false); }}>
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
    );
};

const ChatPanelWithErrorBoundary = () => (
    <ChatErrorBoundary><ChatPanel /></ChatErrorBoundary>
);

export default ChatPanelWithErrorBoundary;
