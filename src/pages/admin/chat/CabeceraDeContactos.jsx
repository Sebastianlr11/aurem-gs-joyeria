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

/* ─── Cuatro a la vista y nueve en el cajón ───────────────────────────────
 *
 * Eran trece píldoras en una columna de 360px. Trece no es un filtro, es un
 * menú: se desbordaban —«No leídos» salía cortada a «No l…»— y nadie iba a
 * encontrar «Cotizados» en la posición ocho de una tira que se arrastra.
 *
 * A la vista quedan los cuatro del día: con qué se entra, y las dos casillas
 * del embudo donde se decide una venta. El resto son vistas que se abren de
 * vez en cuando, y para eso está un selector — que además es lo más cómodo que
 * hay en un celular, por lo mismo que el estado de un chat es un `select`.
 */
const PRIMARIOS = [
    ['todos', 'Todos'],
    /* «Por atender» abre la lista: es la pregunta con la que el joyero entra
       al panel —¿qué me falta?— y hasta hoy no tenía respuesta, había que
       revisar las cuarenta filas una por una. */
    ['por_atender', 'Por atender'],
];

/* Dos píldoras y no cuatro: la columna mide 360px y con cuatro «Por atender»
   salía cortada a «Por a». Aquí caben las dos de todos los días; el resto va
   en el selector, en dos grupos, porque son dos preguntas distintas —«en qué
   va» y «cuáles quiero ver»— y mezcladas en una lista de diez no se
   encuentra ninguna. */
const EL_EMBUDO = [
    /* Reemplazaron al viejo «Resuelto», que en cuarenta chats no se usó ni una
       vez porque un sí/no no dice en qué va una venta. */
    ['cotizado', 'Cotizados'],
    ['vendido', 'Vendidos'],
    ['perdido', 'Perdidos'],
    ['pendiente', 'Con pedido'],
];

/* «Para purgar» va al final porque se entra una vez cada varios meses. */
const LAS_VISTAS = [
    ['hoy', 'Hoy'],
    ['no_leidos', 'No leídos'],
    /* Chrome le da al `select` el ancho de su opción más larga, así que un
       rótulo de más se lo quita a las píldoras de al lado: con «Sin responder
       +24h» aquí, «Por atender» salía cortada a «Por ater». */
    ['sin_responder', 'Más de 24h'],
    ['takeover', 'En manual'],
    ['archivado', 'Archivados'],
    ['purgar', 'Para purgar'],
];

const EN_EL_CAJON = [...EL_EMBUDO, ...LAS_VISTAS];

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
    const enElCajon = EN_EL_CAJON.some(([f]) => f === filtro);

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
                    <div className="chat-filtros" role="group" aria-label="Filtrar conversaciones">
                        <div className="riel">
                            {PRIMARIOS.map(([f, label]) => (
                                <button key={f} type="button"
                                        className={`riel-btn${filtro === f ? ' riel-btn--on' : ''}`}
                                        aria-pressed={filtro === f}
                                        onClick={() => onFiltrar(f)}>
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        {/* Cuando hay una vista del cajón puesta, ninguna
                            píldora se ve encendida: lo dice el selector, que
                            pasa a llevar el oro. Sin eso la lista saldría
                            filtrada y nada en pantalla diría por qué. */}
                        <select
                            className={`chat-filtro-mas${enElCajon ? ' chat-filtro-mas--on' : ''}`}
                            value={enElCajon ? filtro : ''}
                            onChange={e => onFiltrar(e.target.value)}
                            aria-label="Más vistas"
                        >
                            <option value="" disabled>Más vistas…</option>
                            <optgroup label="En qué va">
                                {EL_EMBUDO.map(([f, label]) => (
                                    <option key={f} value={f}>{label}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Cuáles ver">
                                {LAS_VISTAS.map(([f, label]) => (
                                    <option key={f} value={f}>{label}</option>
                                ))}
                            </optgroup>
                        </select>
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
