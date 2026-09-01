/**
 * Lo que el panel le dice a quien está a punto de pulsar un botón.
 *
 * Se prueba porque estas frases **no son decoración: son la única forma de que
 * alguien nuevo sepa lo que está haciendo.** «Marcar entregado» en un
 * contraentrega no cambia un color, declara que entró medio millón de pesos.
 *
 * Y porque una frase que se queda desfasada es peor que no tener frase: dice
 * con seguridad algo que ya no es verdad.
 */
import { describe, it, expect } from 'vitest';
import { loQuePasa, queFalta } from './circuito';

const PRECIO = 550_000;
const ABONO = 20_000;
const cod = (status, extra = {}) => ({ status, amount: PRECIO, payment_method: 'contraentrega', abono_monto: ABONO, ...extra });
const linea = (status) => ({ status, amount: PRECIO, payment_method: 'mercadopago' });

const dice = (r, trozo) => r.consecuencias.some(c => c.includes(trozo));

describe('marcar entregado', () => {
    /* El caso que motivó todo esto. */
    it('en contraentrega dice cuánta plata se está declarando cobrada', () => {
        const r = loQuePasa(cod('enviado'), 'entregado');
        expect(dice(r, '$530.000')).toBe(true);          // lo que faltaba
        expect(dice(r, '$550.000')).toBe(true);          // lo que pasa a contar
        expect(dice(r, 'Meta')).toBe(true);
        expect(r.grave).toBe(true);
    });

    /* En pago en línea es un trámite: la plata entró hace días. Decir lo mismo
       en los dos casos sería enseñar a ignorar el aviso. */
    it('en pago en línea no promete plata que ya estaba dentro', () => {
        const r = loQuePasa(linea('enviado'), 'entregado');
        expect(dice(r, 'la plata no cambia')).toBe(true);
        expect(dice(r, 'Meta')).toBe(false);
        expect(r.grave).toBe(false);
    });
});

describe('la clienta no la recibió', () => {
    it('dice que el abono se queda y por qué', () => {
        const r = loQuePasa(cod('enviado'), 'devuelto');
        expect(dice(r, '$20.000')).toBe(true);
        expect(dice(r, 'cubrir el envío')).toBe(true);
        expect(dice(r, 'vuelve a tus manos')).toBe(true);
        expect(dice(r, 'NO se le avisa')).toBe(true);
        expect(r.grave).toBe(true);
    });

    it('deja de haber plata por cobrar', () => {
        expect(dice(loQuePasa(cod('enviado'), 'devuelto'), '$530.000')).toBe(true);
    });

    /* Pagando en línea la devolución es al revés: hay que devolverle a ella, y
       el panel no lo hace solo. */
    it('en pago en línea avisa de que hay que devolverle', () => {
        expect(dice(loQuePasa(linea('enviado'), 'devuelto'), 'devolvérselo')).toBe(true);
    });
});

describe('cancelar', () => {
    it('avisa si ya había entrado plata, porque el panel no la devuelve', () => {
        expect(dice(loQuePasa(cod('confirmado'), 'cancelado'), 'no lo devuelve solo')).toBe(true);
        expect(dice(loQuePasa(cod('confirmado'), 'cancelado'), '$20.000')).toBe(true);
    });

    it('y no lo avisa cuando no ha entrado nada', () => {
        expect(dice(loQuePasa(cod('pendiente'), 'cancelado'), 'Ojo')).toBe(false);
    });
});

describe('los pasos que no mueven plata', () => {
    it('empezar a fabricar lo dice sin adornos', () => {
        const r = loQuePasa(cod('confirmado'), 'procesando');
        expect(dice(r, 'cola del taller')).toBe(true);
        expect(dice(r, 'No cambia nada de la plata')).toBe(true);
        expect(r.grave).toBe(false);
    });

    /* El aviso no sale al instante y quien pulsa el botón se queda mirando el
       chat: si el diálogo no dice «en la próxima hora», parece que falló. */
    it('empezar a fabricar avisa del WhatsApp y de que tarda', () => {
        const r = loQuePasa(cod('confirmado'), 'procesando');
        expect(dice(r, 'WhatsApp')).toBe(true);
        expect(dice(r, 'próxima hora')).toBe(true);
    });

    it('marcar enviado avisa de los dos mensajes que le van a llegar', () => {
        const r = loQuePasa(cod('procesando'), 'enviado');
        expect(dice(r, 'correo')).toBe(true);
        expect(dice(r, 'WhatsApp')).toBe(true);
        expect(dice(r, 'cobrar $530.000 en la puerta')).toBe(true);
    });

    it('y en pago en línea no habla de cobrar en la puerta', () => {
        expect(dice(loQuePasa(linea('procesando'), 'enviado'), 'en la puerta')).toBe(false);
    });
});

describe('queFalta — qué se lee en cada fila', () => {
    it('distingue los dos pendientes, que son trabajos distintos', () => {
        expect(queFalta(cod('pendiente'))).toContain('escríbele y confirma');
        expect(queFalta(linea('pendiente'))).toContain('no pagó');
    });

    it('dice cuánto abonó y qué falta', () => {
        expect(queFalta(cod('confirmado'))).toBe('Abonó $20.000 · falta que el taller la fabrique');
    });

    it('en camino dice por dónde va y cuánto falta cobrar', () => {
        expect(queFalta(cod('enviado', { carrier: 'Interrapidísimo' })))
            .toBe('Va por Interrapidísimo · falta cobrar $530.000 en la puerta');
        expect(queFalta(linea('enviado'))).toContain('ya está pagada');
    });

    it('aguanta un pedido sin transportadora sin decir "undefined"', () => {
        expect(queFalta(cod('enviado'))).toContain('Va en camino');
    });

    it('los tres finales se leen como finales', () => {
        expect(queFalta(cod('entregado'))).toContain('cobrada');
        expect(queFalta(cod('devuelto'))).toContain('el abono de $20.000 se quedó');
        expect(queFalta(cod('cancelado'))).toContain('no cuenta');
    });

    it('sin pedido no revienta', () => {
        expect(queFalta(null)).toBe('');
        expect(queFalta({ status: 'lo que sea' })).toBe('');
    });
});

/**
 * El contraentrega sin abono, que en Bogotá es el de todos los días desde el
 * 1 de septiembre de 2026.
 *
 * Se prueba porque el fallo es de los que sólo ve el joyero y nunca reporta:
 * el panel decía «el abono de $0 se queda», que no significa nada, en la
 * pantalla donde decide si marca un pedido como devuelto.
 */
describe('un contraentrega que no abonó nada', () => {
    const sinAbono = (status) =>
        ({ status, amount: 250_000, payment_method: 'contraentrega', abono_monto: null });

    it('al devolverse no habla de un abono que no existe', () => {
        const { consecuencias } = loQuePasa(sinAbono('enviado'), 'devuelto');
        const texto = consecuencias.join(' · ');
        expect(texto).not.toMatch(/abono de \$0/);
        expect(texto).toMatch(/no entró un peso/);
    });

    it('y la línea del pedido devuelto tampoco', () => {
        const linea = queFalta(sinAbono('devuelto'));
        expect(linea).not.toMatch(/abono de \$0/);
        expect(linea).toMatch(/no se cobró nada/);
    });

    /* Con abono sigue diciendo lo de siempre: el día que se vuelva a cobrar,
       esto tiene que seguir funcionando. */
    it('con abono sigue contando que se queda', () => {
        const conAbono = { status: 'devuelto', amount: 550_000, payment_method: 'contraentrega', abono_monto: 20_000 };
        expect(queFalta(conAbono)).toMatch(/20\.000/);
    });
});
