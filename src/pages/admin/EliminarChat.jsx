/**
 * Eliminar conversaciones — una o un montón.
 *
 * El panel ya sabía borrar chats, pero el botón vivía dentro del menú de
 * exportar, detrás de un icono de descarga. Nadie lo encontraba, y la mitad
 * del trabajo tampoco se hacía: se iban los mensajes y quedaban en Storage
 * las fotos que había mandado el cliente, sus etiquetas y el registro de
 * control manual.
 *
 * Este diálogo es el mismo que el de eliminar una pieza —misma banda de
 * cacao, misma fricción— porque hace lo mismo: borra algo que no vuelve. Para
 * una conversación hay que escribir los cuatro últimos dígitos del número; para
 * un lote, cuántas son. En los dos casos la fricción existe para obligar a
 * mirar qué se está borrando, no para molestar.
 *
 * Dice qué se pierde y qué se conserva: el cliente, sus pedidos y sus datos
 * siguen ahí; lo que se va es el hilo. Avisa si hay un pedido sin entregar, que
 * es lo único que de verdad puede salir mal. Y ofrece llevarse una copia antes
 * de saltar, que es la diferencia entre una decisión y un arrepentimiento.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { borrarTodoDe, descargarChat } from '../../lib/chatArchivo';

const VIVOS = ['pendiente', 'pagado', 'procesando', 'enviado'];

/* Los cuatro últimos dígitos: lo que se escribe para confirmar una y lo que
   distingue un número de otro de un vistazo. */
const ultimos4 = (t) => String(t || '').replace(/\D/g, '').slice(-4);

/* Los diez de siempre. `orders.customer_phone` guarda el mismo número como
   `+573143602930` y como `3143602930`, así que cruzarlo tal cual no encuentra
   nada la mitad de las veces. */
const clave = (t) => String(t || '').replace(/\D/g, '').slice(-10);

/* Las variantes con las que un número puede estar escrito en pedidos. */
const variantes = (t) => {
    const digitos = String(t || '').replace(/\D/g, '');
    const largo = digitos.length === 10 ? '57' + digitos : digitos;
    const corto = largo.startsWith('57') ? largo.slice(2) : largo;
    return [...new Set([largo, corto, '+' + largo, String(t || '')])].filter(Boolean);
};

const CANTIDAD = ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const enLetra = (n) => CANTIDAD[n] ?? String(n);

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const num = (n) => Number(n || 0).toLocaleString('es-CO');

/* "y la foto que mandó" con una sola clienta delante; "y 14 fotos" cuando son
   varias, porque "las catorce fotos que mandaron" ya no se lee. */
const fraseFotos = (fotos, enLote) => {
    if (enLote) return fotos === 1 ? 'y una foto' : `y ${num(fotos)} fotos`;
    return fotos === 1 ? 'y la foto que mandó' : `y las ${enLetra(fotos)} fotos que mandó`;
};

