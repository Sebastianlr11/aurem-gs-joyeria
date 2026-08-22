/**
 * Cuánta plata hay de verdad detrás de un pedido.
 *
 * Existe porque el panel tenía dos formas distintas de contar y ninguna
 * contaba bien el contraentrega, que es la forma de pago principal del
 * negocio.
 *
 * El error importaba: un pedido contraentrega en estado "enviado" figuraba
 * como $550.000 de ingresos cuando lo único que había entrado eran los
 * $20.000 del abono. Los otros $530.000 están en el bolsillo del cliente
 * hasta que el domiciliario toque la puerta. Con pauta encendida, eso es
 * calcular el retorno contra ingresos imaginarios.
 *
 * Y las dos formas se contradecían entre sí: la ficha del cliente en el chat
 * contaba una cosa y el dashboard otra, así que el mismo cliente daba
 * números distintos según dónde se mirara.
 */

/** Contraentrega: el cliente paga en la puerta, no al pedir. */
export const esContraentrega = (pedido) => pedido?.payment_method === 'contraentrega';

/**
 * Plata que YA está en la cuenta por este pedido.
 *
 * Pago en línea: entra completa cuando Mercado Pago aprueba.
 *
 * Contraentrega: entra en dos momentos. Primero el abono del envío, que es
 * lo que confirma el pedido. El resto sólo cuando la pieza llega a manos del
 * cliente — por eso "enviado" NO cuenta: el paquete va en camino y nadie ha
 * pagado nada todavía.
 */
export function recibidoDe(pedido) {
    if (!pedido) return 0;
    const estado = pedido.status;
    if (estado === 'cancelado' || estado === 'pendiente') return 0;

    const total = Number(pedido.amount) || 0;

    if (!esContraentrega(pedido)) {
        return ['pagado', 'procesando', 'enviado', 'entregado'].includes(estado) ? total : 0;
    }

    // Entregado o cobrado: la plata ya se recogió.
    if (estado === 'entregado' || estado === 'pagado') return total;

    // Confirmado o en camino: sólo el abono.
    if (estado === 'procesando' || estado === 'enviado') return Number(pedido.abono_monto) || 0;

    return 0;
}

/**
 * Plata comprometida que todavía falta cobrar.
 *
 * Son pedidos vivos —ni cancelados ni pendientes de confirmar— donde el
 * cliente ya se comprometió pero la plata no ha llegado entera. Verlo aparte
 * del recibido es la diferencia entre saber cuánto tienes y creer que tienes
 * lo que te deben.
 */
export function porCobrarDe(pedido) {
    if (!pedido) return 0;
    if (pedido.status === 'cancelado' || pedido.status === 'pendiente') return 0;
    return Math.max(0, (Number(pedido.amount) || 0) - recibidoDe(pedido));
}

/** Un pedido que sigue vivo: ni cancelado, ni esperando confirmación. */
export const estaVivo = (pedido) =>
    !!pedido && pedido.status !== 'cancelado' && pedido.status !== 'pendiente';

/** Lo recibido y lo que falta, de un conjunto de pedidos. */
export function resumenDe(pedidos = []) {
    const recibido = pedidos.reduce((s, o) => s + recibidoDe(o), 0);
    const porCobrar = pedidos.reduce((s, o) => s + porCobrarDe(o), 0);
    return {
        recibido,
        porCobrar,
        comprometido: recibido + porCobrar,
        vivos: pedidos.filter(estaVivo).length,
    };
}
