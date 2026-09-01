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
   con huecos. $250.000 sin abono es el pedido típico de la tienda desde el 1
   de septiembre de 2026: en Bogotá el contraentrega no cobra nada por
   adelantado. `abono_monto: null` es como lo guarda create-preference. */
const EJEMPLO_COD = { amount: 250_000, payment_method: 'contraentrega', abono_monto: null, carrier: 'Interrapidísimo' };
const EJEMPLO_LINEA = { amount: 550_000, payment_method: 'mercadopago', carrier: 'Interrapidísimo' };

const CAMINOS = [
    {
        id: 'cod',
        titulo: 'Contraentrega',
        nota: 'Casi todos los pedidos. En Bogotá no abona nada: paga todo cuando recibe la pieza.',
        ejemplo: EJEMPLO_COD,
        pasos: [
            {
                estado: 'confirmado',
                quien: 'Lo pone el sistema solo: sin abono que esperar, el pedido nace confirmado',
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

/* Los pasos del despacho, incluidos los que ocurren fuera del panel.
   
   Escritos para que alguien que nunca ha despachado pueda hacerlo leyendo
   esto y nada más: dónde está el botón, qué pasa al pulsarlo, y qué se
   estropea si se hace mal. Están aquí y no sólo en la spec porque quien
   despacha tiene el panel abierto, no el repositorio. */
const DESPACHO = [
    {
        paso: '1. Mira cuánto cuesta mandarlo',
        donde: 'Panel · Pedidos · botón «Marcar enviado» de la fila',
        que: 'Se abre «Datos de envío». Pulsa «Cuánto cuesta mandarlo» y espera unos segundos.',
        pasa: 'Salen las transportadoras que pueden llevarlo, de la más barata a la más cara, con el flete y lo que cobran por recoger la plata en la puerta. Las que no pueden salen abajo, con el motivo. Al hacer clic en una, se rellena sola la casilla «Transportadora».',
        ojo: 'Envía aparece marcada «desde 2 envíos»: no viene por un paquete suelto. Si sólo mandas uno, elige otra o llévalo tú a un punto.',
    },
    {
        paso: '2. Pide la guía',
        donde: 'El mismo diálogo, botón «Pedir la guía a…»',
        que: 'Sale sólo cuando ya elegiste transportadora. Te pregunta si estás seguro y te dice cuánto va a cobrar el mensajero.',
        pasa: 'Se crea la guía en 99envios y el número aparece solo en «Número de guía». El costo del envío queda anotado en el pedido. Debajo te dice si hay que pedir la recogida o si se pide sola.',
        ojo: 'Desde este clic 99envios ya le escribe a la clienta diciendo que su envío existe. Pídela cuando la pieza esté empacada y lista para salir, no antes: si se queda dos días en el taller, ella lleva dos días esperándola.',
    },
    {
        paso: '3. Imprime el rótulo y pégalo',
        donde: '99envios · Envíos completos · «Solicitar PDF» en la fila de la guía',
        que: 'Descarga el PDF, imprímelo y pégalo al paquete.',
        pasa: 'Ese papel es lo que la transportadora lee para saber a dónde va y cuánto cobrar.',
        ojo: 'Si el PDF no abre, recarga la página y vuelve a pedirlo: es un problema conocido de su plataforma, no tuyo.',
    },
    {
        paso: '4. Consigue que lo recojan',
        donde: 'Con Coordinadora o TCC: nada, ya está. Con las otras: 99envios · Recolección',
        que: 'Marcas las guías que van a salir, pulsas «Realizar Recolección» y pones fecha. La hora es orientativa: el camión llega cuando le cuadra la ruta.',
        pasa: 'El camión pasa por la dirección que tengas registrada como sucursal en 99envios. Puedes verlas en «Mis recolecciones».',
        ojo: 'Antes de las 11:30 de la mañana el camión pasa esa misma tarde; después puede pasar hoy o mañana. Si la pieza tiene que salir hoy y ya pasaron las 11:30, llévala tú a un punto de la transportadora.',
    },
    {
        paso: '5. Genera el manifiesto y hazlo firmar',
        donde: '99envios · Envíos completos · Acciones rápidas',
        que: 'Imprime dos copias. Quien recibe los paquetes —el mensajero o la persona del punto— firma las dos.',
        pasa: 'Es tu prueba de que los paquetes salieron de tus manos. Sin él, si uno se pierde, es tu palabra contra la de ellos.',
        ojo: 'Hay dos tipos. El GENERAL va por transportadora y rango de fechas: úsalo cuando salgan varios el mismo día con la misma. El INDIVIDUAL va por las guías que marques en la tabla: para uno suelto, o cuando sólo salen algunos. Va uno por transportadora, y LA COPIA FIRMADA TE LA QUEDAS TÚ.',
    },
    {
        paso: '6. Marca el pedido como enviado',
        donde: 'Panel · el mismo diálogo · botón «Marcar como enviado»',
        que: 'Con la transportadora y la guía ya puestas.',
        pasa: 'Se le manda el correo con el enlace de rastreo y el pedido pasa a «Enviado». En contraentrega, el panel sigue diciendo cuánto falta cobrar en la puerta: la venta NO cuenta completa hasta que lo marques entregado.',
        ojo: 'Hazlo cuando el paquete ya salió de verdad, no cuando pediste la guía. Los WhatsApp de 99envios ya vienen saliendo desde el paso 2.',
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
            caminos, en orden, con lo que hace cada botón. El contraentrega usa un pedido
            de $250.000, que en Bogotá no abona nada; el de pago en línea, uno de $550.000.
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

        {/* El despacho en detalle. Es el paso con más manos fuera del panel
            —la transportadora, su plataforma, el camión— y el que más veces
            deja un paquete quieto por algo que nadie escribió en ningún sitio. */}
        <section className="guia-camino guia-camino--despacho">
            <h4 className="guia-camino-titulo">Despachar, paso a paso</h4>
            <p className="guia-camino-nota">
                Todo esto pasa dentro del botón «Marcar enviado», salvo lo que diga
                que se hace en 99envios.
            </p>
            <ol className="guia-despacho">
                {DESPACHO.map(p => (
                    <li key={p.paso}>
                        <span className="guia-despacho-paso">{p.paso}</span>
                        <p className="guia-despacho-donde">{p.donde}</p>
                        <p className="guia-despacho-que">{p.que}</p>
                        {p.pasa && <p className="guia-despacho-pasa"><strong>Qué pasa:</strong> {p.pasa}</p>}
                        {p.ojo && <p className="guia-despacho-ojo">{p.ojo}</p>}
                    </li>
                ))}
            </ol>
        </section>

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
