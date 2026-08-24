/**
 * Lo que hay al pie de la conversación: el campo, el botón de enviar, las
 * respuestas rápidas y el disparador del selector de fotos.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026 con **sólo la pintura**. El
 * estado y `handleSend` se quedaron en el panel a propósito, y no por pereza:
 * es la única parte de esta pantalla que le manda un mensaje a una clienta de
 * verdad, y un mensaje enviado no se puede recoger. Mover catorce props es más
 * barato que mover la función que aprieta el gatillo.
 *
 * El panel del selector de fotos entra como prop en vez de montarse aquí: se
 * ancla dentro de esta barra, pero quién lo abre y qué hace al enviar es cosa
 * del panel, que es quien sabe de qué conversación se trata.
 */
import React from 'react';

export default function Compositor({
    mensaje,
    onCambiar,
    onTeclear,
    onEscribiendo,
    enviando,
    onEnviar,
    error,
    onDescartarError,
    respuestas,
    onElegirRespuesta,
    verRespuestas,
    onVerRespuestas,
    refRespuestas,
    onVerImagenes,
    panelDeImagen,
}) {
    return (
        <>
            {error && (
                <div className="chat-send-error">
                    <span>{error}</span>
                    <button onClick={onDescartarError}>&times;</button>
                </div>
            )}

            <div className="chat-conv-input">
                <div className="chat-input-actions">
                    <button
                        className="chat-quick-trigger"
                        onClick={onVerRespuestas}
                        title="Respuestas rapidas"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </button>
                    <button
                        className="chat-image-trigger"
                        onClick={onVerImagenes}
                        title="Enviar imagen de producto"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </button>

                    {verRespuestas && (
                        <div className="chat-quick-replies" ref={refRespuestas}>
                            {respuestas.map((qr, i) => (
                                <button key={i} className="chat-quick-reply-btn"
                                        onClick={() => onElegirRespuesta(qr.text)}>
                                    {qr.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {panelDeImagen}
                </div>
                <textarea
                    className="chat-input-field"
                    placeholder="Escribe un mensaje..."
                    value={mensaje}
                    onChange={e => onCambiar(e.target.value)}
                    onKeyDown={onTeclear}
                    onFocus={() => onEscribiendo(true)}
                    onBlur={() => onEscribiendo(false)}
                    rows={1}
                />
                <button
                    className="chat-send-btn"
                    /* Sin esto el campo pierde el foco ANTES del clic: la barra
                       de navegación reaparece, el layout se mueve y el toque
                       puede caer en otro lado. */
                    onMouseDown={e => e.preventDefault()}
                    onClick={onEnviar}
                    disabled={!mensaje.trim() || enviando}
                >
                    {enviando ? (
                        <div className="chat-send-spinner" />
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    )}
                </button>
            </div>
        </>
    );
}
