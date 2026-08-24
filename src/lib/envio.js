/**
 * La caja en la que viaja una pieza.
 *
 * 99envios cotiza y emite guías con **peso en kilogramos y medidas en
 * centímetros**, y hasta el 24 de agosto de 2026 el catálogo no guardaba
 * ninguna de las cuatro cosas.
 *
 * Viven en dos sitios y esto los junta: `taller_precios` guarda la caja por
 * defecto —casi toda la joyería viaja igual, un estuche dentro de un sobre
 * acolchado— y `products` guarda la excepción, con las cuatro columnas nulas
 * cuando no la hay.
 *
 * **Null no es cero.** Un peso de cero kilos no es un paquete ligero, es una
 * cotización rechazada o, peor, aceptada con un flete que no corresponde. Por
 * eso cualquier valor que no sea un número positivo cae al de por defecto.
 */

/** La caja de siempre, si en `taller_precios` todavía no hay nada. */
export const CAJA_POR_DEFECTO = { peso: 1, alto: 6, largo: 15, ancho: 12 };

const positivo = (v, respaldo) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : respaldo;
};

/**
 * Qué caja usar para esta pieza.
 *
 * @param {object|null} pieza    fila de `products`, con sus `envio_*` o sin ellos
 * @param {object|null} precios  fila de `taller_precios`
 * @returns {{peso:number, alto:number, largo:number, ancho:number}} siempre con
 *          los cuatro números positivos: quien llame no tiene que comprobarlo.
 */
export function cajaDe(pieza, precios) {
    const base = {
        peso: positivo(precios?.envio_peso_kg, CAJA_POR_DEFECTO.peso),
        alto: positivo(precios?.envio_alto_cm, CAJA_POR_DEFECTO.alto),
        largo: positivo(precios?.envio_largo_cm, CAJA_POR_DEFECTO.largo),
        ancho: positivo(precios?.envio_ancho_cm, CAJA_POR_DEFECTO.ancho),
    };
    return {
        peso: positivo(pieza?.envio_peso_kg, base.peso),
        alto: positivo(pieza?.envio_alto_cm, base.alto),
        largo: positivo(pieza?.envio_largo_cm, base.largo),
        ancho: positivo(pieza?.envio_ancho_cm, base.ancho),
    };
}

/**
 * La caja de un pedido de varias piezas.
 *
 * No es una suma: dos anillos no viajan en dos sobres, viajan en uno. Se toma
 * **la caja más grande de las piezas y se suman los pesos**, que es lo que
 * pasa de verdad cuando se empacan juntos. Es una aproximación, y por eso se
 * queda del lado seguro —el peso sube, las medidas no bajan—: una cotización
 * corta se paga en el flete, y una larga sólo cuesta unos pesos de más.
 */
export function cajaDelPedido(piezas = [], precios) {
    const cajas = (piezas.length ? piezas : [null]).map(p => cajaDe(p?.pieza ?? p, precios));
    const cuantas = (piezas.length ? piezas : [null]).map(p => positivo(p?.cantidad, 1));

    return {
        peso: cajas.reduce((t, c, i) => t + c.peso * cuantas[i], 0),
        alto: Math.max(...cajas.map(c => c.alto)),
        largo: Math.max(...cajas.map(c => c.largo)),
        ancho: Math.max(...cajas.map(c => c.ancho)),
    };
}
