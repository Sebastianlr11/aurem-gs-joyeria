import { describe, it, expect } from 'vitest';
import {
    PATRON_CODIGO,
    nuevoCodigo,
    normalizarCodigo,
    nombreDePila,
    fechaLarga,
    pesoLegible,
    congelar,
    piezasDe,
    camposDePieza,
    posicionDePieza,
    resumenDePieza,
    urlDeCertificado,
} from './certificado';

describe('el código del certificado', () => {
    it('sale con la forma que espera la ruta pública', () => {
        expect(nuevoCodigo()).toMatch(PATRON_CODIGO);
    });

    /* Las parejas que se confunden al leer en voz alta o al teclear desde una
       tarjeta impresa. Si alguna entra al alfabeto, un certificado válido pasa
       a "no existe" y nadie sabe por qué. */
    it('nunca usa 0, O, 1, I ni L', () => {
        const muchos = Array.from({ length: 400 }, () => nuevoCodigo()).join('');
        expect(muchos).not.toMatch(/[01OIL]/);
    });

    it('no es consecutivo: dos seguidos no se parecen', () => {
        const unos = new Set(Array.from({ length: 200 }, () => nuevoCodigo()));
        expect(unos.size).toBe(200);
    });

    it('usa el azar que se le pasa, para poder probarlo', () => {
        expect(nuevoCodigo(() => 0)).toBe('AG-22222222');
    });
});

describe('normalizarCodigo', () => {
    it('acepta cómo lo teclea alguien desde una tarjeta impresa', () => {
        for (const escrito of ['AG-4F7K2QX9', 'ag-4f7k2qx9', '4F7K2QX9', 'ag 4f7k 2qx9', ' AG-4F7K2QX9 ']) {
            expect(normalizarCodigo(escrito)).toBe('AG-4F7K2QX9');
        }
    });

    it('rechaza lo que no es un código en vez de inventarse uno', () => {
        for (const basura of ['', null, 'AG-', 'AG-123', 'AG-4F7K2QX', 'AG-4F7K2QX99', '../../etc']) {
            expect(normalizarCodigo(basura)).toBeNull();
        }
    });

    /* Un código con una letra prohibida no es un código nuestro: si se
       normalizara "borrándola" se acabaría buscando otro certificado. */
    it('no salva un código con letras que el alfabeto no tiene', () => {
        expect(normalizarCodigo('AG-4F7K2QI9')).toBeNull();
    });
});

describe('nombreDePila', () => {
    /* La página del certificado es pública para quien tenga el enlace. Un
       apellido más una joya de varios millones es más de lo que hace falta
       contar a un desconocido. */
    it('deja el nombre y se queda con los apellidos', () => {
        expect(nombreDePila('María Fernanda Ruiz Gómez')).toBe('María Fernanda');
        expect(nombreDePila('Sebastián López Rojas')).toBe('Sebastián');
        expect(nombreDePila('Ana Torres')).toBe('Ana');
    });

    it('con una sola palabra la usa tal cual, sin inventarse nada', () => {
        expect(nombreDePila('Valentina')).toBe('Valentina');
    });

    it('con nada devuelve nada', () => {
        expect(nombreDePila(null)).toBe('');
        expect(nombreDePila('   ')).toBe('');
    });
});

describe('fechaLarga', () => {
    /* Un pedido de las 8 p. m. en Bogotá se guarda en UTC como el día
       siguiente. Sin la zona horaria el certificado diría una fecha de compra
       que no coincide con la que la clienta recuerda. */
    it('cuenta el día en Bogotá y no en UTC', () => {
        expect(fechaLarga('2026-09-04T02:30:00Z')).toBe('3 de septiembre de 2026');
    });

    it('con una fecha ilegible devuelve vacío, no "Invalid Date"', () => {
        expect(fechaLarga('mañana')).toBe('');
        expect(fechaLarga(null)).toBe('');
    });
});

describe('pesoLegible', () => {
    it('escribe el peso como lo escribiría una persona', () => {
        expect(pesoLegible(3.4)).toBe('3,4 g');
        expect(pesoLegible(3)).toBe('3 g');
        expect(pesoLegible('3.40')).toBe('3,4 g');
        expect(pesoLegible(12.75)).toBe('12,75 g');
    });

    /* Un peso en cero no es un peso: es un campo que nadie llenó, y en un
       certificado eso vale menos que no decir nada. */
    it('un peso que no existe no se escribe', () => {
        expect(pesoLegible(0)).toBe('');
        expect(pesoLegible(null)).toBe('');
        expect(pesoLegible('lo pesa el taller')).toBe('');
    });
});

