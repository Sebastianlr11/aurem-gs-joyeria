/**
 * Escuchar cambios de la base en vivo, sin la fontanería a la vista.
 *
 * Salió de `ChatPanel.jsx` el 23 de agosto de 2026, y es lo último que se sacó
 * de ese archivo a propósito: **es lo único que, si se rompe, deja la bandeja
 * muda.** No falla con un error; deja de llegar todo, y eso se nota horas
 * después, cuando alguien pregunta por qué no contestamos.
 *
 * Lo que se lleva es sólo el armazón —crear el canal, engancharle las escuchas,
 * suscribirse, seguir el estado y limpiar al salir—, que es igual para
 * cualquier canal. Lo que hace cada mensaje que llega se queda en el panel,
 * que es quien sabe de mensajes.
 *
 * ── El detalle que hace que esto funcione ───────────────────────────────────
 *
 * Las escuchas se guardan en una referencia y el efecto **no depende de ellas**.
 * Si dependiera, como se escriben en línea y son un array nuevo en cada render,
 * el panel se desuscribiría y volvería a suscribirse sesenta veces por minuto
 * — y en cada hueco entre una y otra, los mensajes que llegaran se perderían
 * sin dejar rastro. Al leerlas desde la referencia en el momento de usarlas,
 * el canal se crea una vez y aun así siempre llama a la versión de ahora.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

/**
 * @param nombre    del canal; dos canales con el mismo nombre se pisan
 * @param activa    si no, no se suscribe (p. ej. sin sesión todavía)
 * @param escuchas  [{ tabla, evento, al(payload) }]
 * @param opciones  las del canal de Supabase
 * @returns el estado: 'CONNECTING' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
 */
export function useSuscripcion(nombre, activa, escuchas, opciones = undefined) {
    const [estado, setEstado] = useState('CONNECTING');
    const escuchasRef = useRef(escuchas);
    const opcionesRef = useRef(opciones);

    /* Sin lista de dependencias: se refresca en cada render, que es justo lo
       que hace falta para que el canal viejo llame siempre al manejador nuevo. */
    useEffect(() => { escuchasRef.current = escuchas; });

    useEffect(() => {
        if (!activa) return;

        const canal = supabase.channel(nombre, opcionesRef.current);

        escuchasRef.current.forEach((_, i) => {
            const { tabla, evento } = escuchasRef.current[i];
            canal.on(
                'postgres_changes',
                { event: evento, schema: 'public', table: tabla },
                /* Se busca por índice en la referencia en vez de capturar la
                   función: así el canal, que se crea una sola vez, siempre
                   ejecuta el manejador de ahora y no el del primer render. */
                (payload) => escuchasRef.current[i]?.al(payload),
            );
        });

        canal.subscribe((status, err) => {
            if (err) console.warn(`[Realtime] ${nombre}:`, status, err);
            setEstado(status);
        });

        return () => { supabase.removeChannel(canal); };
    }, [nombre, activa]);

    return estado;
}
