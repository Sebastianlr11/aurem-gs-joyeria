/**
 * Las cuentas de plata.
 *
 * Estas son las primeras pruebas del repositorio, y empiezan aquí por un
 * motivo: es el único archivo donde un error no se ve. Un fallo de CSS se
 * nota al abrir la pantalla y uno de enrutado tumba la página, pero una
 * cuenta mal hecha enseña un número redondo, con signo de pesos, perfectamente
 * creíble. Ya pasó: el panel daba por cobrados $550.000 de un pedido
 * contraentrega que iba en camino, cuando lo único que había entrado eran los
 * $20.000 del abono.
 *
 * La tabla de `recibidoDe` no es una lista de casos inventados: es la regla de
 * negocio de CLAUDE.md §8, escrita de forma que la máquina la pueda
 * comprobar. Si alguien cambia la regla, cambia esta tabla; si alguien rompe
 * la regla sin querer, la tabla lo dice.
 */
import { describe, it, expect } from 'vitest';
import {
    esContraentrega,
    recibidoDe,
    porCobrarDe,
    estaVivo,
    resumenDe,
    costoDeMercadoPago,
    netoDeMercadoPago,
} from './dinero';

const PRECIO = 550_000;
const ABONO = 20_000;

const enLinea = (status) => ({ status, amount: PRECIO, payment_method: 'mercadopago' });
const contraentrega = (status, abono = ABONO) =>
    ({ status, amount: PRECIO, payment_method: 'contraentrega', abono_monto: abono });

describe('recibidoDe — la tabla de CLAUDE.md §8', () => {
    /* [estado, lo que entró pagando en línea, lo que entró en contraentrega] */
    const TABLA = [
        ['pendiente',  0,       0],
        ['confirmado', 0,       ABONO],
        ['pagado',     PRECIO,  PRECIO],
        ['procesando', PRECIO,  ABONO],
        ['enviado',    PRECIO,  ABONO],
        ['entregado',  PRECIO,  PRECIO],
        ['devuelto',   0,       ABONO],
        ['cancelado',  0,       0],
    ];

    it.each(TABLA)('%s: en línea entran %i', (estado, linea) => {
        expect(recibidoDe(enLinea(estado))).toBe(linea);
    });

    it.each(TABLA)('%s: contraentrega entran %i, %i', (estado, _linea, cod) => {
        expect(recibidoDe(contraentrega(estado))).toBe(cod);
    });

    /* El error original, escrito como prueba para que no vuelva. Se deja
       aparte de la tabla aunque sea el mismo caso: una tabla se lee como una
       lista y esto hay que leerlo como una advertencia. */
    it('un contraentrega ENVIADO no cuenta como cobrado: el paquete va en camino y nadie ha pagado el resto', () => {
        const pedido = contraentrega('enviado');
        expect(recibidoDe(pedido)).toBe(ABONO);
        expect(recibidoDe(pedido)).not.toBe(PRECIO);
        expect(porCobrarDe(pedido)).toBe(PRECIO - ABONO);
    });
});

describe('recibidoDe — los bordes', () => {
    it('sin pedido, cero', () => {
        expect(recibidoDe(null)).toBe(0);
        expect(recibidoDe(undefined)).toBe(0);
    });

    it('un contraentrega sin abono anotado no inventa el abono', () => {
        expect(recibidoDe(contraentrega('procesando', null))).toBe(0);
        /* Sin la columna siquiera, que es como llega un pedido cargado a mano
           en el panel antes de que nadie anote el abono. */
        expect(recibidoDe({ status: 'enviado', amount: PRECIO, payment_method: 'contraentrega' })).toBe(0);
    });

    it('un importe que no es número se lee como cero, no como NaN', () => {
        expect(recibidoDe({ status: 'pagado', amount: null })).toBe(0);
        expect(recibidoDe({ status: 'pagado', amount: 'ochocientos' })).toBe(0);
    });

    /* `confirmado` dejó de ser un estado muerto el 23 de agosto de 2026: ahora
       significa «abonó el envío, el taller no ha empezado». En contraentrega
       eso son los $20.000 dentro; en pago en línea no significa nada —ese
       camino no pasa por ahí— y se queda en cero, que es lo prudente. */
    it('confirmado: el abono dentro en contraentrega, nada en pago en línea', () => {
        expect(recibidoDe(contraentrega('confirmado'))).toBe(ABONO);
        expect(porCobrarDe(contraentrega('confirmado'))).toBe(PRECIO - ABONO);

        const linea = enLinea('confirmado');
        expect(recibidoDe(linea)).toBe(0);
        expect(porCobrarDe(linea)).toBe(PRECIO);
        expect(estaVivo(linea)).toBe(true);
    });

    /* La parte que sorprende de `devuelto`: la pieza salió, no se recibió y
       volvió — pero el abono SE QUEDA. Es exactamente para lo que existe:
       cubrir el flete de una entrega que no se cerró. */
    it('devuelto: el abono se queda, y no queda nada por cobrar', () => {
        const pedido = contraentrega('devuelto');
        expect(recibidoDe(pedido)).toBe(ABONO);
        expect(porCobrarDe(pedido)).toBe(0);
        expect(estaVivo(pedido)).toBe(false);
    });

    /* Devuelto NO es cancelado, y la diferencia es plata: cancelado es «nunca
       pasó» y no deja nada; devuelto costó un flete y dejó el abono. */
    it('devuelto y cancelado no son lo mismo', () => {
        expect(recibidoDe(contraentrega('devuelto'))).toBe(ABONO);
        expect(recibidoDe(contraentrega('cancelado'))).toBe(0);
    });
});