const PEDIDO = {
    customer_name: 'María Fernanda Ruiz Gómez',
    product_name: 'Anillo Esencia Imperial',
    created_at: '2026-09-03T15:00:00Z',
};

const PIEZA = {
    id: '235cde01-0649-4b7a-b603-8a8263c45b73',
    name: 'Anillo Esencia Imperial',
    metal: 'Oro 18k',
    piedra: 'Esmeralda colombiana natural',
    peso_gramos: 3.4,
    images: ['https://x.supabase.co/product-images/a.webp'],
    image_url: 'https://x.supabase.co/product-images/vieja.webp',
};

const DIJE = {
    id: '39b65688-1f5b-41d0-9852-9ce3482bcc93',
    name: 'Dije de gota con asa curva',
    metal: 'Plata 925',
    piedra: 'esmeralda natural',
    image_url: 'https://x.supabase.co/product-images/dije.webp',
};

describe('congelar', () => {
    it('guarda la copia que el certificado va a enseñar para siempre', () => {
        expect(congelar({
            pedido: PEDIDO,
            piezas: [{ producto: PIEZA, talla: '14' }],
        })).toEqual({
            cliente: 'María Fernanda',
            compradoEn: '2026-09-03T15:00:00Z',
            piezas: [{
                nombre: 'Anillo Esencia Imperial',
                referencia: 'AG-4573',
                metal: 'Oro 18k',
                piedra: 'Esmeralda colombiana natural',
                peso: '3,4 g',
                talla: '14',
                foto: 'https://x.supabase.co/product-images/a.webp',
            }],
        });
    });

    /* El motivo de todo esto: un pedido lleva las piezas que sean, y el
       certificado es uno por pedido. Certificar sólo la primera deja a la
       clienta con un papel que no ampara la mitad de lo que compró. */
    it('certifica TODAS las piezas del pedido, no la primera', () => {
        const datos = congelar({
            pedido: PEDIDO,
            piezas: [{ producto: PIEZA, talla: '14' }, { producto: DIJE }],
        });
        expect(datos.piezas).toHaveLength(2);
        expect(datos.piezas.map((p) => p.nombre)).toEqual([
            'Anillo Esencia Imperial', 'Dije de gota con asa curva',
        ]);
    });

    /* Una línea en blanco en un certificado lo desmiente. Lo que no se sabe no
       viaja: ni con cadena vacía, ni con null, ni con la clave puesta. */
    it('no deja ninguna clave vacía', () => {
        const datos = congelar({
            pedido: { customer_name: 'Ana Torres', created_at: '2026-09-03T15:00:00Z' },
            piezas: [{ producto: { id: PIEZA.id, name: 'Dije', metal: '  ', piedra: null } }],
        });
        expect(Object.keys(datos).sort()).toEqual(['cliente', 'compradoEn', 'piezas']);
        expect(Object.keys(datos.piezas[0]).sort()).toEqual(['nombre', 'referencia']);
    });

    /* El peso de catálogo es el de la pieza de muestra; una fabricación a
       medida no pesa lo mismo, y el panel lo deja corregir antes de emitir. */
    it('el peso que se escribe a mano le gana al del catálogo', () => {
        const datos = congelar({ pedido: PEDIDO, piezas: [{ producto: PIEZA, peso: 4.1 }] });
        expect(datos.piezas[0].peso).toBe('4,1 g');
    });

    /* Un pedido tomado por WhatsApp de una pieza que ya no está en el catálogo
       sigue mereciendo su certificado. */
    it('sin pieza en el catálogo se apoya en el nombre que traiga', () => {
        const datos = congelar({ pedido: PEDIDO, piezas: [{ nombre: 'Anillo a la medida' }] });
        expect(datos.piezas[0].nombre).toBe('Anillo a la medida');
        expect(datos.piezas[0].referencia).toBeUndefined();
    });

    it('una línea sin nombre no llega a ser una pieza', () => {
        expect(congelar({ pedido: PEDIDO, piezas: [{ producto: PIEZA }, {}] }).piezas).toHaveLength(1);
    });
});

