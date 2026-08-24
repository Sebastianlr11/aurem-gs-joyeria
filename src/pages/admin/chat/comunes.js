/**
 * Lo que el panel de conversaciones usa por todas partes: los formatos de
 * fecha y hora, cómo se lee cada estado y cada acuse, y el orden del hilo.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026, junto con `piezas.jsx`.
 * Ese archivo tenía 2.123 líneas y era, casi entero, UN SOLO componente de
 * 1.926 con 55 estados. No se parece a `Dashboard.jsx`, que se pudo partir en
 * siete secciones porque ya eran independientes: aquí hay que ir por pasos, y
 * el primero es sacar lo que no depende de nada, que es esto.
 *
 * Va aparte de `piezas.jsx` por la misma razón de herramienta que en
 * `secciones/`: `react-refresh/only-export-components` prohíbe que un archivo
 * exporte componentes y constantes a la vez.
 */

export const normalizePhone = (p) => {
    if (!p) return '';
    const digits = p.replace(/\D/g, '');
    if (digits.length === 10) return '57' + digits;
    return digits;
};

export const fmtTime = (d) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
/* Iniciales del nombre, hasta dos, como en el retrato del diseño. */
export const iniciales = (nombre) => {
    if (!nombre) return '#';
    const partes = String(nombre).trim().split(/\s+/).filter(Boolean);
    return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
};
/* Cómo se lee cada estado en la ficha, en vez del valor crudo. */
export const STATUS_PEDIDO = {
    pendiente: 'Pago pendiente', pagado: 'Pagado', procesando: 'Procesando',
    enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
};
/* Qué significa cada acuse al pasar el cursor. */
export const ACUSE = {
    sending: 'Enviando…',
    sent: 'Enviado a WhatsApp',
    delivered: 'Entregado en el teléfono',
    read: 'Leído por el cliente',
    failed: 'No se pudo enviar',
};
/* El separador del hilo: "Hoy", "Ayer", el día de la semana si es de
   este año, y la fecha completa si es más viejo. */
export const fmtSeparador = (d) => {
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
export const fmtDateFull = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
export const isSameDay = (a, b) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

/* Cuánto silencio antes de que una conversación sea candidata a purga. Un año
   deja pasar la temporada entera de regalos —diciembre, San Valentín, día de la
   madre— antes de dar a alguien por perdido. Es también el valor por defecto de
   `conversaciones_purgables` en la base; se pasa explícito para que cambiarlo
   sea esta línea y no una migración. */
export const MESES_PURGA = 12;

export const truncate = (s, n = 50) => s && s.length > n ? s.slice(0, n) + '...' : s;

/* ─── Sort helper: user before assistant when same timestamp ─── */
export const sortMessages = (msgs) => {
    if (!msgs) return [];
    return [...msgs].sort((a, b) => {
        const t = new Date(a.created_at) - new Date(b.created_at);
        if (t !== 0) return t;
        if (a.role === 'user' && b.role === 'assistant') return -1;
        if (a.role === 'assistant' && b.role === 'user') return 1;
        return 0;
    });
};

/* Una etiqueta es un nombre, no un estado: la palabra ya distingue una
   de otra y no hace falta un color por cada una. Eran cinco matices de
   otra paleta —azul, verde, ámbar, oro brillante, morado— y en la
   marca sólo hay un oro. El chip ya se pintaba así; lo único que
   quedaba de colores era el botón de añadir. */
export const PRESET_TAGS = [
    { label: 'Interesado', color: '#A8863F' },
    { label: 'Cliente', color: '#A8863F' },
    { label: 'Seguimiento', color: '#A8863F' },
    { label: 'VIP', color: '#A8863F' },
    { label: 'Mayorista', color: '#A8863F' },
];

/**
 * El acuse de un mensaje nuestro, y el visto que lo dibuja.
 *
 * Un mensaje que acaba de salir todavía no tiene `delivery_status`: vive como
 * `temp-…` hasta que WhatsApp confirma. Sin este apaño se quedaría en «✓
 * enviado» desde el primer fotograma, diciendo que llegó algo que aún no ha
 * salido.
 *
 * Los tres glifos son los de WhatsApp a propósito: un punto mientras sale, un
 * visto cuando salió, dos cuando llegó o se leyó. Quien atiende el chat ya sabe
 * leerlos sin que nadie se lo explique — y el color no los distingue, sólo el
 * oro del leído, que es la única diferencia que importa de un vistazo.
 */
export const acuseDe = (mensaje) =>
    mensaje?.delivery_status || (String(mensaje?.id).startsWith('temp-') ? 'sending' : 'sent')

export const glifoDeAcuse = (acuse) =>
    acuse === 'sending' ? '·' : (acuse === 'read' || acuse === 'delivered') ? '✓✓' : '✓'
