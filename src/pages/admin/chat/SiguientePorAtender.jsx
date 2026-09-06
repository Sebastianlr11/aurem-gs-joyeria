/**
 * La tarjeta de arriba de la lista: **quién sigue**.
 *
 * ── Por qué existe ───────────────────────────────────────────────────────
 *
 * La lista contesta «qué pasó», ordenada por lo último que entró. No contesta
 * «qué hago ahora», que es la pregunta con la que el joyero abre el panel: la
 * conversación que más lleva sin respuesta es justo la que la lista empuja
 * hacia abajo, porque hace horas que nadie escribe en ella.
 *
 * El filtro «Por atender» ya recortaba eso, pero un filtro hay que acordarse
 * de pulsarlo. Esto está puesto antes de que nadie pulse nada, y es la única
 * pieza de la pantalla que dice un nombre propio.
 *
 * ── Que repita la primera fila es a propósito ────────────────────────────
 *
 * Casi siempre la persona de la tarjeta vuelve a salir en la lista de abajo.
 * No es un descuido: la tarjeta no es un atajo a la lista, es la respuesta —y
 * una respuesta que a veces coincide con lo primero que se ve sigue siendo la
 * respuesta. Lo que no hace es señalar al chat que ya está abierto; de eso se
 * encarga quien la monta.
 */
import React from 'react';
import { esperaDesde, resumenDelMensaje, truncate } from './comunes';
import { definicionDe } from '../../../lib/estadoDelChat';
import { nombreVisible, inicialDe } from '../../../lib/contacto';

export default function SiguientePorAtender({ contacto, estado, onAbrir }) {
    if (!contacto) return null;

    const { nombre, anonimo } = nombreVisible(contacto);
    const inicial = inicialDe(contacto);
    const ultimo = resumenDelMensaje(contacto.last_message);
    const espera = esperaDesde(contacto.last_time);
    const { etiqueta: estadoEtiqueta, color: colorDelEstado } = definicionDe(estado);
    const sinLeer = contacto.unread || 0;

    return (
        <div
            className="chat-siguiente"
            role="button"
            tabIndex={0}
            onClick={() => onAbrir(contacto.phone_number)}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAbrir(contacto.phone_number);
                }
            }}
        >
            <span className="chat-siguiente-rotulo">Siguiente por atender</span>

            <div className="chat-siguiente-quien">
                <div className="chat-contact-avatar">
                    {inicial || (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    )}
                </div>
                <div className="chat-siguiente-texto">
                    <span className={`chat-siguiente-nombre ${anonimo ? 'chat-contact-name--anonimo' : ''}`}>{nombre}</span>
                    <span className="chat-siguiente-preview">
                        {ultimo.marca && <em className="chat-contact-marca">{ultimo.marca}</em>}
                        {truncate(ultimo.texto, 40)}
                    </span>
                </div>
                <span className="chat-siguiente-abrir" aria-hidden="true">Abrir →</span>
            </div>

            {/* El pie es lo que justifica que esta persona esté aquí arriba y
                no otra. Sin él la tarjeta sería una fila más, en negrita. */}
            <div className="chat-siguiente-pie">
                {espera && <span>Espera <strong>{espera}</strong></span>}
                {sinLeer > 0 && (
                    <span>{sinLeer === 1 ? '1 mensaje sin leer' : `${sinLeer} mensajes sin leer`}</span>
                )}
                {colorDelEstado && (
                    <span className="chat-siguiente-estado" style={{ '--estado-color': colorDelEstado }}>
                        {estadoEtiqueta}
                    </span>
                )}
            </div>
        </div>
    );
}
