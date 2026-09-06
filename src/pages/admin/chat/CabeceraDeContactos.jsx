/**
 * Lo que hay encima de la lista de conversaciones: el título, el pulso de la
 * bandeja, el buscador, las pestañas y el mando de la selección múltiple.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026. Es la primera pieza del
 * último tramo, la que menos riesgo tenía: todo lo que hace se ve, así que un
 * error aquí se nota al abrir la pantalla — que es justo lo contrario de los
 * cinco fallos que aparecieron partiendo el resto del archivo.
 *
 * ── El 6 de septiembre de 2026 se llevó la barra de arriba ───────────────
 *
 * Hasta ese día había DOS cabeceras, una encima de la otra: la del panel
 * —«Conversaciones», el punto de conexión, el altavoz, el avatar— y ésta, que
 * decía «Chats». En un celular eso son 64 px que no dicen nada nuevo antes de
 * la primera fila, y en la conversación abierta eran tres barras apiladas.
 *
 * Ahora ésta es la única, y por eso lleva lo que llevaba la otra: el punto de
 * conexión va pegado al pulso —donde se lee «hay algo raro» sin buscarlo— y el
 * altavoz y el avatar, a la derecha del título.
 *
 * El pulso dice tres cosas y el orden importa: primero cuántas esperan
 * respuesta, después cuántas lleva una persona a mano, y sólo si no hay
 * ninguna de las dos, que Valentina está trabajando. Lo que necesita atención
 * va antes que lo que va bien.
 */
import React from 'react';

/* ─── Tres a la vista y el resto en el cajón ──────────────────────────────
 *
 * Eran trece píldoras en una columna de 360px. Trece no es un filtro, es un
 * menú: se desbordaban —«No leídos» salía cortada a «No l…»— y nadie iba a
 * encontrar «Cotizados» en la posición ocho de una tira que se arrastra.
 *
 * A la vista quedan los del día: con qué se entra, y las casillas del embudo
 * donde se decide una venta. El resto son vistas que se abren de vez en
 * cuando, y para eso está un selector — que además es lo más cómodo que hay en
 * un celular, por lo mismo que el estado de un chat es un `select`.
 *
 * Eran dos y ahora son tres (cuatro en escritorio) porque dejaron de ser
 * píldoras: una pestaña con filete no lleva fondo ni relleno lateral, así que
 * ocupa la mitad y en 375 px caben las tres sin cortar ninguna. Si alguna
 * vuelve a salir como «Por a…», el que sobra es el cuarto, no el selector.
 */
const PRIMARIOS = [
    ['todos', 'Todos', false],
    /* «Por atender» abre la lista: es la pregunta con la que el joyero entra
       al panel —¿qué me falta?— y hasta hoy no tenía respuesta, había que
       revisar las cuarenta filas una por una. */
    ['por_atender', 'Por atender', false],
    /* El peldaño donde más se pierde: ya tiene precio y está pensándolo. */
    ['cotizado', 'Cotizados', false],
    /* Sólo en escritorio: en el celular la cuarta pestaña le quita el sitio a
       «Más», que es la puerta a las otras ocho vistas. */
    ['vendido', 'Vendidos', true],
];

/* Los del embudo que no están a la vista, y las vistas. Dos grupos porque son
   dos preguntas distintas —«en qué va» y «cuáles quiero ver»— y mezcladas en
   una lista de diez no se encuentra ninguna. */
const EL_EMBUDO = [
    ['perdido', 'Perdidos'],
    ['pendiente', 'Con pedido'],
];

