/**
 * De una medida a una talla de anillo.
 *
 * Esta es la calculadora de la guía de tallas, sacada de `RingSizeGuide.jsx`
 * el 23 de agosto de 2026 por un motivo concreto: **Valentina tiene su propia
 * copia y las dos daban tallas distintas.**
 *
 * Usaban la misma tabla pero con tolerancias distintas, y sobre 531 medidas
 * entre 43 y 69,5 mm **discrepaban en el 29 %** — 55,9 mm era una 7,5 aquí y
 * una 8 en el chat. La clienta mide su dedo, lo comprueba en esta página y
 * después le escribe a Valentina: si le dan dos números, o desconfía —y ahí se
 * cae la venta— o se fabrica un anillo a medida con la talla equivocada, que no
 * tiene arreglo, porque esa pieza ya se hizo para ese dedo.
 *
 * No pueden compartir archivo: el sitio corre en el navegador y el bot en Deno,
 * y `supabase functions deploy` sólo empaqueta lo que hay dentro de su carpeta.
 * Así que son dos copias por obligación, y la garantía de que no vuelvan a
 * separarse es una prueba —`src/lib/talla.test.js`— que las barre a las dos
 * medida por medida y falla el build si alguna vez dejan de coincidir.
 *
 * **Si cambias algo de aquí, cámbialo también en
 * `supabase/functions/_shared/reglas.ts`.** La prueba te lo va a recordar.
 */

/* Tabla estándar de tallas US: circunferencia interior en milímetros.
   El diámetro se deriva dividiendo por π, no se guarda por separado. */
export const TALLAS = [
    ['3', 44.2], ['3.5', 45.5], ['4', 46.8], ['4.5', 48.0], ['5', 49.3],
    ['5.5', 50.6], ['6', 51.9], ['6.5', 53.1], ['7', 54.4], ['7.5', 55.7],
    ['8', 57.0], ['8.5', 58.3], ['9', 59.5], ['9.5', 60.8], ['10', 62.1],
    ['10.5', 63.4], ['11', 64.6], ['11.5', 65.9], ['12', 67.2], ['12.5', 68.5],
];

/**
 * Cuánto puede quedar el anillo más ajustado que el dedo y aun así darse por
 * bueno. Son 0,35 mm de circunferencia, o sea 0,11 mm de diámetro: menos de lo
 * que un dedo cambia entre la mañana y la tarde.
 */
export const TOLERANCIA_MM = 0.35;

/** Cuánto se puede salir de la tabla antes de mandar a fabricar a medida. */
export const HOLGURA_FUERA_MM = 0.6;

export const A_CIRCUNFERENCIA = {
    circunferencia_mm: v => v,
    circunferencia_cm: v => v * 10,
    diametro_mm: v => v * Math.PI,
    diametro_cm: v => v * 10 * Math.PI,
};

/**
 * @param {number} circunferencia  en milímetros
 * @returns {{talla: string, circunferencia: number, diametro: number} | null}
 *          null si se sale de la tabla y hay que fabricar a medida.
 */
export function tallaDeCircunferencia(circunferencia) {
    const c = Number(circunferencia);
    if (!Number.isFinite(c) || c <= 0) return null;
    if (c < TALLAS[0][1] - HOLGURA_FUERA_MM) return null;
    if (c > TALLAS[TALLAS.length - 1][1] + HOLGURA_FUERA_MM) return null;

    /* Entre dos tallas se toma la mayor: un anillo holgado se ajusta, uno
       apretado no entra. La tolerancia es lo único que permite bajar, y sólo
       por ese pelo. */
    const fila = TALLAS.find(f => f[1] >= c - TOLERANCIA_MM) || TALLAS[TALLAS.length - 1];
    return { talla: fila[0], circunferencia: fila[1], diametro: fila[1] / Math.PI };
}
