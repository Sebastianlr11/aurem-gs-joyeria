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
import { acuseDe, glifoDeAcuse, ACUSE, resumenDelMensaje } from './comunes';

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
