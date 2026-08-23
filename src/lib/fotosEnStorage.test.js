/**
 * Qué archivos se borran cuando se borra una foto.
 *
 * Estas pruebas son de otra clase que las de `dinero.js`. Allí un error enseña
 * un número equivocado; aquí un error **borra archivos**, y en un bucket sin
 * papelera. Los dos fallos posibles no son simétricos:
 *
 *   · deducir de menos deja huérfanos — molesto, reversible, ya pasó;
 *   · deducir de MÁS borra la foto de otra pieza — y esa no vuelve.
 *
 * Por eso hay tantos casos de lo que NO debe tocarse.
 *
 * La deducción se comprobó una vez contra el bucket de producción el 23 de
 * agosto de 2026 —15 fotos en la base, 30 archivos deducidos, los 30 existían,
 * ni un falso positivo—, pero esa comprobación fue a mano y no se repite sola.
 * Esto sí.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const falso = vi.hoisted(() => ({ borradas: [], error: null }));

vi.mock('./supabase', () => ({
    supabase: {
        storage: {
            from: (bucket) => ({
                remove: async (rutas) => {
                    falso.borradas.push({ bucket, rutas });
                    return { data: null, error: falso.error };
                },
            }),
        },
    },
}));

const { rutaEnBucket, rutasDeFoto, borrarFotos, BUCKET } = await import('./fotosEnStorage');

const RAIZ = 'https://proyecto.supabase.co/storage/v1/object/public/product-images';

beforeEach(() => { falso.borradas = []; falso.error = null; });

describe('rutaEnBucket', () => {
    it('saca la ruta de una URL pública del bucket', () => {
        expect(rutaEnBucket(`${RAIZ}/1755980000-abc-893x1600.webp`)).toBe('1755980000-abc-893x1600.webp');
    });

    it('deshace el escapado, porque Storage guarda el nombre sin escapar', () => {
        expect(rutaEnBucket(`${RAIZ}/foto%20con%20espacios.webp`)).toBe('foto con espacios.webp');
    });

    it('se queda con la ruta y no con lo que venga detrás del interrogante', () => {
        expect(rutaEnBucket(`${RAIZ}/1755980000-abc.webp?t=123`)).toBe('1755980000-abc.webp');
    });

    /* Una URL de fuera es la que alguien pegó a mano en el panel. No es
       nuestra y no se puede borrar, pero sobre todo: no debe contarse como
       una foto que se borró. */
    it('devuelve null para lo que no vive en este bucket', () => {
        expect(rutaEnBucket('https://otra-tienda.com/anillo.jpg')).toBeNull();
        expect(rutaEnBucket(`https://proyecto.supabase.co/storage/v1/object/public/chat-media/x.jpg`)).toBeNull();
        expect(rutaEnBucket('')).toBeNull();
        expect(rutaEnBucket(null)).toBeNull();
        expect(rutaEnBucket(undefined)).toBeNull();
        expect(rutaEnBucket(42)).toBeNull();
    });
});

describe('rutasDeFoto — la familia de una foto', () => {
    it('con la marca de medidas son cuatro: la grande, la gemela y las dos chicas', () => {
        expect(rutasDeFoto(`${RAIZ}/1755980000-abc-893x1600.webp`).sort()).toEqual([
            '1755980000-abc-893x1600.jpeg',
            '1755980000-abc-893x1600.webp',
            '1755980000-abc-w400.webp',
            '1755980000-abc-w800.webp',
        ]);
    });

    /* Las copias chicas cuelgan del nombre BASE, sin la marca. Es la parte
       que más fácil se escribe mal, y escribirla mal significa pedir el
       borrado de archivos que no existen —inofensivo— mientras los que sí
       existen se quedan —que es el fallo que esto viene a arreglar. */
    it('las copias chicas cuelgan del nombre pelado, no del que lleva la marca', () => {
        const rutas = rutasDeFoto(`${RAIZ}/1755980000-abc-893x1600.webp`);
        expect(rutas).toContain('1755980000-abc-w400.webp');
        expect(rutas).not.toContain('1755980000-abc-893x1600-w400.webp');
    });

    it('sin la marca son dos: no se inventan copias chicas que nunca se subieron', () => {
        expect(rutasDeFoto(`${RAIZ}/1755980000-abc.webp`).sort()).toEqual([
            '1755980000-abc.jpeg',
            '1755980000-abc.webp',
        ]);
    });

    it('una foto que se subió como JPEG también arrastra su gemela', () => {
        expect(rutasDeFoto(`${RAIZ}/1773936751997-7n14lq.jpeg`).sort()).toEqual([
            '1773936751997-7n14lq.jpeg',
        ]);
    });

    it('no repite rutas', () => {
        const rutas = rutasDeFoto(`${RAIZ}/1755980000-abc-893x1600.webp`);
        expect(rutas.length).toBe(new Set(rutas).size);
    });

    it('de una URL ajena no sale ninguna ruta', () => {
        expect(rutasDeFoto('https://otra-tienda.com/anillo.jpg')).toEqual([]);
        expect(rutasDeFoto(null)).toEqual([]);
    });

    /* El caso que de verdad da miedo: que la deducción de una foto alcance a
       otra. Los nombres llevan marca de tiempo y un sufijo aleatorio, así que
       dos fotos distintas nunca comparten base — pero conviene tenerlo escrito
       por si alguien cambia cómo se nombran. */
    it('la familia de una foto no toca la de otra', () => {
        const unas = rutasDeFoto(`${RAIZ}/1755980000-abc-893x1600.webp`);
        const otras = rutasDeFoto(`${RAIZ}/1755980001-xyz-893x1600.webp`);
        expect(unas.some(r => otras.includes(r))).toBe(false);
    });
});

describe('borrarFotos', () => {
    it('pide el borrado de la familia entera de cada foto, en una sola llamada', async () => {
        await borrarFotos([
            `${RAIZ}/1755980000-abc-893x1600.webp`,
            `${RAIZ}/1755980001-xyz.webp`,
        ]);
        expect(falso.borradas).toHaveLength(1);
        expect(falso.borradas[0].bucket).toBe(BUCKET);
        expect(falso.borradas[0].rutas.sort()).toEqual([
            '1755980000-abc-893x1600.jpeg',
            '1755980000-abc-893x1600.webp',
            '1755980000-abc-w400.webp',
            '1755980000-abc-w800.webp',
            '1755980001-xyz.jpeg',
            '1755980001-xyz.webp',
        ]);
    });

    it('la misma foto dos veces no se pide dos veces', async () => {
        const url = `${RAIZ}/1755980000-abc-893x1600.webp`;
        await borrarFotos([url, url]);
        expect(falso.borradas[0].rutas).toHaveLength(4);
    });

    it('sin nada que borrar no molesta a Storage', async () => {
        await borrarFotos([]);
        await borrarFotos(['https://otra-tienda.com/anillo.jpg']);
        await borrarFotos(null);
        expect(falso.borradas).toHaveLength(0);
    });

    /* No lanza a propósito: quien la llama ya hizo lo importante —borrar la
       pieza, guardar la ficha— y que el bucket se quede con basura no puede
       deshacer eso ni merecerse un error en la cara de quien está mirando. */
    it('si Storage falla, lo dice pero no lanza', async () => {
        falso.error = { message: 'se cayó' };
        const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await borrarFotos([`${RAIZ}/1755980000-abc.webp`]);
        expect(res.error).toEqual({ message: 'se cayó' });
        expect(consola).toHaveBeenCalled();
        consola.mockRestore();
    });
});
