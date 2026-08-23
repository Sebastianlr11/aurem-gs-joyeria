/**
 * Las tres piezas del chat que no dependen del estado del panel: el pie de una
 * foto, la imagen de una burbuja y la red de seguridad si algo revienta.
 *
 * Salieron de `ChatPanel.jsx` el 23 de agosto de 2026. Son las únicas tres
 * cosas de ese archivo que ya estaban sueltas: reciben lo suyo por props y no
 * tocan ninguno de los 55 estados del componente grande.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

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
export function PieDeFoto({ contenido }) {
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
export function ImagenDelChat({ ruta, onAbrir }) {
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

/* ─── Error Boundary ───────────────────────────────────────────── */
export class ChatErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(err, info) { console.error('ChatPanel crash:', err, info); }
    render() {
        if (this.state.error) {
            return React.createElement('div', { style: { padding: 40, textAlign: 'center' } },
                React.createElement('h3', null, 'Error en el panel de chat'),
                React.createElement('p', { style: { color: 'var(--error-ink)', fontFamily: 'monospace', fontSize: '0.85rem' } }, String(this.state.error)),
                React.createElement('button', { onClick: () => this.setState({ error: null }), style: { marginTop: 16, padding: '8px 16px', cursor: 'pointer' } }, 'Reintentar')
            );
        }
        return this.props.children;
    }
}

/**
 * La foto de un chat a pantalla completa.
 *
 * El estado y el cierre en dos tiempos viven en `useVisorDeFotos`; esto sólo
 * pinta. El clic en la imagen no se propaga a propósito: el fondo cierra, y
 * sin eso pulsar la propia foto la cerraría.
 */
export function VisorDeFoto({ foto, cerrando, cerrar }) {
    if (!foto) return null;
    return (
        <div className={`pg-lightbox ${cerrando ? 'lb-closing' : ''}`} onClick={cerrar}>
            <button className="pg-lightbox-close" onClick={cerrar} aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <img className="pg-lightbox-img" src={foto} alt="" onClick={e => e.stopPropagation()} />
        </div>
    );
}

/**
 * La pila de avisos de mensaje nuevo. Tocar uno abre esa conversación y se
 * lleva el aviso: ya cumplió.
 */
export function AvisosDeChat({ avisos, onElegir, onDescartar }) {
    if (!avisos.length) return null;
    return (
        <div className="chat-toast-container">
            {avisos.map(a => (
                <div key={a.id} className="chat-toast"
                     onClick={() => { onElegir(a.telefono); onDescartar(a.id); }}>
                    <strong>{a.nombre}</strong>
                    <span>{a.texto}</span>
                </div>
            ))}
        </div>
    );
}
