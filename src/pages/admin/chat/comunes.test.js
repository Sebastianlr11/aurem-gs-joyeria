/**
 * El acuse de un mensaje y el visto que lo dibuja.
 *
 * Se prueba lo que no se puede ver en pantalla sin mandar un mensaje de
 * verdad: **el estado del que acaba de salir**. Un mensaje recién enviado no
 * tiene todavía `delivery_status` —vive como `temp-…` hasta que WhatsApp
 * confirma—, y sin el apaño se quedaría en «enviado» desde el primer
 * fotograma, diciendo que llegó algo que aún no ha salido.
 *
 * En la conversación de pruebas los dos mensajes están ya confirmados, así que
 * ese caso no aparece nunca mirando el panel.
 */
import { describe, it, expect } from 'vitest';
import { acuseDe, glifoDeAcuse, ACUSE, resumenDelMensaje, esperaDesde, siguientePorAtender } from './comunes';

describe('acuseDe', () => {
    it('un mensaje recién salido está "enviando", no "enviado"', () => {
        expect(acuseDe({ id: 'temp-1755980000' })).toBe('sending');
    });

    it('lo que diga la base manda sobre el apaño', () => {
        expect(acuseDe({ id: 'temp-1', delivery_status: 'read' })).toBe('read');
        expect(acuseDe({ id: 'abc-123', delivery_status: 'delivered' })).toBe('delivered');
    });

    /* Un mensaje ya guardado sin acuse es de antes de que se guardaran: se da
       por enviado, que es lo único que se sabe con certeza. */
    it('un mensaje guardado sin acuse se da por enviado', () => {
        expect(acuseDe({ id: 'abc-123' })).toBe('sent');
        expect(acuseDe({})).toBe('sent');
        expect(acuseDe(null)).toBe('sent');
    });
});

describe('glifoDeAcuse', () => {
    /* Los tres glifos son los de WhatsApp a propósito: quien atiende el chat
       ya sabe leerlos sin que nadie se lo explique. */
    it('un punto mientras sale, un visto cuando salió, dos cuando llegó', () => {
        expect(glifoDeAcuse('sending')).toBe('·');
        expect(glifoDeAcuse('sent')).toBe('✓');
        expect(glifoDeAcuse('delivered')).toBe('✓✓');
        expect(glifoDeAcuse('read')).toBe('✓✓');
    });

    it('un estado desconocido no deja la burbuja sin visto', () => {
        expect(glifoDeAcuse('failed')).toBe('✓');
        expect(glifoDeAcuse(undefined)).toBe('✓');
    });

    it('cada estado tiene su explicación al pasar el cursor', () => {
        for (const estado of ['sending', 'sent', 'delivered', 'read', 'failed']) {
            expect(ACUSE[estado], estado).toBeTruthy();
        }
    });
});

describe('de qué va el último mensaje de la lista', () => {
    it('saca la plantilla y tira su nombre técnico', () => {
        expect(resumenDelMensaje('[plantilla: cotizacion_sin_cerrar] Maria · anillo'))
            .toEqual({ marca: 'Plantilla', texto: 'Maria · anillo' })
        /* Una plantilla sin variables deja la marca y ningún texto. */
        expect(resumenDelMensaje('[plantilla: en_camino]'))
            .toEqual({ marca: 'Plantilla', texto: '' })
    })

    it('traduce las marcas de medios a algo que se pueda leer', () => {
        expect(resumenDelMensaje('[audio]')).toEqual({ marca: 'Nota de voz', texto: '' })
        expect(resumenDelMensaje('[image]')).toEqual({ marca: 'Foto', texto: '' })
        expect(resumenDelMensaje('[reaction]')).toEqual({ marca: 'Reacción', texto: '' })
    })

    /* Una nota de voz ya transcrita trae la marca y el texto detrás. */
    it('conserva lo que venga después de la marca', () => {
        expect(resumenDelMensaje('[audio] hola quiero un anillo'))
            .toEqual({ marca: 'Nota de voz', texto: 'hola quiero un anillo' })
    })

    /* Un corchete que no es una marca conocida es texto: la clienta puede
       escribir lo que se le ocurra y no se le puede comer el mensaje. */
    it('un mensaje normal pasa entero y sin marca', () => {
        for (const t of ['Buenos días', '[hola] qué tal', '[PLANTILLA] gritando', '[123]']) {
            expect(resumenDelMensaje(t), t).toEqual({ marca: null, texto: t })
        }
    })

    it('sin mensaje no se rompe', () => {
        for (const nada of [null, undefined, '', '   ', 42, {}]) {
            expect(resumenDelMensaje(nada), String(nada)).toEqual({ marca: null, texto: '' })
        }
    })
})

