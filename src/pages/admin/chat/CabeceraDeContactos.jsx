/**
 * Lo que hay encima de la lista de conversaciones: el pulso de Valentina, el
 * buscador, los filtros y el mando de la selección múltiple.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026. Es la primera pieza del
 * último tramo, la que menos riesgo tenía: todo lo que hace se ve, así que un
 * error aquí se nota al abrir la pantalla — que es justo lo contrario de los
 * cinco fallos que aparecieron partiendo el resto del archivo.
 *
 * El chip de arriba dice tres cosas distintas según lo que esté pasando, y el
 * orden importa: primero cuántas conversaciones lleva una persona, después
 * cuántas esperan respuesta, y sólo si no hay ninguna de las dos, que Valentina
 * está trabajando. Lo que necesita atención va antes que lo que va bien.
 */
import React from 'react';

/* El orden es el de uso, no el alfabético: los tres primeros son los de todos
   los días y «Para purgar» va al final porque se entra una vez cada varios
   meses. */
const FILTROS = [
    ['todos', 'Todos'],
    ['hoy', 'Hoy'],
    ['no_leidos', 'No leídos'],
    ['sin_responder', '+24h'],
    ['takeover', 'Manual'],
    ['pendiente', 'Pedido'],
    ['resuelto', 'Resuelto'],
    ['archivado', 'Archivados'],
    ['purgar', 'Para purgar'],
];

export default function CabeceraDeContactos({
    enManual,
    esperanRespuesta,
    busqueda,
    onBuscar,
    campoRef,
    filtro,
    onFiltrar,
    lote,
    onMarcarTodas,
}) {
    return (
                <div className="chat-contacts-header">
                    <div className="chat-contacts-titulo">
                        <h2>Chats</h2>
                        <span className={`chat-agente ${enManual > 0 ? 'chat-agente--manual' : ''}`}>
                            <span className="chat-agente-punto" />
                            {enManual > 0
                                ? `${enManual} en manual`
                                : esperanRespuesta > 0
                                    ? `${esperanRespuesta} espera${esperanRespuesta !== 1 ? 'n' : ''}`
                                    : 'Valentina activa'}
                        </span>
                    </div>
                    <input
                        ref={campoRef}
                        type="text"
                        className="chat-search"
                        placeholder="Buscar conversacion... (Ctrl+K)"
                        value={busqueda}
                        onChange={e => onBuscar(e.target.value)}
                    />
                    <div className="riel" role="group" aria-label="Filtrar conversaciones">
                        {FILTROS.map(([f, label]) => (
                            <button key={f} type="button"
                                    className={`riel-btn${filtro === f ? ' riel-btn--on' : ''}`}
                                    aria-pressed={filtro === f}
                                    onClick={() => onFiltrar(f)}>
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Ni oculta tras un gesto ni ocupando sitio de más:
                        una línea que en reposo sólo ofrece entrar, y que
                        al entrar se convierte en el mando del lote. */}
                    <div className="chat-seleccion-barra">
                        {lote.marcadas ? (
                            <>
                                <span className="chat-seleccion-cuenta">
                                    {lote.marcadas.size === 0
                                        ? 'Ninguna marcada'
                                        : lote.marcadas.size === 1
                                            ? '1 marcada'
                                            : `${lote.marcadas.size} marcadas`}
                                </span>
                                <button type="button" onClick={onMarcarTodas}>Todas</button>
                                <button type="button" onClick={() => lote.entrar([])}>Ninguna</button>
                                <button type="button" className="chat-seleccion-salir" onClick={lote.salir}>Cancelar</button>
                            </>
                        ) : (
                            <button type="button" onClick={() => lote.entrar([])}>Seleccionar varias</button>
                        )}
                    </div>
                </div>
    );
}
