/**
 * Eliminar una pieza del catálogo.
 *
 * Antes era un «¿Seguro?» genérico con un botón rojo, el mismo diálogo que se
 * usaba para borrar un pedido o un cliente. Dos problemas con eso.
 *
 * El primero es que un solo clic mal dado borraba una ficha que costó fotos,
 * medidas y descripción. Ahora hay que escribir la referencia de la pieza: es
 * la fricción justa para que la mano no se adelante a la cabeza, y de paso
 * obliga a mirar cuál pieza es antes de confirmar.
 *
 * El segundo es que no decía qué se pierde ni qué se conserva. Esto sí: se
 * borran la ficha, las fotos y las medidas, y los pedidos ya hechos conservan
 * su copia — comprobado, las claves foráneas de orders y order_items son
 * ON DELETE SET NULL, así que el pedido sigue con su nombre y su precio.
 *
 * Y avisa si la pieza tiene pedidos vivos, que es lo único que de verdad
 * puede salir mal: el taller se queda sin la ficha de algo que todavía tiene
 * que fabricar.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

/* La misma referencia que se ve en la tarjeta del catálogo. */
const refDe = (p) => `AG-${String(p?.id ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0')}`;

/* En español los números pequeños se escriben con letra, y esta frase se lee
   como una frase, no como un informe. */
const CANTIDAD = ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const enLetra = (n) => CANTIDAD[n] ?? String(n);

const VIVOS = ['pendiente', 'pagado', 'procesando', 'enviado'];

export default function EliminarPieza({ product, onClose, onDeleted }) {
    const [ref, setRef] = useState('');
    const [borrando, setBorrando] = useState(false);
    const [error, setError] = useState('');
    const [pedidosVivos, setPedidosVivos] = useState(null);
    const entradaRef = useRef(null);

    const referencia = refDe(product);
    const coincide = ref.trim().toUpperCase() === referencia;

    const fotos = product?.images?.length ?? 0;

    /* Lo único que de verdad puede salir mal. Los pedidos conservan el nombre
       y el precio, pero no las fotos ni las medidas, y el taller las necesita
       para fabricar lo que ya se vendió. Se excluyen las pruebas del equipo:
       avisar por un pedido de prueba sería enseñar a ignorar el aviso. */
    useEffect(() => {
        if (!product?.id) return;
        let vigente = true;
        supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', product.id)
            .eq('es_prueba', false)
            .in('status', VIVOS)
            .then(({ count }) => { if (vigente) setPedidosVivos(count ?? 0); })
            .catch(() => { if (vigente) setPedidosVivos(0); });
        return () => { vigente = false; };
    }, [product?.id]);

    /* Escape cierra, y el foco arranca en el campo: quien abrió esto por error
       sale con una tecla, y quien lo abrió a propósito puede escribir de una. */
    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', alTeclear);
        entradaRef.current?.focus();
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onClose]);

    const ayuda = useMemo(() => {
        if (!ref.trim()) return 'La referencia está arriba, en el punzón.';
        return coincide ? 'Coincide. Ya puedes eliminar la pieza.' : `No coincide con ${referencia}.`;
    }, [ref, coincide, referencia]);

    const eliminar = async () => {
        if (!coincide || borrando) return;
        setBorrando(true); setError('');

        /* Se mira el error. El diálogo viejo hacía el delete y cerraba sin
           comprobar nada: si RLS o una clave foránea lo bloqueaban, la pieza
           seguía ahí y el panel decía que no. */
        const { error: err } = await supabase.from('products').delete().eq('id', product.id);
        setBorrando(false);
        if (err) { setError(err.message); return; }
        onDeleted(product);
    };

    if (!product) return null;

    return (
        <div
            className="ep-velo"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div
                className="ep-caja"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ep-titulo"
            >
                <button type="button" className="ep-cerrar" onClick={onClose} aria-label="Cerrar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>

                <div className="ep-banda">
                    <p className="ep-ante">Sin vuelta atrás</p>
                    <h2 id="ep-titulo" className="ep-titulo">
                        Eliminar la<br /><span>pieza entera.</span>
                    </h2>
                </div>

                <div className="ep-cuerpo">
                    <p className="ep-texto">
                        {/* "las una foto" no se dice. Con una es "la foto"; sin
                            ninguna la frase se salta el trozo entero en vez de
                            decir "las ninguna fotos". */}
                        Se borran la ficha, {fotos === 0 ? '' : fotos === 1 ? 'la foto ' : `las ${enLetra(fotos)} fotos `}
                        y las medidas de{' '}
                        <strong>{product.name}</strong>. Los pedidos ya hechos conservan su copia.
                    </p>

                    <div className="ep-pieza">
                        <span className="punzon">Ref. {referencia}</span>
                        <span className="ep-detalle">
                            {[product.metal, product.price ? `$${Math.round(product.price).toLocaleString('es-CO')}` : null]
                                .filter(Boolean).join(' · ')}
                        </span>
                    </div>

                    {/* El único aviso que importa: los pedidos guardan el nombre y
                        el precio, pero no las fotos ni las medidas, y el taller
                        todavía tiene que fabricar eso. */}
                    {pedidosVivos > 0 && (
                        <p className="ep-alerta">
                            <strong>
                                {pedidosVivos === 1
                                    ? 'Hay un pedido sin entregar con esta pieza.'
                                    : `Hay ${pedidosVivos} pedidos sin entregar con esta pieza.`}
                            </strong>{' '}
                            El pedido no se borra, pero el taller se queda sin las fotos ni las
                            medidas para fabricarlo.
                        </p>
                    )}

                    <div className="ep-confirmar">
                        <label htmlFor="ep-ref">Escribe la referencia para confirmar</label>
                        <input
                            id="ep-ref"
                            ref={entradaRef}
                            type="text"
                            autoComplete="off"
                            spellCheck="false"
                            placeholder={referencia}
                            value={ref}
                            onChange={e => { setRef(e.target.value); setError(''); }}
                            onKeyDown={e => { if (e.key === 'Enter' && coincide) { e.preventDefault(); eliminar(); } }}
                        />
                        <span className={`ep-ayuda${coincide ? ' ep-ayuda--ok' : ''}`}>{ayuda}</span>
                    </div>

                    {error && <p className="ep-error">No se pudo eliminar: {error}</p>}
                </div>

                <div className="ep-pie">
                    <button type="button" className="ep-btn ep-btn--fantasma" onClick={onClose}>Cancelar</button>
                    <button
                        type="button"
                        className="ep-btn ep-btn--borrar"
                        onClick={eliminar}
                        disabled={!coincide || borrando}
                    >
                        {borrando ? 'Eliminando…' : 'Eliminar la pieza'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export { refDe };