/* ─── La tarjeta de arriba de la lista ────────────────────────────────────
 *
 * Se prueban las dos piezas del rediseño del 6 de septiembre de 2026 que
 * deciden algo: cuánto lleva esperando una conversación, y cuál es la
 * siguiente. Mirando el panel no se pueden comprobar —haría falta un chat
 * real que llevara cinco horas sin respuesta— y las dos se equivocan en
 * silencio: la tarjeta señalaría a la persona equivocada y nadie lo notaría,
 * porque la tarjeta siempre enseña a alguien. */
describe('cuánto lleva esperando', () => {
    const AHORA = new Date('2026-09-06T15:00:00Z').getTime();
    const hace = (min) => new Date(AHORA - min * 60000).toISOString();

    it('minutos, horas y días, en ese orden', () => {
        expect(esperaDesde(hace(40), AHORA)).toBe('40 min');
        expect(esperaDesde(hace(59), AHORA)).toBe('59 min');
        expect(esperaDesde(hace(60), AHORA)).toBe('1 h');
        expect(esperaDesde(hace(60 * 5), AHORA)).toBe('5 h');
        expect(esperaDesde(hace(60 * 23), AHORA)).toBe('23 h');
        expect(esperaDesde(hace(60 * 24), AHORA)).toBe('1 d');
        expect(esperaDesde(hace(60 * 24 * 3 + 5), AHORA)).toBe('3 d');
    });

    /* Lo que acaba de entrar no está esperando: decirlo en el mismo tono que
       cinco horas gasta el aviso justo cuando no hace falta. */
    it('menos de un minuto no es esperar', () => {
        expect(esperaDesde(hace(0), AHORA)).toBeNull();
        expect(esperaDesde(new Date(AHORA + 60000).toISOString(), AHORA)).toBeNull();
    });

    it('una fecha que no lo es no rompe la fila', () => {
        for (const nada of [null, undefined, '', 'ayer', {}]) {
            expect(esperaDesde(nada, AHORA), String(nada)).toBeNull();
        }
    });
});

describe('la siguiente por atender', () => {
    const c = (phone, min, last_role = 'user') => ({
        phone_number: phone,
        last_role,
        last_time: new Date(Date.UTC(2026, 8, 6, 15 - min, 0, 0)).toISOString(),
    });

    it('gana la que lleva más tiempo esperando, no la más reciente', () => {
        const lista = [c('a', 1), c('b', 9), c('c', 4)];
        expect(siguientePorAtender(lista, {})?.phone_number).toBe('b');
    });

    /* Los mismos tres requisitos del filtro «Por atender». Si dejaran de
       coincidir, la tarjeta ofrecería abrir algo que la lista de abajo no
       enseña. */
    it('un chat donde la última palabra es nuestra no espera a nadie', () => {
        expect(siguientePorAtender([c('a', 9, 'assistant')], {})).toBeNull();
    });

    it('lo cerrado y lo archivado no cuentan', () => {
        const lista = [c('vendido', 9), c('perdido', 8), c('guardado', 7), c('vivo', 2)];
        const estados = {
            vendido: { estado: 'vendido' },
            perdido: { estado: 'perdido' },
            guardado: { estado: 'atendiendo', is_archived: true },
        };
        expect(siguientePorAtender(lista, estados)?.phone_number).toBe('vivo');
    });

    /* Sin fila en `chat_status` el chat es `nuevo`, que sigue abierto: un lead
       que nadie ha tocado es exactamente lo que la tarjeta viene a rescatar. */
    it('un chat sin estado guardado cuenta como nuevo', () => {
        expect(siguientePorAtender([c('a', 3)], {})?.phone_number).toBe('a');
    });

    it('sin nada esperando la tarjeta no se pinta', () => {
        expect(siguientePorAtender([], {})).toBeNull();
        expect(siguientePorAtender(null, {})).toBeNull();
        expect(siguientePorAtender([c('a', 9, 'assistant')], {})).toBeNull();
    });
});
