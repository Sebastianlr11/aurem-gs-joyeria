/**
 * La caja en la que viaja una pieza.
 *
 * Se prueba porque estos cuatro números salen hacia una API que cobra por
 * ellos: quedarse corto se paga en el flete y pasarse infla la cotización por
 * peso volumétrico. Y porque el fallo más probable —un null que llega como
 * cero— no se ve: una cotización con peso 0 no parece rota, parece barata.
 */
import { describe, it, expect } from 'vitest';
import { cajaDe, cajaDelPedido, CAJA_POR_DEFECTO } from './envio';

const PRECIOS = { envio_peso_kg: 2, envio_alto_cm: 10, envio_largo_cm: 20, envio_ancho_cm: 15 };

describe('cajaDe', () => {
    it('sin nada, la caja de siempre', () => {
        expect(cajaDe(null, null)).toEqual(CAJA_POR_DEFECTO);
    });

    it('con taller_precios, la de la casa', () => {
        expect(cajaDe(null, PRECIOS)).toEqual({ peso: 2, alto: 10, largo: 20, ancho: 15 });
    });

    it('la pieza manda sobre la de la casa', () => {
        expect(cajaDe({ envio_peso_kg: 5 }, PRECIOS)).toEqual({ peso: 5, alto: 10, largo: 20, ancho: 15 });
    });

    /* El fallo que no se ve: null llegando como 0. Una cotización con peso
       cero no parece rota, parece barata. */
    it('un cero o un null caen a la de por defecto, no viajan como cero', () => {
        for (const malo of [null, undefined, 0, -3, '', 'kilo y medio', NaN]) {
            const c = cajaDe({ envio_peso_kg: malo }, PRECIOS);
            expect(c.peso).toBe(2);
        }
        expect(cajaDe({ envio_peso_kg: 0 }, { envio_peso_kg: 0 }).peso).toBe(CAJA_POR_DEFECTO.peso);
    });

    it('nunca devuelve un número que no sirva', () => {
        for (const c of [cajaDe(null, null), cajaDe({}, {}), cajaDe(null, PRECIOS)]) {
            for (const v of Object.values(c)) {
                expect(Number.isFinite(v)).toBe(true);
                expect(v).toBeGreaterThan(0);
            }
        }
    });
});

describe('cajaDelPedido', () => {
    /* Dos anillos no viajan en dos sobres. */
    it('suma los pesos y toma la caja más grande', () => {
        const piezas = [
            { pieza: { envio_peso_kg: 1, envio_alto_cm: 5 }, cantidad: 2 },
            { pieza: { envio_peso_kg: 3, envio_alto_cm: 20 }, cantidad: 1 },
        ];
        const c = cajaDelPedido(piezas, PRECIOS);
        expect(c.peso).toBe(1 * 2 + 3);
        expect(c.alto).toBe(20);
        expect(c.largo).toBe(20);
    });

    it('un pedido sin piezas usa la caja de la casa', () => {
        expect(cajaDelPedido([], PRECIOS)).toEqual({ peso: 2, alto: 10, largo: 20, ancho: 15 });
    });

    it('una cantidad rota cuenta como una', () => {
        expect(cajaDelPedido([{ pieza: null, cantidad: 0 }], PRECIOS).peso).toBe(2);
        expect(cajaDelPedido([{ pieza: null, cantidad: null }], PRECIOS).peso).toBe(2);
    });
});
