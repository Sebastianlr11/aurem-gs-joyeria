/**
 * Qué está pasando con un pedido, y qué pasa si pulsas ese botón.
 *
 * Escrito el 24 de agosto de 2026 por un motivo que se dice mejor con un
 * ejemplo: **«Marcar entregado» en un contraentrega no cambia un color, declara
 * que entró medio millón de pesos.** Hace que la venta cuente completa en los
 * informes y le dice a Meta y a TikTok que ese anuncio vendió. Quien lleve una
 * semana en el panel no tiene forma de saberlo mirando la pantalla.
 *
 * Así que las consecuencias se escriben donde se toman las decisiones, y se
 * escriben aquí una sola vez: si mañana cambia lo que dispara un estado, esto
 * es lo único que hay que corregir y la pantalla se entera sola.
 *
 * Lo que dice este archivo tiene que cuadrar con el circuito de
 * `docs/specs/admin-pedidos.md`, que es la fuente de verdad.
 */
import { esContraentrega, porCobrarDe, recibidoDe } from './dinero';

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

/**
 * Lo que va a pasar si se confirma el cambio a `destino`.
 *
 * @returns {{ titulo: string, consecuencias: string[], grave: boolean }}
 *   `grave` es para lo que no se deshace desde el panel o mueve dinero.
 */
export function loQuePasa(pedido, destino) {
    const cod = esContraentrega(pedido);
    const falta = porCobrarDe(pedido);

    switch (destino) {
        case 'pagado':
            return {
                titulo: 'Confirmar el pago',
                consecuencias: [
                    `La venta pasa a contar completa: ${pesos(pedido?.amount)}`,
                    'Se le avisa a Meta y a TikTok que este anuncio vendió',
                ],
                grave: true,
            };

        case 'procesando':
            return {
                titulo: 'Empezar a fabricar',
                consecuencias: [
                    'El pedido pasa a la cola del taller',
                    'No cambia nada de la plata',
                ],
                grave: false,
            };

        case 'enviado':
            return {
                titulo: 'Marcar como enviado',
                consecuencias: [
                    'Se le manda el correo con el enlace de rastreo',
                    'Le llega un WhatsApp diciendo que va en camino',
                    ...(cod ? [`Sigue faltando cobrar ${pesos(falta)} en la puerta`] : []),
                ],
                grave: false,
            };

        case 'entregado':
            return cod
                ? {
                    titulo: 'Marcar como entregada',
                    consecuencias: [
                        `Estás declarando que el mensajero cobró los ${pesos(falta)} que faltaban`,
                        `La venta pasa a contar completa: ${pesos(pedido?.amount)}`,
                        'Se le avisa a Meta y a TikTok que este anuncio vendió',
                    ],
                    grave: true,
                }
                : {
                    titulo: 'Marcar como entregada',
                    consecuencias: [
                        'Cierra el pedido. Ya estaba pagado, así que la plata no cambia',
                    ],
                    grave: false,
                };

        case 'devuelto':
            return {
                titulo: 'La clienta no la recibió',
                consecuencias: [
                    cod
                        ? `El abono de ${pesos(recibidoDe(pedido))} se queda: para eso está, para cubrir el envío`
                        : 'Lo que pagó habrá que devolvérselo por fuera del panel',
                    `Los ${pesos(falta)} que faltaban dejan de estar por cobrar`,
                    /* Dicho así a propósito: el panel NO devuelve la pieza al
                       inventario solo. Nadie mueve `products.stock` en todo el
                       código, y casi todas las piezas lo tienen en null porque
                       el taller trabaja por encargo. Prometerlo sería mentir. */
                    'La pieza vuelve a tus manos: si le llevas inventario, ajústalo a mano',
                    'NO se le avisa a Meta ni a TikTok: no hubo venta',
                ],
                grave: true,
            };

        case 'cancelado':
            return {
                titulo: 'Cancelar el pedido',
                consecuencias: [
                    'El pedido deja de contar en los informes, como si no hubiera pasado',
                    ...(recibidoDe(pedido) > 0
                        ? [`Ojo: ya había entrado ${pesos(recibidoDe(pedido))}. El panel no lo devuelve solo`]
                        : []),
                ],
                grave: true,
            };

        default:
            return { titulo: 'Cambiar el estado', consecuencias: [], grave: false };
    }
}

/**
 * En qué punto está el pedido, dicho como se lo contarías a alguien.
 *
 * La etiqueta de estado dice **dónde** está; esto dice **qué falta**, que es lo
 * que se necesita para decidir si hay que hacer algo hoy.
 */
export function queFalta(pedido) {
    if (!pedido) return '';
    const cod = esContraentrega(pedido);

    switch (pedido.status) {
        case 'pendiente':
            return cod
                ? 'Nadie ha pagado nada todavía · escríbele y confirma la dirección'
                : 'Llenó el checkout y no pagó · escríbele por si se le cayó el pago';

        case 'confirmado':
            return `Abonó ${pesos(recibidoDe(pedido))} · falta que el taller la fabrique`;

        case 'pagado':
            return 'Pagó completo · falta que el taller la fabrique';

        case 'procesando':
            return 'El taller la está haciendo';

        case 'enviado': {
            const porDonde = pedido.carrier ? `Va por ${pedido.carrier}` : 'Va en camino';
            return cod
                ? `${porDonde} · falta cobrar ${pesos(porCobrarDe(pedido))} en la puerta`
                : `${porDonde} · ya está pagada`;
        }

        case 'entregado':
            return 'Llegó y quedó cobrada';

        case 'devuelto':
            return cod
                ? `Volvió sin entregarse · el abono de ${pesos(recibidoDe(pedido))} se quedó`
                : 'Volvió sin entregarse';

        case 'cancelado':
            return 'Cancelado · no cuenta en los informes';

        default:
            return '';
    }
}
