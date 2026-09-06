/**
 * Todo lo que se le puede hacer a una conversación abierta, en un sitio.
 *
 * ── Una sola lista, dos formas ───────────────────────────────────────────
 *
 * En escritorio cuelga de los tres puntos de la cabecera, como siempre. En el
 * celular es una **hoja que sube desde abajo**, con el fondo oscurecido: no es
 * decoración, es que en un teléfono un desplegable anclado arriba a la derecha
 * cae fuera de la pantalla o queda recortado —ya pasó, y hubo que arreglarlo el
 * 6 de septiembre de 2026— y además obliga a estirar el pulgar hasta la esquina
 * más lejos que hay. Una hoja nace donde está la mano.
 *
 * Las dos formas son el mismo árbol; lo que cambia es el CSS. Es la misma
 * decisión que ya llevaban `.chat-menu-secundarias` y `.chat-menu-ficha`: se
 * pinta todo y esconde la hoja de estilos, en vez de preguntarle el ancho al
 * navegador, para que haya un solo árbol y una sola verdad.
 *
 * ── Por qué hay títulos de grupo ─────────────────────────────────────────
 *
 * Eran nueve botones seguidos, y el noveno borraba la conversación para
 * siempre. Con tres grupos —lo que se hace mientras se habla, lo que es del
 * contacto, y lo que se lleva o borra cosas— el que no se deshace queda
 * separado de los que sí por algo más que dos píxeles de línea.
 */
import React from 'react';

export default function MenuDeAcciones({
    nombre,
    meta,
    enManual,
    resuelta,
    verFicha,
    fotos,
    onCerrar,
    onTomarControl,
    onBuscarMensajes,
    onAlternarResuelta,
    onArchivar,
    onVerFicha,
    onExportar,
    onBorrarFotos,
    onEliminar,
}) {
    /* Cada acción cierra el menú: son todas de una vez por conversación, y
       dejarlo abierto encima de lo que acaba de cambiar tapa el resultado. */
    const y = (accion) => () => { onCerrar(); accion(); };

    return (
        <>
            {/* Sólo se ve en el celular, donde la hoja flota. En escritorio el
                menú se cierra con el clic fuera de siempre. */}
            <div className="chat-hoja-fondo" onClick={onCerrar} />

            <div className="chat-export-menu" role="menu">
                <span className="chat-hoja-tirador" aria-hidden="true" />

                <div className="chat-hoja-cabeza">
                    <span className="chat-hoja-nombre">{nombre}</span>
                    {meta && <span className="chat-hoja-meta">{meta}</span>}
                </div>

                {/* Por debajo de 1280 la cabecera no tiene sitio para la barra
                    entera, así que estas tres bajan aquí. */}
                <div className="chat-acciones-grupo chat-menu-secundarias">
                    <span className="chat-acciones-titulo">Conversación</span>
                    <button role="menuitem" onClick={y(onTomarControl)}>
                        {enManual ? 'Devolver a Valentina' : 'Tomar el control'}
                    </button>
                    <button role="menuitem" onClick={y(onBuscarMensajes)}>Buscar en los mensajes</button>
                    <button role="menuitem" onClick={y(onAlternarResuelta)}>
                        {resuelta ? 'Marcar sin resolver' : 'Marcar resuelta'}
                    </button>
                    <button role="menuitem" onClick={y(onArchivar)}>Archivar</button>
                </div>

                {/* La ficha aguanta hasta el celular: en un portátil su botón
                    es lo que abre el panel que ahora flota. */}
                <div className="chat-acciones-grupo chat-menu-ficha">
                    <span className="chat-acciones-titulo">Contacto</span>
                    <button role="menuitem" onClick={y(onVerFicha)}>
                        {verFicha ? 'Ocultar la ficha' : 'Ver la ficha del contacto'}
                    </button>
                </div>

                <div className="chat-acciones-grupo">
                    <span className="chat-acciones-titulo">Exportar y limpiar</span>
                    <button role="menuitem" onClick={y(() => onExportar('txt'))}>Exportar TXT</button>
                    <button role="menuitem" onClick={y(() => onExportar('csv'))}>Exportar CSV</button>
                    {fotos > 0 && (
                        <button role="menuitem" onClick={y(onBorrarFotos)}>
                            Borrar sólo las fotos
                            <span className="chat-acciones-cuenta">{fotos === 1 ? '1 foto' : `${fotos} fotos`}</span>
                        </button>
                    )}
                    <button role="menuitem" className="chat-export-menu-danger" onClick={y(onEliminar)}>
                        Eliminar conversación
                    </button>
                </div>

                {/* Sólo en la hoja: en un desplegable de escritorio se cierra
                    pulsando fuera y un botón de cancelar sería un estorbo. */}
                <button type="button" className="chat-hoja-cancelar" onClick={onCerrar}>Cancelar</button>
            </div>
        </>
    );
}
