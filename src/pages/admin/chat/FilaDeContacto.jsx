/**
 * Una fila de la lista de conversaciones.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026: eran 122 líneas dentro de
 * un `.map()`, que es el peor sitio donde puede vivir algo así — para leer la
 * lista había que leer entera una fila, y para leer la fila había que llevar en
 * la cabeza el estado de todo el panel.
 *
 * No es un `<button>` aunque se comporte como uno, y hay que dejarlo dicho para
 * que nadie lo "arregle": lleva otro botón dentro —el de los tres puntos— y un
 * botón dentro de otro no es HTML válido; el navegador desarma la fila entera.
 * Con `role` y `tabIndex` sigue enfocándose y respondiendo a Enter y a la barra
 * espaciadora igual que antes.
 */
import React from 'react';
import { fmtDate, fmtDateFull, truncate } from './comunes';

export default function FilaDeContacto({
    contacto,
    activa,
    marcada,
    enSeleccion,          // hay modo selección encendido (aunque no haya nada marcado)
    enManual,
    resuelta,
    estado,               // la fila de chat_status, para saber si está archivada
    etiquetas,
    filtro,
    menu,                 // { phone, arriba } del menú abierto, si es esta fila
    menuRef,
    setMenu,
    onAbrir,
    onAlternar,
    onAlternarResuelta,
    onDesarchivar,
    onPedirArchivado,
    onPedirBorrado,
}) {
    /* En modo selección la fila marca en vez de abrir: tener que apuntar a una
       casilla de 16 px para elegir siete conversaciones es puntería, no
       interfaz. */
    const alPulsar = () => (enSeleccion ? onAlternar(contacto.phone_number) : onAbrir(contacto.phone_number));

    return (
        /* Deja de ser un <button> porque ahora lleva
           otro botón dentro —el de los tres puntos— y un
           botón dentro de otro no es HTML válido: el
           navegador desarma la fila entera. Con role y
           tabIndex sigue enfocándose y respondiendo a
           Enter y a la barra espaciadora igual que antes. */
        <div
            key={contacto.phone_number}
            role="button"
            tabIndex={0}
            aria-pressed={enSeleccion ? marcada : undefined}
            className={`chat-contact-item ${activa && !enSeleccion ? 'chat-contact-item--active' : ''} ${enManual ? 'chat-contact-item--takeover' : ''} ${(contacto.unread || 0) > 0 ? 'chat-contact-item--unread' : ''} ${marcada ? 'chat-contact-item--marcada' : ''}`}
            onClick={alPulsar}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    alPulsar();
                }
            }}
        >
            {enSeleccion && (
                <input
                    type="checkbox"
                    className="chat-contact-casilla"
                    checked={marcada}
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={() => onAlternar(contacto.phone_number)}
                    onClick={e => e.stopPropagation()}
                />
            )}
            <div className="chat-contact-avatar">
                {contacto.customer_name ? contacto.customer_name[0].toUpperCase() : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
                {enManual && <span className="chat-contact-takeover-dot" />}
                {resuelta && !enManual && <span className="chat-contact-resolved-dot" title="Resuelto">✓</span>}
            </div>
            <div className="chat-contact-info">
                <div className="chat-contact-top">
                    <span className={`chat-contact-name ${(contacto.unread || 0) > 0 ? 'chat-contact-name--unread' : ''}`}>
                        {contacto.customer_name || contacto.phone_number}
                    </span>
                    {enManual && <span className="chat-takeover-badge">MANUAL</span>}
                    <span className="chat-contact-time">
                        {filtro === 'purgar' ? fmtDateFull(contacto.last_time) : fmtDate(contacto.last_time)}
                    </span>
                </div>
                <div className="chat-contact-preview">
                    <span>{truncate(contacto.last_message, 45)}</span>
                </div>
                {etiquetas.length > 0 && (
                    <div className="chat-contact-tags">
                        {etiquetas.slice(0, 3).map(t => (
                            <span key={t.id} className="chat-tag-pill" style={{ '--tag-color': t.color }}>{t.tag_name}</span>
                        ))}
                    </div>
                )}
            </div>
            {(contacto.unread || 0) > 0
                ? <span className="chat-unread-badge">{contacto.unread}</span>
                : contacto.last_role === 'assistant' && !enManual && <span className="chat-contact-ia">IA</span>}
        
            {/* Archivar y eliminar, en la fila. Antes había que
                abrir el chat y entrar al menú de exportar para
                encontrar el borrado; aquí está donde se mira la
                lista, que es donde se decide de qué sobra.
        
                Se calla mientras hay una selección abierta: dos
                formas de borrar la misma fila, una para esta y
                otra para el lote, es una invitación a equivocarse. */}
            {!enSeleccion && (
            <div
                className="chat-contact-menu"
                ref={menu?.phone === contacto.phone_number ? menuRef : null}
                onClick={e => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={`chat-contact-menu-btn ${menu?.phone === contacto.phone_number ? 'chat-contact-menu-btn--abierto' : ''}`}
                    aria-label={`Opciones de ${contacto.customer_name || contacto.phone_number}`}
                    aria-expanded={menu?.phone === contacto.phone_number}
                    onClick={e => {
                        if (menu?.phone === contacto.phone_number) { setMenu(null); return; }
                        /* La lista tiene su propio scroll, así que un menú
                           que se abre hacia abajo en la última fila queda
                           cortado. Si no cabe, se abre hacia arriba. */
                        const lista = e.currentTarget.closest('.chat-contacts-list');
                        const fondo = e.currentTarget.getBoundingClientRect().bottom;
                        const cabe = !lista || fondo + 150 < lista.getBoundingClientRect().bottom;
                        setMenu({ phone: contacto.phone_number, arriba: !cabe });
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                </button>
                {menu?.phone === contacto.phone_number && (
                    <div className={`chat-fila-menu ${menu.arriba ? 'chat-fila-menu--arriba' : ''}`}>
                        {estado?.is_archived ? (
                            <button type="button" onClick={() => { setMenu(null); onDesarchivar(contacto.phone_number); }}>
                                Sacar del archivo
                            </button>
                        ) : (
                            <button type="button" onClick={() => { setMenu(null); onPedirArchivado(contacto.phone_number); }}>
                                Archivar
                            </button>
                        )}
                        <button type="button" onClick={() => { setMenu(null); onAlternarResuelta(contacto.phone_number); }}>
                            {resuelta ? 'Marcar sin resolver' : 'Marcar resuelta'}
                        </button>
                        <button
                            type="button"
                            className="chat-fila-menu-danger"
                            onClick={() => { setMenu(null); onPedirBorrado([{ telefono: contacto.phone_number, nombre: contacto.customer_name }]); }}
                        >
                            Eliminar conversación
                        </button>
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
