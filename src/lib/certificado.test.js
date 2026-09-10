import { describe, it, expect } from 'vitest';
import {
    PATRON_CODIGO,
    nuevoCodigo,
    normalizarCodigo,
    nombreDePila,
    fechaLarga,
    pesoLegible,
    congelar,
    campos,
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

describe('congelar', () => {
    it('guarda la copia que el certificado va a enseñar para siempre', () => {
        expect(congelar({ pedido: PEDIDO, pieza: PIEZA, talla: '14' })).toEqual({
            cliente: 'María Fernanda',
            pieza: 'Anillo Esencia Imperial',
            referencia: 'AG-4573',
            metal: 'Oro 18k',
            piedra: 'Esmeralda colombiana natural',
            peso: '3,4 g',
            talla: '14',
            compradoEn: '2026-09-03T15:00:00Z',
            foto: 'https://x.supabase.co/product-images/a.webp',
        });
    });

    /* Una línea en blanco en un certificado lo desmiente. Lo que no se sabe no
       viaja: ni con cadena vacía, ni con null, ni con la clave puesta. */
    it('no deja ninguna clave vacía', () => {
        const datos = congelar({
            pedido: { customer_name: 'Ana Torres', product_name: 'Dije', created_at: '2026-09-03T15:00:00Z' },
            pieza: { id: PIEZA.id, name: 'Dije', metal: '  ', piedra: null },
        });
        expect(Object.keys(datos).sort()).toEqual(['cliente', 'compradoEn', 'pieza', 'referencia'].sort());
    });

    /* El peso de catálogo es el de la pieza de muestra; una fabricación a
       medida no pesa lo mismo, y el panel lo deja corregir antes de emitir. */
    it('el peso que se escribe a mano le gana al del catálogo', () => {
        expect(congelar({ pedido: PEDIDO, pieza: PIEZA, peso: 4.1 }).peso).toBe('4,1 g');
    });

    /* Un pedido tomado por WhatsApp de una pieza que ya no está en el catálogo
       sigue mereciendo su certificado. */
    it('sin pieza en el catálogo se apoya en lo que guardó el pedido', () => {
        const datos = congelar({ pedido: PEDIDO, pieza: null });
        expect(datos.pieza).toBe('Anillo Esencia Imperial');
        expect(datos.referencia).toBeUndefined();
    });
});

describe('campos', () => {
    it('enseña las líneas en el orden del documento', () => {
        const lista = campos(congelar({ pedido: PEDIDO, pieza: PIEZA, talla: '14' }));
        expect(lista.map((c) => c.etiqueta)).toEqual([
            'Pieza', 'Referencia', 'Metal', 'Piedra', 'Peso', 'Talla', 'Fecha de compra',
        ]);
        expect(lista.at(-1).valor).toBe('3 de septiembre de 2026');
    });

    it('salta las líneas que no tienen dato', () => {
        const lista = campos({ pieza: 'Dije', referencia: 'AG-0001' });
        expect(lista).toEqual([
            { etiqueta: 'Pieza', valor: 'Dije' },
            { etiqueta: 'Referencia', valor: 'AG-0001' },
        ]);
    });

    /* La foto no es una línea del documento: es la imagen que se compara con
       la pieza en la mano. Si se colara en la lista saldría una URL impresa. */
    it('la foto no sale como texto', () => {
        const lista = campos(congelar({ pedido: PEDIDO, pieza: PIEZA }));
        expect(JSON.stringify(lista)).not.toContain('supabase');
    });

    it('sin datos no revienta', () => {
        expect(campos(null)).toEqual([]);
    });
});

describe('urlDeCertificado', () => {
    /* Con www, igual que la canónica del resto del sitio: sin ella Google la
       cuenta como otra página y el QR lleva a una redirección de más. */
    it('lleva a la página pública, con www', () => {
        expect(urlDeCertificado('AG-4F7K2QX9')).toBe('https://www.auremgsjoyeria.com/certificado/AG-4F7K2QX9');
    });
});
