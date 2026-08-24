/**
 * Partir un nombre para la guía de envío.
 *
 * Se prueba porque el resultado va impreso en un rótulo que lee un mensajero:
 * un apellido mal partido es un paquete que no se entrega, y eso cuesta el
 * flete de ida y el de vuelta.
 */
import { describe, it, expect } from 'vitest';
import { partirNombre } from './nombre';

describe('partirNombre', () => {
    it('nombre y apellido', () => {
        expect(partirNombre('Sebastian Torres')).toEqual(
            { nombre: 'Sebastian', primerApellido: 'Torres', segundoApellido: null });
    });

    it('nombre y dos apellidos', () => {
        expect(partirNombre('Sebastian Lopez Rojas')).toEqual(
            { nombre: 'Sebastian', primerApellido: 'Lopez', segundoApellido: 'Rojas' });
    });

    it('dos nombres y dos apellidos', () => {
        expect(partirNombre('María José López Rojas')).toEqual(
            { nombre: 'María José', primerApellido: 'López', segundoApellido: 'Rojas' });
    });

    /* «de los Ángeles» es una pieza. Sin esto, el apellido salía «Ángeles». */
    it('las partículas se pegan al apellido que acompañan', () => {
        expect(partirNombre('María de los Ángeles Ruiz')).toEqual(
            { nombre: 'María', primerApellido: 'de los Ángeles', segundoApellido: 'Ruiz' });
        expect(partirNombre('Juan de la Cruz')).toEqual(
            { nombre: 'Juan', primerApellido: 'de la Cruz', segundoApellido: null });
    });

    /* Lo importante: no inventarse un apellido. */
    it('con una sola palabra no responde', () => {
        for (const n of ['Sebastian', '  Ana  ', '', null, undefined, '   ']) {
            expect(partirNombre(n)).toBeNull();
        }
    });

    it('sobrevive a los espacios de más', () => {
        expect(partirNombre('  sebastian    torres  ')).toEqual(
            { nombre: 'sebastian', primerApellido: 'torres', segundoApellido: null });
    });

    it('nunca devuelve un apellido vacío', () => {
        for (const n of ['Ana Maria de', 'Pedro de los', 'Luis y']) {
            const r = partirNombre(n);
            if (r) expect(r.primerApellido.trim().length).toBeGreaterThan(0);
        }
    });
});
