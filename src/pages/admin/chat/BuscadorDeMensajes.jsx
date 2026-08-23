/**
 * Buscar dentro de todas las conversaciones, no sólo en la abierta.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026, y con él tres de sus 55
 * estados y uno de sus efectos. Fue el primer grupo que se sacó porque es el
 * más independiente de todos: entra una consulta, sale una lista, y lo único
 * que le pide al panel es «llévame a este chat».
 *
 * La mudanza **quitó código en vez de moverlo**. El panel tenía que limpiar la
 * consulta y los resultados a mano en cada salida —al pulsar Escape, al elegir
 * un resultado, al volver a pulsar la lupa— y cualquiera de esas tres se podía
 * olvidar. Ahora esto se monta y se desmonta con `showMsgSearch`, así que el
 * estado nace y muere solo: no hay nada que limpiar y nada que olvidar.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fmtDate, truncate } from './comunes';

/* Se espera a que la persona deje de teclear. Sin esta pausa, «esmeralda» son
   nueve consultas a la base y ocho de ellas ya no le importan a nadie. */
const ESPERA_MS = 400;

export default function BuscadorDeMensajes({ onElegir }) {
    const [consulta, setConsulta] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const termino = consulta.trim();

    useEffect(() => {
        if (!termino) return;
        const reloj = setTimeout(async () => {
            setBuscando(true);
            const { data } = await supabase.rpc('buscar_conversaciones', { p_query: termino });
            setResultados(data || []);
            setBuscando(false);
        }, ESPERA_MS);
        return () => clearTimeout(reloj);
    }, [termino]);

    /* Lo que se pinta se DEDUCE, no se guarda. Con el campo vacío no hay
       resultados, y punto: no hace falta un efecto que los borre.

       Además de ahorrar un `setState` dentro del efecto —que dispara un
       repintado en cascada y que el lint marca con razón—, quita un estado que
       podía quedarse desfasado del campo. */
    const visibles = termino ? resultados : [];

    return (
        <div className="chat-msg-search-bar">
            <input
                type="text"
                className="chat-msg-search-input"
                placeholder="Buscar en mensajes..."
                value={consulta}
                onChange={e => setConsulta(e.target.value)}
                autoFocus
            />
            {buscando && <span className="chat-msg-search-spinner" />}
            {visibles.length > 0 && (
                <div className="chat-msg-search-results">
                    {visibles.slice(0, 8).map((r, i) => (
                        <button key={i} className="chat-msg-search-result" onClick={() => onElegir(r.phone_number)}>
                            <span className="chat-msg-search-phone">{r.phone_number}</span>
                            <span className="chat-msg-search-text">{truncate(r.content, 60)}</span>
                            <span className="chat-msg-search-time">{fmtDate(r.created_at)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
