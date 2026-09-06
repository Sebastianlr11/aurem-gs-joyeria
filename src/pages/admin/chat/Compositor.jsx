/**
 * Lo que hay al pie de la conversación: las respuestas rápidas, el campo, el
 * botón de enviar y el disparador del selector de fotos.
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
 *
 * ── Las respuestas rápidas dejaron de estar escondidas ───────────────────
 *
 * Hasta el 6 de septiembre de 2026 vivían detrás de un botón con un globo de
 * diálogo, en un desplegable que tapaba la conversación. Son seis frases que
 * el joyero escribe veinte veces al día —el catálogo, la talla, los tiempos de
 * entrega— y el botón no decía ninguna: para saber qué había dentro había que
 * abrirlo, así que era más rápido teclear.
 *
 * Ahora son una tira de fichas encima del campo, con su texto escrito y
 * arrastrable de lado. Es la misma lección que ya se aprendió con «marcar
 * resuelta»: una función escondida detrás de un menú es una función que no
 * existe.
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
    onVerImagenes,
    panelDeImagen,
    enManual,
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
                {/* La tira se arrastra de lado y se desvanece por el borde
                    derecho: el degradado es lo que dice que hay más, sin
                    gastar una flecha ni una segunda línea. */}
                {respuestas.length > 0 && (
                    <div className="chat-rapidas" role="group" aria-label="Respuestas rápidas">
                        {respuestas.map((qr, i) => (
                            <button
                                key={i}
                                type="button"
                                className="chat-rapida"
                                /* Igual que el botón de enviar: sin esto el
                                   campo pierde el foco antes del clic, el
                                   teclado del celular se cierra y el toque
                                   cae donde ya no está la ficha. */
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => onElegirRespuesta(qr.text)}
                                title={qr.text}
                            >
                                {qr.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="chat-conv-input-fila">
                    <div className="chat-input-actions">
                        <button
                            className="chat-image-trigger"
                            onClick={onVerImagenes}
                            title="Enviar una foto del catálogo"
                            aria-label="Enviar una foto del catálogo"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </button>

                        {panelDeImagen}
                    </div>

                    {/* En manual el marcador lo dice, y lo dice AQUÍ.
                        Antes había un letrero de tres renglones encima de la
                        conversación —«Modo manual activo — Valentina no responde
                        en este chat…»— que en un celular se llevaba el 10% de la
                        pantalla para repetir lo que la insignia de la cabecera ya
                        decía. Se quitó el 6 de septiembre de 2026. Lo que sí hacía
                        falta de aquel texto es esta advertencia, y su sitio es el
                        campo: se lee en el momento de escribir, no cinco pantallas
                        más arriba. */}
                    <textarea
                        className="chat-input-field"
                        placeholder={enManual ? 'Escribe al cliente…' : 'Escribe un mensaje…'}
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
                        aria-label="Enviar"
                    >
                        {enviando ? (
                            <div className="chat-send-spinner" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
