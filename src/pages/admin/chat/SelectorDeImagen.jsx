/**
 * Mandarle a la clienta la foto de una pieza del catálogo.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026, con cuatro de sus estados
 * y el envío. Se abre en dos pasos —elegir la pieza, luego repasar el pie y
 * enviar— y el segundo importa: lo que se manda es una foto A UNA CLIENTA por
 * WhatsApp, y eso no tiene deshacer.
 *
 * El pie se rellena solo con el nombre y el precio, que es lo que se manda el
 * 90 % de las veces, pero se puede reescribir antes de enviar.
 *
 * El estado vive aquí y muere aquí: el componente se monta y se desmonta con
 * `showImagePicker`, así que volver a abrirlo empieza limpio sin que nadie
 * tenga que acordarse de limpiarlo.
 */
import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function SelectorDeImagen({ piezas, telefono, contenedor, onCerrar, onError }) {
    const [busqueda, setBusqueda] = useState('');
    const [pie, setPie] = useState('');
    const [elegida, setElegida] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const visibles = piezas.filter(p =>
        !busqueda || p.name.toLowerCase().includes(busqueda.toLowerCase()));

    const enviar = async (pieza) => {
        if (!telefono || enviando) return;
        setEnviando(true);
        const texto = pie.trim() || `${pieza.name} - $${Number(pieza.price).toLocaleString('es-CO')}`;

        try {
            const { data, error } = await supabase.functions.invoke('wa-send', {
                body: { telefono, texto, imagenUrl: pieza.image_url },
            });
            if (error || data?.error) throw new Error(data?.error || error.message);
        } catch (e) {
            console.error('No se pudo enviar la imagen:', e);
            onError(e.message || 'No se pudo enviar la imagen.');
        }

        setEnviando(false);
        onCerrar();
    };

    return (
                <div className="chat-image-picker" ref={contenedor}>
                    <div className="chat-image-picker-head">
                        <h4>{elegida ? 'Enviar imagen' : 'Selecciona un producto'}</h4>
                        <button className="chat-image-picker-close" onClick={() => { onCerrar(); }}>&times;</button>
                    </div>
                    {!elegida ? (
                        <>
                            <div className="chat-image-search-wrap">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input
                                    type="text"
                                    className="chat-image-search"
                                    placeholder="Buscar producto..."
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="chat-image-grid">
                                {visibles.slice(0, 12).map(p => (
                                    <button key={p.id} className="chat-image-picker-item" onClick={() => { setElegida(p); setPie(`${p.name} - $${Number(p.price).toLocaleString('es-CO')}`); }}>
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
                                {visibles.length === 0 && (
                                    <div className="chat-image-empty">No se encontraron productos</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="chat-image-preview">
                            <div className="chat-image-preview-img-wrap">
                                <img src={elegida.image_url} alt={elegida.name} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                <div className="chat-image-preview-fallback" style={{display:'none'}}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    <span>{elegida.name}</span>
                                </div>
                            </div>
                            <div className="chat-image-preview-info">
                                <strong>{elegida.name}</strong>
                                <span>${Number(elegida.price).toLocaleString('es-CO')}</span>
                            </div>
                            <input
                                type="text"
                                className="chat-image-caption"
                                value={pie}
                                onChange={e => setPie(e.target.value)}
                                placeholder="Escribe un mensaje para acompañar..."
                            />
                            <div className="chat-image-preview-actions">
                                <button className="chat-image-cancel-btn" onClick={() => setElegida(null)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    Volver
                                </button>
                                <button className="chat-image-send-btn" onClick={() => enviar(elegida)} disabled={enviando}>
                                    {enviando ? (
                                        <><div className="chat-send-spinner" /> Enviando...</>
                                    ) : (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>    );
}
