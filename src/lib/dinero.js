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
    const abono = Number(pedido.abono_monto) || 0;

    if (!esContraentrega(pedido)) {
        /* En línea sólo hay una plata y entra de golpe. `devuelto` da cero
           porque una pieza que se pagó entera y volvió se devuelve: si algún
           día se decide quedarse con algo, se cambia aquí y en la base. */
        return ['pagado', 'procesando', 'enviado', 'entregado'].includes(estado) ? total : 0;
    }

    // Entregado o cobrado: la plata ya se recogió entera.
    if (estado === 'entregado' || estado === 'pagado') return total;

    /* Con el abono pagado y nada más: confirmado (el taller no ha empezado),
       fabricando, o en camino. El resto está en el bolsillo de la clienta.

       Y `devuelto` también, que es la parte que sorprende: la pieza salió, no
       se recibió y volvió — pero **el abono se queda**. Es exactamente para lo
       que existe, cubrir el flete de una entrega que no se cerró. */
    if (['confirmado', 'procesando', 'enviado', 'devuelto'].includes(estado)) return abono;

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
    /* Se pregunta por `estaVivo` en vez de repetir la lista de estados, que es
       lo que hacía antes: el comentario de arriba ya decía «pedidos vivos» y el
       código llevaba su propia copia. Al nacer `devuelto` las dos se separaron
       —un pedido devuelto dejaba el resto contado como por cobrar para
       siempre— y así no puede volver a pasar. */
    if (!estaVivo(pedido)) return 0;
    return Math.max(0, (Number(pedido.amount) || 0) - recibidoDe(pedido));
}

/**
 * Un pedido que sigue vivo: alguien se comprometió y la historia no ha
 * terminado.
 *
 * Fuera quedan los tres finales y el principio: `cancelado` (nunca pasó),
 * `pendiente` (nadie ha pagado nada todavía) y `devuelto` (salió, volvió, y no
 * hay nada más que cobrar). Un devuelto que siguiera vivo dejaría el resto del
 * importe contado como «por cobrar» para siempre, esperando una plata que no
 * va a llegar.
 */
export const estaVivo = (pedido) =>
    !!pedido && !['cancelado', 'pendiente', 'devuelto'].includes(pedido.status);

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

/* ─── Lo que Mercado Pago deposita de verdad ──────────────────────────
 *
 * Un cobro de $500.000 por Mercado Pago no son $500.000 en la cuenta: la
 * comisión, su IVA y las dos retenciones se descuentan antes de que llegue.
 * Ronda el 5%, que en un negocio con márgenes de joyería no es ruido.
 *
 * Vive aquí porque la misma fórmula estaba escrita DOS veces dentro de
 * Dashboard.jsx —una dentro de ingresosDe() y otra en calcMPNet()— y dos
 * copias de una cuenta de plata son dos copias que un día dejan de coincidir.
 * Es el mismo motivo por el que existe recibidoDe().
 *
 * Los números son los de Mercado Pago Colombia. Si cambian sus tarifas, se
 * cambian aquí y en ningún otro sitio.
 */
export const MP_COMISION      = 0.0329;   // 3,29% sobre el monto
export const MP_FIJO          = 800;      // $800 por transacción
export const MP_IVA_COMISION  = 0.19;     // 19% de IVA sobre la comisión
export const MP_RETE_FUENTE   = 0.015;    // 1,5% de retención en la fuente
export const MP_RETE_ICA      = 0.00414;  // ~0,414% de retención de ICA

/** Lo que Mercado Pago descuenta de un cobro. Siempre positivo. */
export function costoDeMercadoPago(monto) {
    const bruto = Number(monto) || 0;
    if (bruto <= 0) return 0;
    const comision = (bruto * MP_COMISION + MP_FIJO) * (1 + MP_IVA_COMISION);
    return Math.ceil(comision + bruto * MP_RETE_FUENTE + bruto * MP_RETE_ICA);
}

/** Lo que queda en la cuenta después de que Mercado Pago se cobre lo suyo. */
export const netoDeMercadoPago = (monto) =>
    (Number(monto) || 0) - costoDeMercadoPago(monto);
