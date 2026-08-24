/**
 * La guía del recorrido de un pedido, dentro del panel.
 *
 * Existe porque el circuito completo estaba en `docs/specs/admin-pedidos.md`,
 * que es exactamente donde no lo va a leer quien tiene el panel abierto y una
 * clienta esperando al teléfono. Aquí se lee donde se trabaja.
 *
 * **Las frases de «qué pasa» NO están escritas aquí**: salen de
 * `src/lib/circuito.js`, las mismas que ve quien pulsa el botón. Si mañana
 * cambia lo que dispara un estado, se corrige allí y esta guía se entera sola.
 * Una guía con su propia copia del texto es una guía que va a mentir.
 */
import React from 'react';
import { loQuePasa, queFalta } from '../../../lib/circuito';
import { STATUS_META } from './comunes';
import { StatusBadge } from './piezas';

/* Un pedido de ejemplo por camino, para que las frases salgan con cifras y no
   con huecos. $550.000 y $20.000 de abono son un pedido típico de la tienda. */
const EJEMPLO_COD = { amount: 550_000, payment_method: 'contraentrega', abono_monto: 20_000, carrier: 'Interrapidísimo' };
const EJEMPLO_LINEA = { amount: 550_000, payment_method: 'mercadopago', carrier: 'Interrapidísimo' };

const CAMINOS = [
    {
        id: 'cod',
        titulo: 'Contraentrega con abono',
        nota: 'Casi todos los pedidos. Abona el envío para confirmar y paga el resto en la puerta.',
        ejemplo: EJEMPLO_COD,
        pasos: [
            {
                estado: 'pendiente',
                quien: 'Lo pone el sistema solo, cuando entra el pedido',
                boton: null,
            },
            {
                estado: 'confirmado',
                quien: 'Lo pone Mercado Pago solo, cuando ella paga el abono del envío',
                boton: null,
            },
            {
                estado: 'procesando',
                quien: 'Lo pones tú',
                boton: 'Empezar a fabricar',
                desde: 'confirmado',
            },
            {
                estado: 'enviado',
                quien: 'Lo pones tú, con la transportadora y la guía a la mano',
                boton: 'Marcar enviado',
                desde: 'procesando',
            },
            {
                estado: 'entregado',
                quien: 'Lo pones tú o el joyero, cuando la transportadora confirma que entregó y cobró',
                boton: 'Marcar entregado',
                desde: 'enviado',
            },
        ],
    },
    {
        id: 'linea',
        titulo: 'Pago en línea',
        nota: 'Paga la pieza completa antes de que el taller la toque. No hay nada que cobrar después.',
        ejemplo: EJEMPLO_LINEA,
        pasos: [
            {
                estado: 'pendiente',
                quien: 'Llenó el checkout y no llegó a pagar. Nadie está esperando nada',
                boton: null,
            },
            {
                estado: 'pagado',
                quien: 'Lo pone Mercado Pago solo, cuando el pago entra',
                boton: null,
            },
            {
                estado: 'procesando',
                quien: 'Lo pones tú',
                boton: 'Empezar a fabricar',
                desde: 'pagado',
            },
            {
                estado: 'enviado',
                quien: 'Lo pones tú, con la transportadora y la guía a la mano',
                boton: 'Marcar enviado',
                desde: 'procesando',
            },
            {
                estado: 'entregado',
                quien: 'Lo pones tú cuando llegó. Es un cierre, no un cobro',
                boton: 'Marcar entregado',
                desde: 'enviado',
            },
        ],
    },
];

/* Las dos salidas que no son el final feliz. Van aparte a propósito: no son
   pasos del recorrido, son lo que se hace cuando el recorrido se rompe. */
const SALIDAS = [
    {
        estado: 'devuelto',
        cuando: 'Salió y volvió sin entregarse: no estaba, no contestó, o no tenía la plata completa.',
        boton: '«No la recibió», en la fila del pedido',
    },
    {
        estado: 'cancelado',
        cuando: 'Nunca salió. Se arrepintió, o el pedido era un error.',
        boton: 'Cambiando el estado desde el detalle del pedido',
    },
];

const Paso = ({ paso, ejemplo }) => {
    const pasa = paso.boton ? loQuePasa({ ...ejemplo, status: paso.desde }, paso.estado) : null;
    return (
        <li className="guia-paso">
            <div className="guia-paso-cabeza">
                <StatusBadge status={paso.estado} />
                <span className="guia-paso-quien">{paso.quien}</span>
            </div>
            <p className="guia-paso-falta">{queFalta({ ...ejemplo, status: paso.estado })}</p>
            {pasa && (
                <div className="guia-paso-boton">
                    <span className="guia-boton-nombre">{paso.boton}</span>
                    <ul className={`ped-confirmar-lista${pasa.grave ? ' ped-confirmar-lista--pesa' : ''}`}>
                        {pasa.consecuencias.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                </div>
            )}
        </li>
    );
};

const GuiaDelCircuito = () => (
    <div className="admin-card guia-circuito">
        <div className="admin-card-head">
            <h3 className="admin-card-title">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Qué botón oprimir, y qué pasa cuando lo oprimes
                </span>
            </h3>
        </div>
        <p className="guia-intro">
            Un pedido recorre un camino distinto según cómo se pague. Lo de abajo son los dos
            caminos, en orden, con lo que hace cada botón. Los ejemplos usan un pedido
            de $550.000 con $20.000 de abono.
        </p>

        <div className="guia-caminos">
            {CAMINOS.map(c => (
                <section className="guia-camino" key={c.id}>
                    <h4 className="guia-camino-titulo">{c.titulo}</h4>
                    <p className="guia-camino-nota">{c.nota}</p>
                    <ol className="guia-pasos">
                        {c.pasos.map(p => <Paso key={p.estado} paso={p} ejemplo={c.ejemplo} />)}
                    </ol>
                </section>
            ))}
        </div>

        <section className="guia-camino guia-camino--salidas">
            <h4 className="guia-camino-titulo">Cuando no sale bien</h4>
            <ul className="guia-salidas">
                {SALIDAS.map(s => (
                    <li className="guia-salida" key={s.estado}>
                        <StatusBadge status={s.estado} />
                        <div>
                            <p className="guia-salida-cuando">{s.cuando}</p>
                            <p className="guia-salida-boton">Se marca con: {s.boton}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>

        {/* La regla que más se ha equivocado en este proyecto, dicha donde se
            trabaja y no sólo en un archivo de documentación. */}
        <p className="guia-regla">
            <strong>La regla de la plata.</strong> En contraentrega, un pedido en{' '}
            {STATUS_META.enviado.label.toLowerCase()} <strong>no cuenta como cobrado</strong>: el paquete va
            en camino y lo único que entró es el abono. La venta cuenta completa cuando lo marcas
            entregado. En pago en línea entra completa desde el principio.
        </p>
    </div>
);

export default GuiaDelCircuito;
