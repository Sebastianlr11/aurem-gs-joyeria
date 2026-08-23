/**
 * Borrar de Storage las fotos de una pieza.
 *
 * Hasta el 23 de agosto de 2026 eliminar una pieza borraba **sólo la fila**.
 * El diálogo decía, literalmente, «se borran la ficha, las tres fotos y las
 * medidas», y las fotos se quedaban en el bucket para siempre. No era sólo
 * espacio desperdiciado: era una promesa de la interfaz que no se cumplía, y
 * en una tienda que vende joyas por foto, una foto que sigue publicada en una
 * URL pública después de que le dijiste al panel que la borrara es un
 * problema, no un descuido.
 *
 * Lo mismo pasaba al quitar una foto de una pieza que ya existe: desaparecía
 * de la ficha y seguía en el bucket.
 *
 * ── Por qué hace falta este módulo y no un `remove(url)` ────────────────────
 *
 * Porque **una foto son hasta cuatro archivos**, y sólo uno de ellos está
 * guardado en la base:
 *
 *     1755980000-abc-893x1600.webp   la que se guarda en products.images[]
 *     1755980000-abc-893x1600.jpeg   la gemela para WhatsApp (no acepta WebP)
 *     1755980000-abc-w400.webp       las copias chicas del srcset
 *     1755980000-abc-w800.webp
 *
 * Los otros tres no aparecen en ninguna columna: **se deducen del nombre**,
 * igual que `fotoProducto.js` deduce el `srcset` para pintarlos. Si borras
 * sólo el que está en la base, te quedan tres huérfanos por foto.
 *
 * Ojo con la marca `-893x1600`: la llevan la grande y la gemela, y NO la
 * llevan las copias chicas, que cuelgan del nombre base pelado. Una foto sin
 * la marca es de antes de que existieran las copias, y entonces sólo hay dos
 * archivos. Ver `optimizarFoto.js` y `ProductModal.jsx:subirArchivo`.
 */
import { supabase } from './supabase';
import { ANCHOS } from './fotoProducto';

export const BUCKET = 'product-images';

/* `-893x1600.webp` al final. Misma expresión que en fotoProducto.js, y a
   propósito: si un día cambia la convención, cambian las dos o el borrado
   empieza a dejar basura sin avisar. */
const MARCA = /-(\d+)x(\d+)\.webp$/;

/**
 * La ruta dentro del bucket, o null si la URL no es de este bucket.
 *
 * Devuelve null a propósito para las URLs pegadas a mano en el panel, que
 * apuntan a otro sitio: intentar borrarlas no haría nada, pero tampoco
 * queremos contarlas como fotos que se borraron.
 */
export function rutaEnBucket(url) {
    if (typeof url !== 'string') return null;
    const corte = url.indexOf(`/${BUCKET}/`);
    if (corte === -1) return null;
    const ruta = url.slice(corte + BUCKET.length + 2).split('?')[0];
    return decodeURIComponent(ruta) || null;
}

/**
 * Todos los archivos que produjo una foto: la grande, la gemela de WhatsApp
 * y, si la marca dice que existen, las copias chicas del srcset.
 */
export function rutasDeFoto(url) {
    const ruta = rutaEnBucket(url);
    if (!ruta) return [];

    const rutas = [ruta];

    /* La gemela tiene el mismo nombre con otra extensión. Se pide siempre,
       aunque no sepamos si llegó a subirse: `remove` de una ruta que no
       existe no es un error, y lo caro sería el caso contrario. */
    const punto = ruta.lastIndexOf('.');
    if (punto > 0) rutas.push(`${ruta.slice(0, punto)}.jpeg`);

    const marca = MARCA.exec(ruta);
    if (marca) {
        const base = ruta.slice(0, -marca[0].length);
        ANCHOS.forEach(a => rutas.push(`${base}-w${a}.webp`));
    }

    return [...new Set(rutas)];
}

/**
 * Borra las fotos que ya no usa nadie.
 *
 * No lanza: quien la llama ya hizo lo importante —borrar la pieza, guardar la
 * ficha— y que el bucket se quede con basura no puede deshacer eso ni
 * merecerse un mensaje de error en la cara del usuario. Se devuelve el
 * resultado para poder dejarlo en consola.
 */
export async function borrarFotos(urls) {
    const rutas = [...new Set((urls || []).flatMap(rutasDeFoto))];
    if (!rutas.length) return { rutas: [], error: null };

    const { error } = await supabase.storage.from(BUCKET).remove(rutas);
    if (error) console.error('No se pudieron borrar las fotos de Storage:', error.message);
    return { rutas, error: error || null };
}