export default function EliminarChat({ objetivos, onClose, onDeleted }) {
    const lista = useMemo(() => [].concat(objetivos || []).filter(o => o?.telefono), [objetivos]);
    const enLote = lista.length > 1;

    const [codigo, setCodigo] = useState('');
    const [borrando, setBorrando] = useState(false);
    const [progreso, setProgreso] = useState(null);   // { hecho, total }
    const [error, setError] = useState('');
    const [fallos, setFallos] = useState([]);
    const [descargando, setDescargando] = useState(false);
    const [resumen, setResumen] = useState(null);     // { mensajes, fotos, desde }
    const [pedidos, setPedidos] = useState(null);     // { vivos, conversaciones }
    const entradaRef = useRef(null);

    const telefonos = useMemo(() => lista.map(o => o.telefono), [lista]);
    const esperado = enLote ? String(lista.length) : ultimos4(telefonos[0]);
    const coincide = codigo.trim() === esperado;

    /* Qué hay dentro. Se cuenta con `head` —sin traer los mensajes— y sólo se
       pide el primero para saber desde cuándo se hablan. */
    useEffect(() => {
        if (!telefonos.length) return;
        let vigente = true;

        Promise.all([
            supabase.from('whatsapp_conversaciones')
                .select('id', { count: 'exact', head: true }).in('phone_number', telefonos),
            supabase.from('whatsapp_conversaciones')
                .select('id', { count: 'exact', head: true })
                .in('phone_number', telefonos).eq('message_type', 'image').not('media_url', 'is', null),
            supabase.from('whatsapp_conversaciones')
                .select('created_at').in('phone_number', telefonos)
                .order('created_at', { ascending: true }).limit(1).maybeSingle(),
        ]).then(([todos, fotos, primero]) => {
            if (!vigente) return;
            setResumen({
                mensajes: todos.count ?? 0,
                fotos: fotos.count ?? 0,
                desde: primero.data?.created_at ?? null,
            });
        }).catch(() => { if (vigente) setResumen({ mensajes: 0, fotos: 0, desde: null }); });

        /* Lo único que de verdad puede salir mal. Se excluyen las pruebas del
           equipo: avisar por un pedido de prueba enseña a ignorar el aviso. */
        const claves = new Set(telefonos.map(clave));
        supabase.from('orders')
            .select('customer_phone')
            .in('customer_phone', telefonos.flatMap(variantes))
            .eq('es_prueba', false)
            .in('status', VIVOS)
            .then(({ data }) => {
                if (!vigente) return;
                const filas = (data || []).filter(o => claves.has(clave(o.customer_phone)));
                setPedidos({
                    vivos: filas.length,
                    conversaciones: new Set(filas.map(o => clave(o.customer_phone))).size,
                });
            })
            .catch(() => { if (vigente) setPedidos({ vivos: 0, conversaciones: 0 }); });

        return () => { vigente = false; };
    }, [telefonos]);

    /* Escape cierra, y el foco arranca en el campo: quien abrió esto por error
       sale con una tecla, y quien lo abrió a propósito escribe de una. Mientras
       se borra, Escape no cierra: cerrar a media faena deja restos. */
    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape' && !borrando) onClose(); };
        window.addEventListener('keydown', alTeclear);
        entradaRef.current?.focus();
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onClose, borrando]);

    const ayuda = useMemo(() => {
        if (!codigo.trim()) {
            return enLote
                ? 'Cuántas conversaciones se van a borrar.'
                : 'Los cuatro últimos dígitos del número de arriba.';
        }
        if (coincide) return enLote ? 'Coincide. Ya puedes eliminarlas.' : 'Coincide. Ya puedes eliminar la conversación.';
        return enLote ? `No coincide: son ${esperado}.` : `No coincide con …${esperado}.`;
    }, [codigo, coincide, esperado, enLote]);

    const descargar = async (formato) => {
        if (descargando) return;
        setDescargando(true); setError('');
        const { error: err } = await descargarChat(telefonos, formato);
        setDescargando(false);
        if (err) setError(`no se pudo descargar: ${err}`);
    };

    /**
     * Se borra de una en una y se lleva la cuenta de las que fallan.
     *
     * Nada de `Promise.all`: si una falla a mitad de camino hay que poder decir
     * cuál, y las que sí se fueron tienen que salir de la lista aunque el resto
     * se quede. Un lote que falla entero por una es peor que un lote a medias
     * que dice exactamente por dónde va.
     */
    const eliminar = async () => {
        if (!coincide || borrando) return;
        setBorrando(true); setError(''); setFallos([]);

        const buenos = [];
        const malos = [];
        for (let i = 0; i < lista.length; i++) {
            setProgreso({ hecho: i, total: lista.length });
            const { error: err } = await borrarTodoDe(lista[i].telefono);
            if (err) malos.push({ telefono: lista[i].telefono, error: err });
            else buenos.push(lista[i].telefono);
        }

        setBorrando(false);
        setProgreso(null);

        if (malos.length) {
            setFallos(malos);
            setCodigo('');
            if (buenos.length) onDeleted(buenos, { abierto: true });
            return;
        }
        onDeleted(buenos);
    };

    if (!lista.length) return null;

    const mensajes = resumen?.mensajes ?? 0;
    const fotos = resumen?.fotos ?? 0;
    const conPedido = enLote ? (pedidos?.conversaciones ?? 0) : (pedidos?.vivos ?? 0);

    return (
        <div className="ep-velo" onClick={e => e.target === e.currentTarget && !borrando && onClose()}>
            <div className="ep-caja" role="dialog" aria-modal="true" aria-labelledby="ec-titulo">
                <button type="button" className="ep-cerrar" onClick={onClose} disabled={borrando} aria-label="Cerrar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>

                <div className="ep-banda">
                    <p className="ep-ante">Sin vuelta atrás</p>
                    <h2 id="ec-titulo" className="ep-titulo">
                        {enLote
                            ? <>Eliminar<br /><span>{lista.length} conversaciones.</span></>
                            : <>Eliminar la<br /><span>conversación.</span></>}
                    </h2>
                </div>

                <div className="ep-cuerpo">
                    <p className="ep-texto">
                        {enLote
                            ? <>Se borran los <strong>{lista.length}</strong> hilos marcados</>
                            : <>Se borra el hilo entero con <strong>{lista[0].nombre || lista[0].telefono}</strong></>}
                        {resumen === null ? '' : (
                            <>
                                {' '}—{' '}
                                {mensajes === 1 ? 'un mensaje' : `${num(mensajes)} mensajes`}
                                {fotos > 0 ? ` ${fraseFotos(fotos, enLote)}` : ''}
                                {resumen.desde ? `, desde el ${fmtFecha(resumen.desde)}` : ''}
                            </>
                        )}
                        . {enLote
                            ? 'Los pedidos, los datos y las notas de esas personas se conservan'
                            : 'Sus pedidos, sus datos y sus notas se conservan'};
                        lo que se va es lo que se dijeron.
                    </p>

                    <div className="ep-pieza">
                        <span className="punzon">{enLote ? `${lista.length} conversaciones` : lista[0].telefono}</span>
                        <span className="ep-detalle">
                            {resumen === null ? 'Contando…'
                                : mensajes === 1 ? '1 mensaje'
                                : `${num(mensajes)} mensajes`}
                        </span>
                    </div>

                    {/* La red antes de saltar. El diálogo dice "sin vuelta atrás";
                        lo menos que puede hacer es ofrecerte la copia. */}
                    <p className="ec-descargar">
                        {descargando ? 'Preparando la copia…' : (
                            <>
                                Llévate una copia antes:{' '}
                                {enLote ? (
                                    <button type="button" onClick={() => descargar('csv')}>descargar CSV</button>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => descargar('txt')}>TXT</button>
                                        {' · '}
                                        <button type="button" onClick={() => descargar('csv')}>CSV</button>
                                    </>
                                )}
                            </>
                        )}
                    </p>

                    {conPedido > 0 && (
                        <p className="ep-alerta">
                            <strong>
                                {enLote
                                    ? (conPedido === 1
                                        ? 'Una de las marcadas tiene un pedido sin entregar.'
                                        : `${conPedido} de las marcadas tienen pedidos sin entregar.`)
                                    : (conPedido === 1
                                        ? 'Este cliente tiene un pedido sin entregar.'
                                        : `Este cliente tiene ${conPedido} pedidos sin entregar.`)}
                            </strong>{' '}
                            El pedido no se borra, pero te quedas sin lo que pidió con sus
                            palabras y sin las fotos que mandó.
                        </p>
                    )}

                    {fallos.length > 0 && (
                        <div className="ec-fallos">
                            <p>
                                <strong>
                                    {fallos.length === 1
                                        ? 'Una no se pudo borrar y sigue en la lista:'
                                        : `${fallos.length} no se pudieron borrar y siguen en la lista:`}
                                </strong>
                            </p>
                            <ul>
                                {fallos.map(f => <li key={f.telefono}><span>{f.telefono}</span> — {f.error}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="ep-confirmar">
                        <label htmlFor="ec-codigo">
                            {enLote
                                ? 'Escribe cuántas son para confirmar'
                                : 'Escribe los cuatro últimos dígitos para confirmar'}
                        </label>
                        <input
                            id="ec-codigo"
                            ref={entradaRef}
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            autoComplete="off"
                            spellCheck="false"
                            placeholder={esperado}
                            value={codigo}
                            disabled={borrando}
                            onChange={e => { setCodigo(e.target.value.replace(/\D/g, '')); setError(''); }}
                            onKeyDown={e => { if (e.key === 'Enter' && coincide) { e.preventDefault(); eliminar(); } }}
                        />
                        <span className={`ep-ayuda${coincide ? ' ep-ayuda--ok' : ''}`}>{ayuda}</span>
                    </div>

                    {error && <p className="ep-error">No se pudo: {error}</p>}
                </div>

                <div className="ep-pie">
                    {progreso && (
                        <span className="ec-progreso">
                            Eliminando {progreso.hecho + 1} de {progreso.total}…
                        </span>
                    )}
                    <button type="button" className="ep-btn ep-btn--fantasma" onClick={onClose} disabled={borrando}>
                        {fallos.length ? 'Cerrar' : 'Cancelar'}
                    </button>
                    <button
                        type="button"
                        className="ep-btn ep-btn--borrar"
                        onClick={eliminar}
                        disabled={!coincide || borrando}
                    >
                        {borrando ? 'Eliminando…'
                            : enLote ? `Eliminar las ${lista.length}`
                            : 'Eliminar la conversación'}
                    </button>
                </div>
            </div>
        </div>
    );
}
