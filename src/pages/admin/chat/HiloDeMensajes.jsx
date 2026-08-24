/**
 * El hilo de una conversación: las burbujas, los separadores de día y los
 * acuses.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026 con cuatro props y ningún
 * estado. Es puro pintar, y aun así vivía en medio del archivo grande, entre la
 * cabecera del chat y la ficha del contacto.
 *
 * Dos decisiones que se leen mal en el código y conviene tener escritas:
 *
 *   · **El separador de día sale cuando cambia el día**, comparando con el
 *     mensaje anterior.
 *   · **La hora sólo se pinta en el último mensaje de una tanda seguida** del
 *     mismo minuto y del mismo lado; el hilo se lee mucho más limpio.
 *
 * Las dos miran a un vecino, y por eso el hilo se recorre con índice en vez de
 * con un `map` inocente: una burbuja sola no sabe si le toca separador ni si le
 * toca hora.
 */
import React from 'react';
import { ACUSE, acuseDe, fmtSeparador, fmtTime, glifoDeAcuse, isSameDay } from './comunes';
import { ImagenDelChat, PieDeFoto } from './piezas';

export default function HiloDeMensajes({ mensajes, cargando, finRef, onAbrirFoto }) {
    return (
            <div className="chat-conv-messages">
                {cargando ? (
                    <div className="chat-loading">Cargando mensajes...</div>
                ) : (
                    mensajes.map((msg, i) => {
                        const showDate = i === 0 || !isSameDay(mensajes[i - 1]?.created_at, msg.created_at);
                        /* La hora sólo en el último mensaje de una tanda seguida
                           del mismo minuto: el hilo se lee mucho más limpio. */
                        const sig = mensajes[i + 1];
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
                                            ? <ImagenDelChat ruta={msg.media_url} onAbrir={onAbrirFoto} />
                                            : <div className="chat-foto-borrada">Foto borrada</div>
                                    ) : null}
                                    {msg.message_type === 'image' && msg.role === 'user'
                                        ? <PieDeFoto contenido={msg.content} />
                                        : msg.content ? <div className="chat-bubble-content"><span>{msg.content}</span></div> : null}
                                </div>
                                    {(msg._failed || showTime) && (
                                    <div className="chat-bubble-time">
                                        {msg._failed ? <span style={{ color: 'var(--error-ink)' }}>Error al enviar</span> : (
                                            <>
                                                <span>{fmtTime(msg.created_at)}</span>
                                                {msg.role === 'assistant' && (() => {
                                                    const acuse = acuseDe(msg);
                                                    return (
                                                        <span
                                                            className={`chat-delivery-status chat-delivery-status--${acuse}`}
                                                            title={ACUSE[acuse] || acuse}
                                                        >
                                                            {glifoDeAcuse(acuse)}
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
                <div ref={finRef} />
            </div>    );
}
