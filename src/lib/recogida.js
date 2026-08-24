/**
 * Quién viene por el paquete, y cuándo.
 *
 * Escrito el 24 de agosto de 2026 con las reglas que 99envios explica en sus
 * videos y que **no están en su API**: si no se sabe esto, el paquete se queda
 * en el taller con la guía pegada esperando a un mensajero que nadie llamó.
 *
 * Son tres reglas y cada una muerde distinto:
 *
 *   1. La recogida automática **sólo existe para TCC y Coordinadora**, y sólo
 *      si el interruptor «solicitud automática» está encendido en su panel.
 *      Con las otras tres hay que ir a pedirla.
 *
 *   2. **Las 11:30 de la mañana** es la frontera. Una guía generada antes se
 *      recoge esa misma tarde; después, puede pasar esa tarde o al día
 *      siguiente. Importa porque decide si la pieza sale hoy o mañana, y eso
 *      es lo que se le prometió a la clienta.
 *
 *   3. **Envía no recoge un solo envío**: pide dos como mínimo. Las demás
 *      recogen desde uno. Es la regla más traicionera de las tres, porque
 *      Envía suele cotizar parecido a Coordinadora y se elige sin pensar.
 */

/** Recogen solas, si el interruptor de 99envios está encendido. */
export const RECOGIDA_AUTOMATICA = ['TCC', 'Coordinadora'];

/** Pide dos envíos como mínimo para venir. */
export const MINIMO_DOS = ['Envia'];

/** La hora a partir de la cual ya no se garantiza que pase hoy. */
export const CORTE_HORA = 11;
export const CORTE_MINUTO = 30;

/**
 * Qué hay que saber al emitir esta guía.
 *
 * @param {string} transportadora  como la escribe el panel
 * @param {Date}   ahora           para poder probarlo sin esperar a mañana
 * @returns {{automatica: boolean, aTiempo: boolean, avisos: string[]}}
 */
export function comoSeRecoge(transportadora, ahora = new Date()) {
    const automatica = RECOGIDA_AUTOMATICA.includes(transportadora);
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const aTiempo = minutos < CORTE_HORA * 60 + CORTE_MINUTO;

    const avisos = [];

    if (automatica) {
        avisos.push(aTiempo
            ? 'La recogida se pide sola y, por ser antes de las 11:30, el camión pasa esta misma tarde.'
            : 'La recogida se pide sola, pero ya pasaron las 11:30: puede pasar esta tarde o mañana.');
    } else {
        avisos.push(`Con ${transportadora} la recogida no se programa sola: entra a 99envios y pídela, ` +
            'o el paquete se queda esperando a un mensajero que nadie llamó.');
        if (aTiempo) {
            avisos.push('Pídela ahora, que antes de las 11:30 todavía alcanza a pasar hoy.');
        }
    }

    if (MINIMO_DOS.includes(transportadora)) {
        avisos.push(`${transportadora} no recoge un solo envío: necesita dos o más. ` +
            'Con uno suelto, o lo llevas a un punto o eliges otra transportadora.');
    }

    return { automatica, aTiempo, avisos };
}
