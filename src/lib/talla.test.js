/**
 * Que la guía del sitio y Valentina den SIEMPRE la misma talla.
 *
 * Esta es la única prueba del repositorio cuyo trabajo es comparar dos
 * implementaciones en vez de comprobar una. Existe porque no pueden compartir
 * archivo —el sitio corre en el navegador y el bot en Deno, y
 * `supabase functions deploy` sólo empaqueta lo que hay en su carpeta—, así que
 * son dos copias por obligación.
 *
 * El 23 de agosto de 2026 estaban desincronizadas y nadie lo sabía: la misma
 * tabla con tolerancias distintas, **discrepando en el 29 % de las medidas**.
 * Una clienta mide su dedo, lo comprueba en la guía y después escribe por
 * WhatsApp; dos números para el mismo dedo o le hacen desconfiar —y ahí se cae
 * la venta— o le fabrican un anillo a medida que no entra.
 *
 * Si alguien toca una de las dos y no la otra, esto tumba el build.
 */
import { describe, it, expect } from 'vitest';
import { TALLAS, A_CIRCUNFERENCIA, tallaDeCircunferencia } from './talla';
import {
    TALLAS as TALLAS_BOT,
    A_CIRCUNFERENCIA as UNIDADES_BOT,
    calcularTalla,
} from '../../supabase/functions/_shared/reglas.ts';

describe('la guía y Valentina', () => {
    it('parten de la misma tabla', () => {
        expect(TALLAS_BOT).toEqual(TALLAS);
    });

    it('convierten las unidades igual', () => {
        for (const unidad of Object.keys(A_CIRCUNFERENCIA)) {
            expect(UNIDADES_BOT[unidad], `falta ${unidad} en el bot`).toBeTypeOf('function');
            expect(UNIDADES_BOT[unidad](12.34)).toBeCloseTo(A_CIRCUNFERENCIA[unidad](12.34), 10);
        }
    });

    /* El barrido: cada décima de milímetro entre 43 y 69,5, que cubre la tabla
       entera y los dos bordes por fuera. Es donde se destapó el 29 %. */
    it('dan la misma talla en TODO el rango, milímetro a milímetro', () => {
        const discrepan = [];
        for (let c = 43.0; c <= 69.5; c = Math.round((c + 0.05) * 100) / 100) {
            const guia = tallaDeCircunferencia(c);
            const bot = calcularTalla(c, 'circunferencia_mm');

            const laGuia = guia ? guia.talla : 'a medida';
            const elBot = bot.ok ? bot.talla : 'a medida';
            if (laGuia !== elBot) discrepan.push(`${c} mm → guía ${laGuia}, Valentina ${elBot}`);
        }
        expect(discrepan, `${discrepan.length} medidas discrepan:\n` + discrepan.slice(0, 8).join('\n')).toEqual([]);
    });

    it('y también coinciden en la circunferencia y el diámetro que reportan', () => {
        for (let c = 44.0; c <= 69.0; c += 0.5) {
            const guia = tallaDeCircunferencia(c);
            const bot = calcularTalla(c, 'circunferencia_mm');
            if (!guia || !bot.ok) continue;
            expect(bot.diametro).toBeCloseTo(guia.diametro, 10);
        }
    });
});

describe('la calculadora de la guía', () => {
    it('entre dos tallas toma la mayor', () => {
        expect(tallaDeCircunferencia(55.0).talla).toBe('7.5');   // entre 54,4 y 55,7
    });

    /* La tolerancia es lo único que permite bajar de talla, y sólo por ese
       pelo: 0,35 mm de circunferencia son 0,11 de diámetro. */
    it('deja bajar de talla sólo dentro de la tolerancia', () => {
        expect(tallaDeCircunferencia(54.7).talla).toBe('7');     // 0,3 por encima de la 7
        expect(tallaDeCircunferencia(54.8).talla).toBe('7.5');   // 0,4: ya no
    });

    it('sale un poco de la tabla antes de mandar a fabricar a medida', () => {
        expect(tallaDeCircunferencia(43.7).talla).toBe('3');
        expect(tallaDeCircunferencia(43.5)).toBeNull();
        expect(tallaDeCircunferencia(69.0).talla).toBe('12.5');
        expect(tallaDeCircunferencia(69.2)).toBeNull();
    });

    it('una medida que no es un número no da talla', () => {
        expect(tallaDeCircunferencia(0)).toBeNull();
        expect(tallaDeCircunferencia(-5)).toBeNull();
        expect(tallaDeCircunferencia('hola')).toBeNull();
        expect(tallaDeCircunferencia(null)).toBeNull();
    });
});
