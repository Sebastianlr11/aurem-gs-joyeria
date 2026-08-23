/**
 * La caja.
 *
 * Aquí lo que se prueba no es una fórmula, son tres decisiones que sólo se ven
 * mirando el código y que un cambio descuidado deshace sin que nada falle:
 *
 *   1. Que un abono cuenta como Mercado Pago aunque el pedido sea
 *      contraentrega. Es contraintuitivo —el pedido dice "contraentrega"— y es
 *      correcto: el abono se cobra en línea para confirmar y el saldo lo
 *      recibe el mensajero en efectivo. Son dos rieles distintos dentro del
 *      mismo pedido.
 *   2. Que la comisión se le descuenta SÓLO a lo que pasó por Mercado Pago.
 *      Antes se le descontaba a todo lo que no fuera contraentrega, Nequi y
 *      efectivo incluidos, que cobran otras comisiones o ninguna.
 *   3. Que el día de un movimiento es el día en Bogotá y no en UTC. Un cobro
 *      de las 10 de la noche cae en UTC al día siguiente, y con eso la caja
 *      diaria se corre un día entero.
 *
 * El cliente de Supabase se sustituye por uno de mentira. No es por evitar la
 * red: es que la prueba tiene que poder poner un reverso, un pago por Nequi y
 * un cobro a las diez de la noche, y la base de producción no tiene ninguna de
 * las tres cosas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const falso = vi.hoisted(() => ({ respuesta: { data: [], error: null }, llamadas: [] }));

vi.mock('./supabase', () => {
    /* El constructor de consultas de Supabase encadena y se espera al final.
       Lo de mentira hace lo mismo: cada método se apunta y se devuelve a sí
       mismo, y `then` lo vuelve esperable. */
    const constructor = () => {
        const b = {};
        for (const metodo of ['select', 'order', 'eq', 'gte', 'lte']) {
            b[metodo] = (...args) => { falso.llamadas.push([metodo, ...args]); return b; };
        }
        b.then = (ok, mal) => Promise.resolve(falso.respuesta).then(ok, mal);
        return b;
    };
    return { supabase: { from: (tabla) => { falso.llamadas.push(['from', tabla]); return constructor(); } } };
});

const { cajaEntre, cajaDeLosUltimos } = await import('./caja');

/* De un cobro de $500.000 por Mercado Pago quedan $469.902. La cuenta está
   desglosada en dinero.test.js; aquí se usa el número, no la fórmula. */
const NETO_500K = 469_902;

const pago = (extra) => ({
    monto: 500_000,
    concepto: 'total',
    medio: 'mercadopago',
    ocurrido_en: '2026-08-20T15:00:00.000Z',
    orders: { es_prueba: false },
    ...extra,
});

const responder = (data) => { falso.respuesta = { data, error: null }; };

beforeEach(() => {
    falso.respuesta = { data: [], error: null };
    falso.llamadas = [];
});

describe('a qué riel va cada movimiento', () => {
    it('el abono de un contraentrega cuenta como Mercado Pago: se cobra en línea para confirmar', async () => {
        responder([pago({ concepto: 'abono', medio: 'contraentrega', monto: 500_000 })]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.mercadoPago).toBe(NETO_500K);
        expect(caja.efectivo).toBe(0);
    });

    it('el saldo de un contraentrega es efectivo en la puerta: entra entero, sin comisión', async () => {
        responder([pago({ concepto: 'saldo', medio: 'contraentrega' })]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.efectivo).toBe(500_000);
        expect(caja.mercadoPago).toBe(0);
    });

    it('a Nequi no se le descuenta la comisión de Mercado Pago', async () => {
        responder([pago({ medio: 'nequi' })]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.total).toBe(500_000);
        expect(caja.efectivo).toBe(500_000);
    });

    it('los dos movimientos de un mismo pedido contraentrega van cada uno por su lado', async () => {
        responder([
            pago({ concepto: 'abono', medio: 'contraentrega', monto: 20_000 }),
            pago({ concepto: 'saldo', medio: 'contraentrega', monto: 530_000 }),
        ]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.efectivo).toBe(530_000);
        expect(caja.mercadoPago).toBeGreaterThan(0);
        expect(caja.mercadoPago).toBeLessThan(20_000);   // le mordieron la comisión
        expect(caja.total).toBe(caja.efectivo + caja.mercadoPago);
    });
});

