/**
 * «¿Seguro?» antes de algo que no se deshace fácil.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026, y sale **uno** donde había
 * **dos**: archivar una conversación y borrar sus fotos tenían el mismo
 * armazón escrito dos veces, con las mismas cinco clases y la misma pareja de
 * botones. Dos copias de un diálogo son dos copias que un día dejan de
 * parecerse — y ya no se parecían del todo: la de las fotos bloqueaba el clic
 * del fondo mientras trabajaba y la de archivar no.
 *
 * `ocupado` es lo que impide cerrar a medias. Mientras la acción corre, el
 * fondo deja de cerrar y los dos botones se apagan: darle a Cancelar cuando el
 * borrado ya salió hacia el servidor no cancela nada, sólo hace creer que sí.
 *
 * El tono no es decoración. `danger` es para lo que no vuelve —las fotos se
 * borran del bucket— y `primary` para lo que se deshace solo: una conversación
 * archivada reaparece en cuanto la clienta vuelva a escribir.
 */
import React from 'react';

export default function DialogoDeConfirmacion({
    titulo,
    texto,
    accion,
    tono = 'primary',        // 'primary' se deshace · 'danger' no
    ocupado = false,
    textoOcupado,
    onCancelar,
    onConfirmar,
}) {
    return (
        <div className="chat-confirm-overlay" onClick={() => !ocupado && onCancelar()}>
            <div className="chat-confirm-modal" onClick={e => e.stopPropagation()}>
                <h4>{titulo}</h4>
                <p>{texto}</p>
                <div className="chat-confirm-actions">
                    <button
                        className="chat-confirm-btn chat-confirm-btn--cancel"
                        onClick={onCancelar}
                        disabled={ocupado}
                    >
                        Cancelar
                    </button>
                    <button
                        className={`chat-confirm-btn chat-confirm-btn--${tono}`}
                        onClick={onConfirmar}
                        disabled={ocupado}
                    >
                        {ocupado && textoOcupado ? textoOcupado : accion}
                    </button>
                </div>
            </div>
        </div>
    );
}
