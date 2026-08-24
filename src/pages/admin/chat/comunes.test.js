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
import { acuseDe, glifoDeAcuse, ACUSE } from './comunes';

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