describe('los reversos', () => {
    /* Una venta cobrada que se cancela vuelve en negativo y por su valor
       BRUTO, a propósito: Mercado Pago no devuelve su comisión cuando se cae
       una venta, así que restar el bruto deja la caja por lo bajo, que es el
       lado por el que conviene equivocarse. */
    it('restan el bruto, no el neto, y no se les aplica comisión al revés', async () => {
        responder([pago({ monto: -500_000 })]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.total).toBe(-500_000);
    });

    it('un cobro y su reverso dejan la caja en rojo por la comisión que no vuelve', async () => {
        responder([pago({ monto: 500_000 }), pago({ monto: -500_000 })]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.total).toBe(NETO_500K - 500_000);
        expect(caja.total).toBeLessThan(0);
    });
});

describe('en qué día cae cada peso', () => {
    it('un cobro de las 10 de la noche en Bogotá no se va al día siguiente', async () => {
        /* 2026-08-21T03:00:00Z son las 22:00 del 20 en Bogotá (UTC-5). Contado
           en UTC, este peso aparecería el 21. */
        responder([pago({ ocurrido_en: '2026-08-21T03:00:00.000Z', medio: 'nequi' })]);
        const { porDia } = await cajaEntre('2026-08-01');
        expect([...porDia.keys()]).toEqual(['2026-08-20']);
        expect(porDia.get('2026-08-20')).toBe(500_000);
    });

    it('varios movimientos del mismo día se suman en una sola entrada', async () => {
        responder([
            pago({ ocurrido_en: '2026-08-20T15:00:00.000Z', medio: 'nequi', monto: 100_000 }),
            pago({ ocurrido_en: '2026-08-20T21:00:00.000Z', medio: 'nequi', monto: 50_000 }),
            pago({ ocurrido_en: '2026-08-19T15:00:00.000Z', medio: 'nequi', monto: 7_000 }),
        ]);
        const { porDia, total } = await cajaEntre('2026-08-01');
        expect(porDia.get('2026-08-20')).toBe(150_000);
        expect(porDia.get('2026-08-19')).toBe(7_000);
        expect(total).toBe(157_000);
    });
});

describe('el lente de las pruebas', () => {
    it('por defecto los pedidos del equipo se quedan fuera', async () => {
        await cajaEntre('2026-08-01');
        expect(falso.llamadas).toContainEqual(['eq', 'orders.es_prueba', false]);
    });

    it('con el lente puesto entran, para que la caja no diga cero mientras la pantalla enseña pruebas', async () => {
        await cajaEntre('2026-08-01', null, { incluirPruebas: true });
        expect(falso.llamadas.some(l => l[0] === 'eq')).toBe(false);
    });
});

describe('el rango de fechas', () => {
    it('viaja en ISO, que es lo que entiende la base', async () => {
        await cajaEntre('2026-08-01', '2026-08-31');
        expect(falso.llamadas).toContainEqual(['gte', 'ocurrido_en', new Date('2026-08-01').toISOString()]);
        expect(falso.llamadas).toContainEqual(['lte', 'ocurrido_en', new Date('2026-08-31').toISOString()]);
    });

    it('sin fecha final no se pone tope', async () => {
        await cajaEntre('2026-08-01');
        expect(falso.llamadas.some(l => l[0] === 'lte')).toBe(false);
    });

    it('los últimos N días se cuentan hacia atrás desde ahora', async () => {
        const antes = Date.now();
        await cajaDeLosUltimos(30);
        const [, , desde] = falso.llamadas.find(l => l[0] === 'gte');
        const dias = (antes - new Date(desde).getTime()) / 86_400_000;
        expect(dias).toBeGreaterThan(29.9);
        expect(dias).toBeLessThan(30.1);
    });
});

describe('cuando la base falla', () => {
    /* Devolver la estructura vacía y no lanzar es deliberado: el panel pinta
       una caja en cero, que es visiblemente raro, en vez de romper la pantalla
       entera del dashboard por un error de red. */
    it('devuelve la caja vacía en vez de tumbar la pantalla', async () => {
        falso.respuesta = { data: null, error: { message: 'se cayó' } };
        const caja = await cajaEntre('2026-08-01');
        expect(caja).toEqual({ total: 0, mercadoPago: 0, efectivo: 0, porDia: new Map(), movimientos: [] });
    });

    it('sin movimientos, todo en cero', async () => {
        responder([]);
        const caja = await cajaEntre('2026-08-01');
        expect(caja.total).toBe(0);
        expect(caja.porDia.size).toBe(0);
    });
});