describe('piezasDe', () => {
    it('devuelve la lista de un certificado nuevo', () => {
        const datos = congelar({ pedido: PEDIDO, piezas: [{ producto: PIEZA }, { producto: DIJE }] });
        expect(piezasDe(datos)).toHaveLength(2);
    });

    /* Los certificados emitidos antes del 9 de septiembre de 2026 guardan una
       sola pieza en la raíz. NO se migran —un documento con fecha no se
       reescribe hacia atrás— así que hay que seguir sabiendo leerlos, o el
       papel que alguien tiene impreso deja de verificarse. */
    it('sigue leyendo el formato viejo, de una pieza en la raíz', () => {
        const viejo = {
            cliente: 'Sra',
            pieza: 'Anillo solitario clásico',
            referencia: 'AG-4573',
            metal: 'Plata 925',
            piedra: 'esmeralda natural',
            compradoEn: '2026-09-09T15:00:00Z',
        };
        expect(piezasDe(viejo)).toEqual([{
            nombre: 'Anillo solitario clásico',
            referencia: 'AG-4573',
            metal: 'Plata 925',
            piedra: 'esmeralda natural',
        }]);
    });

    it('sin datos no revienta', () => {
        expect(piezasDe(null)).toEqual([]);
        expect(piezasDe({})).toEqual([]);
    });
});

describe('camposDePieza', () => {
    it('enseña las líneas en el orden del documento', () => {
        const pieza = congelar({ pedido: PEDIDO, piezas: [{ producto: PIEZA, talla: '14' }] }).piezas[0];
        expect(camposDePieza(pieza).map((c) => c.etiqueta)).toEqual([
            'Metal', 'Piedra', 'Peso', 'Talla',
        ]);
    });

    it('salta las líneas que no tienen dato', () => {
        expect(camposDePieza({ nombre: 'Dije', metal: 'Plata 925' })).toEqual([
            { etiqueta: 'Metal', valor: 'Plata 925' },
        ]);
    });

    /* La referencia no es una característica de la joya sino su identificador,
       y los dos diseños la pintan aparte. Si volviera a la lista saldría dos
       veces en la misma pieza. */
    it('la referencia no va en la lista: se pinta aparte', () => {
        expect(camposDePieza({ referencia: 'AG-0001', metal: 'Plata 925' })
            .map((c) => c.etiqueta)).toEqual(['Metal']);
    });

    /* La foto no es una línea del documento: es la imagen que se compara con la
       pieza en la mano. Si se colara en la lista saldría una URL impresa. */
    it('la foto no sale como texto', () => {
        const pieza = congelar({ pedido: PEDIDO, piezas: [{ producto: PIEZA }] }).piezas[0];
        expect(JSON.stringify(camposDePieza(pieza))).not.toContain('supabase');
    });

    it('sin pieza no revienta', () => {
        expect(camposDePieza(null)).toEqual([]);
    });
});

describe('resumenDePieza', () => {
    it('pone la ficha en una línea, para la tarjeta', () => {
        const pieza = congelar({ pedido: PEDIDO, piezas: [{ producto: PIEZA, talla: '14' }] }).piezas[0];
        expect(resumenDePieza(pieza)).toBe('Oro 18k · Esmeralda colombiana natural · 3,4 g · Talla 14');
    });

    it('sin nada devuelve vacío, no una fila de separadores', () => {
        expect(resumenDePieza({ nombre: 'Dije' })).toBe('');
        expect(resumenDePieza(null)).toBe('');
    });
});

describe('posicionDePieza', () => {
    it('numera cuando hay varias', () => {
        expect(posicionDePieza(0, 3)).toBe('Pieza 1 de 3');
        expect(posicionDePieza(2, 3)).toBe('Pieza 3 de 3');
    });

    /* «Pieza 1 de 1» es un contador delatándose: quien compró una joya no
       necesita que le confirmen que es una. */
    it('con una sola no numera', () => {
        expect(posicionDePieza(0, 1)).toBe('La pieza');
    });
});

describe('urlDeCertificado', () => {
    /* Con www, igual que la canónica del resto del sitio: sin ella Google la
       cuenta como otra página y el QR lleva a una redirección de más. */
    it('lleva a la página pública, con www', () => {
        expect(urlDeCertificado('AG-4F7K2QX9')).toBe('https://www.auremgsjoyeria.com/certificado/AG-4F7K2QX9');
    });
});
