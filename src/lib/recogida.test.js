/**
 * Quién viene por el paquete, y cuándo.
 *
 * Se prueba porque estas reglas no están en la API de 99envios —salen de sus
 * videos— y equivocarse no da error: da un paquete que se queda en el taller
 * con la guía pegada, esperando a un camión que nadie pidió.
 */
import { describe, it, expect } from 'vitest';
import { comoSeRecoge } from './recogida';

const alas = (h, m = 0) => new Date(2026, 7, 24, h, m);
const dice = (r, trozo) => r.avisos.some(a => a.includes(trozo));

describe('comoSeRecoge', () => {
    it('con Coordinadora y TCC la recogida se pide sola', () => {
        for (const t of ['Coordinadora', 'TCC']) {
            expect(comoSeRecoge(t, alas(9)).automatica).toBe(true);
        }
    });

    it('con las otras tres hay que ir a pedirla', () => {
        for (const t of ['Interrapidisimo', 'Servientrega', 'Envia']) {
            const r = comoSeRecoge(t, alas(9));
            expect(r.automatica).toBe(false);
            expect(dice(r, 'no se programa sola')).toBe(true);
        }
    });

    /* Las 11:30 deciden si la pieza sale hoy o mañana, que es lo que se le
       prometió a la clienta. */
    it('las 11:30 son la frontera', () => {
        expect(comoSeRecoge('Coordinadora', alas(11, 29)).aTiempo).toBe(true);
        expect(comoSeRecoge('Coordinadora', alas(11, 30)).aTiempo).toBe(false);
        expect(comoSeRecoge('Coordinadora', alas(11, 31)).aTiempo).toBe(false);
        expect(comoSeRecoge('Coordinadora', alas(0, 1)).aTiempo).toBe(true);
        expect(comoSeRecoge('Coordinadora', alas(23, 59)).aTiempo).toBe(false);
    });

    it('antes de las 11:30 dice que pasa hoy; después, que quizá mañana', () => {
        expect(dice(comoSeRecoge('Coordinadora', alas(9)), 'esta misma tarde')).toBe(true);
        expect(dice(comoSeRecoge('Coordinadora', alas(15)), 'esta tarde o mañana')).toBe(true);
    });

    /* La más traicionera: Envía cotiza parecido a Coordinadora y se elige sin
       pensar, pero con un envío suelto no viene nadie. */
    it('avisa de que Envía no recoge un solo envío', () => {
        expect(dice(comoSeRecoge('Envia', alas(9)), 'no recoge un solo envío')).toBe(true);
        for (const t of ['Coordinadora', 'TCC', 'Interrapidisimo', 'Servientrega']) {
            expect(dice(comoSeRecoge(t, alas(9)), 'no recoge un solo envío')).toBe(false);
        }
    });

    it('siempre dice algo, y nada vacío', () => {
        for (const t of ['Coordinadora', 'TCC', 'Interrapidisimo', 'Servientrega', 'Envia', 'Otro']) {
            for (const h of [8, 12, 18]) {
                const r = comoSeRecoge(t, alas(h));
                expect(r.avisos.length).toBeGreaterThan(0);
                for (const a of r.avisos) expect(a.trim().length).toBeGreaterThan(10);
            }
        }
    });
});