describe('porCobrarDe', () => {
    it('lo cancelado y lo pendiente no se cuentan como plata comprometida', () => {
        expect(porCobrarDe(enLinea('cancelado'))).toBe(0);
        expect(porCobrarDe(enLinea('pendiente'))).toBe(0);
        expect(porCobrarDe(contraentrega('cancelado'))).toBe(0);
    });

    it('lo ya cobrado no deja saldo', () => {
        expect(porCobrarDe(enLinea('entregado'))).toBe(0);
        expect(porCobrarDe(contraentrega('entregado'))).toBe(0);
    });

    /* Un abono mayor que el precio no debería existir, pero si alguien lo
       teclea mal en el panel, la respuesta correcta es cero y no un número
       negativo que se reste de otros pedidos y descuadre el total. */
    it('nunca es negativo, aunque el abono anotado sea mayor que el precio', () => {
        expect(porCobrarDe(contraentrega('enviado', PRECIO * 2))).toBe(0);
    });
});

describe('estaVivo', () => {
    it('vivo es lo que empezó y no ha terminado', () => {
        ['confirmado', 'pagado', 'procesando', 'enviado', 'entregado'].forEach(s =>
            expect(estaVivo(enLinea(s)), s).toBe(true));
    });

    /* Los tres finales y el principio. Un devuelto que siguiera vivo dejaría
       el resto del importe contado como «por cobrar» para siempre, esperando
       una plata que no va a llegar. */
    it('no está vivo ni lo que no empezó ni lo que ya terminó', () => {
        ['pendiente', 'cancelado', 'devuelto'].forEach(s =>
            expect(estaVivo(enLinea(s)), s).toBe(false));
        expect(estaVivo(null)).toBe(false);
    });
});

describe('resumenDe', () => {
    it('suma lo recibido y lo que falta, y cuenta los vivos', () => {
        const pedidos = [
            enLinea('entregado'),          // 550.000 dentro
            contraentrega('enviado'),      // 20.000 dentro, 530.000 fuera
            enLinea('cancelado'),          // nada
            enLinea('pendiente'),          // nada
            contraentrega('devuelto'),     // 20.000 dentro, nada por cobrar
        ];
        expect(resumenDe(pedidos)).toEqual({
            recibido: PRECIO + ABONO + ABONO,     // el devuelto deja su abono
            porCobrar: PRECIO - ABONO,            // pero no deja nada por cobrar
            comprometido: PRECIO * 2 + ABONO,
            vivos: 2,                             // el devuelto ya terminó
        });
    });

    it('sin pedidos, todo en cero y sin explotar', () => {
        expect(resumenDe()).toEqual({ recibido: 0, porCobrar: 0, comprometido: 0, vivos: 0 });
    });
});

describe('esContraentrega', () => {
    it('sólo el método contraentrega, no cualquier cosa que no sea Mercado Pago', () => {
        expect(esContraentrega({ payment_method: 'contraentrega' })).toBe(true);
        expect(esContraentrega({ payment_method: 'mercadopago' })).toBe(false);
        expect(esContraentrega({ payment_method: 'nequi' })).toBe(false);
        expect(esContraentrega({})).toBe(false);
        expect(esContraentrega(null)).toBe(false);
    });
});

describe('lo que Mercado Pago descuenta', () => {
    /* La cuenta a mano, para que la prueba no sea la misma fórmula escrita dos
       veces —que no comprueba nada— sino el número al que tiene que llegar:

         comisión  (500.000 × 3,29% + 800) × 1,19 IVA  = 20.527,5
         retefuente 500.000 × 1,5%                     =  7.500
         ICA        500.000 × 0,414%                   =  2.070
                                                         ────────
                                                         30.097,5 → 30.098 */
    it('de un cobro de $500.000 se queda $30.098', () => {
        expect(costoDeMercadoPago(500_000)).toBe(30_098);
        expect(netoDeMercadoPago(500_000)).toBe(469_902);
    });

    it('redondea hacia arriba: mejor que la cifra peque por lo bajo', () => {
        expect(Number.isInteger(costoDeMercadoPago(123_456))).toBe(true);
        expect(costoDeMercadoPago(123_456)).toBeGreaterThanOrEqual(
            (123_456 * 0.0329 + 800) * 1.19 + 123_456 * 0.015 + 123_456 * 0.00414,
        );
    });

    it('ronda el 5% y nunca se come el cobro entero', () => {
        [100_000, 500_000, 4_500_000].forEach(monto => {
            const parte = costoDeMercadoPago(monto) / monto;
            expect(parte).toBeGreaterThan(0.04);
            expect(parte).toBeLessThan(0.07);
            expect(netoDeMercadoPago(monto)).toBeLessThan(monto);
            expect(netoDeMercadoPago(monto)).toBeGreaterThan(0);
        });
    });

    it('sin cobro no hay comisión, ni siquiera los $800 fijos', () => {
        expect(costoDeMercadoPago(0)).toBe(0);
        expect(costoDeMercadoPago(null)).toBe(0);
        expect(costoDeMercadoPago(-500)).toBe(0);
        expect(netoDeMercadoPago(0)).toBe(0);
    });
});