/* «Para purgar» va al final porque se entra una vez cada varios meses. */
const LAS_VISTAS = [
    ['hoy', 'Hoy'],
    ['no_leidos', 'No leídos'],
    /* Chrome le da al `select` el ancho de su opción más larga, así que un
       rótulo de más se lo quita a las pestañas de al lado: con «Sin responder
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
    verBuscador,
    onVerBuscador,
    filtro,
    onFiltrar,
    lote,
    onMarcarTodas,
    conectado,
    estadoRealtime,
    sonido,
    onSonido,
    inicialDelEquipo,
}) {
    const enElCajon = EN_EL_CAJON.some(([f]) => f === filtro);

    return (
        <div className="chat-contacts-header">
            <div className="chat-cab-fila">
                <div className="chat-cab-titulo">
                    <h2>Conversaciones</h2>
                    <p className="chat-cab-pulso">
                        <span
                            className={`chat-rt-status ${conectado ? 'chat-rt-status--ok' : 'chat-rt-status--err'}`}
                            title={conectado ? 'Conectado en tiempo real' : `Estado: ${estadoRealtime}`}
                        />
                        {esperanRespuesta > 0 && (
                            <strong>{esperanRespuesta} espera{esperanRespuesta !== 1 ? 'n' : ''}</strong>
                        )}
                        {esperanRespuesta > 0 && enManual > 0 && ' · '}
                        {enManual > 0 && `${enManual} en manual`}
                        {esperanRespuesta === 0 && enManual === 0 && 'Valentina activa'}
                    </p>
                </div>

                <div className="chat-cab-mandos">
                    <button
                        type="button"
                        className={`chat-cab-icono ${verBuscador ? 'chat-cab-icono--on' : ''}`}
                        onClick={() => onVerBuscador(!verBuscador)}
                        aria-expanded={verBuscador}
                        title="Buscar una conversación (Ctrl+K)"
                        aria-label="Buscar una conversación"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                    </button>
                    <button
                        type="button"
                        className={`chat-cab-icono ${sonido ? '' : 'chat-cab-icono--mudo'}`}
                        onClick={onSonido}
                        title={sonido ? 'Silenciar los avisos' : 'Activar los avisos'}
                        aria-label={sonido ? 'Silenciar los avisos' : 'Activar los avisos'}
                    >
                        {sonido ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                        )}
                    </button>
                    {/* El avatar del equipo. Estaba en la barra de arriba, que
                        ya no existe; aquí sigue diciendo con qué cuenta se
                        entró, que es lo único para lo que servía. */}
                    <span className="chat-cab-avatar" aria-hidden="true">{inicialDelEquipo}</span>
                </div>
            </div>

            {/* El buscador se abre y se cierra, y en reposo no está. Con
                cuarenta conversaciones se busca de vez en cuando; el campo
                fijo se llevaba una franja entera de la pantalla del celular
                todos los días para eso. Ctrl+K lo abre y lo enfoca. */}
            {verBuscador && (
                <input
                    ref={campoRef}
                    type="text"
                    className="chat-search"
                    placeholder="Buscar por nombre, número o texto…"
                    value={busqueda}
                    onChange={e => onBuscar(e.target.value)}
                />
            )}

            <div className="chat-pestanas" role="group" aria-label="Filtrar conversaciones">
                {PRIMARIOS.map(([f, label, soloEscritorio]) => (
                    <button
                        key={f}
                        type="button"
                        className={`chat-pestana${filtro === f ? ' chat-pestana--on' : ''}${soloEscritorio ? ' chat-pestana--ancha' : ''}`}
                        aria-pressed={filtro === f}
                        onClick={() => onFiltrar(f)}
                    >
                        {label}
                    </button>
                ))}
                {/* Cuando hay una vista del cajón puesta, ninguna pestaña se ve
                    encendida: lo dice el selector, que pasa a llevar el oro.
                    Sin eso la lista saldría filtrada y nada en pantalla diría
                    por qué. */}
                <select
                    className={`chat-pestana chat-pestana--mas${enElCajon ? ' chat-pestana--on' : ''}`}
                    value={enElCajon ? filtro : ''}
                    onChange={e => onFiltrar(e.target.value)}
                    aria-label="Más vistas"
                >
                    <option value="" disabled>Más</option>
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
