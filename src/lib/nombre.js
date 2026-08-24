/**
 * Partir un nombre colombiano en nombre y apellidos.
 *
 * Hace falta porque 99envios pide `nombre` y `primerApellido` por separado
 * —los dos obligatorios— y el checkout guarda un solo campo, escrito por la
 * clienta. Escrito el 24 de agosto de 2026, para la fase 2 de esa integración.
 *
 * La regla que se usa aquí, que es la convención colombiana: **los dos últimos
 * trozos son los apellidos y lo de delante es el nombre.** Con tres trozos, el
 * último es el primer apellido y no hay segundo — «Sebastián López Rojas» es
 * más común que «Sebastián José López».
 *
 * **Con una sola palabra no se inventa nada.** Devuelve `null`, y quien llame
 * tiene que pedir que completen el nombre: un apellido inventado en una guía
 * es un paquete que el mensajero no entrega porque el documento no cuadra, y
 * eso cuesta el flete de ida y el de vuelta.
 *
 * Las partículas —«de», «del», «la», «los»— se pegan al apellido que
 * acompañan: «María de los Ángeles Ruiz» no tiene por apellido «Ángeles».
 */

/** Trozos que no son un apellido por sí solos: van pegados al siguiente. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'lo', 'los', 'y', 'da', 'do', 'san', 'santa']);

/**
 * @param {string|null} completo
 * @returns {{nombre:string, primerApellido:string, segundoApellido:string|null}|null}
 *          null cuando no hay con qué formar un apellido.
 */
export function partirNombre(completo) {
    const trozos = String(completo ?? '').trim().split(/\s+/).filter(Boolean);
    if (trozos.length < 2) return null;

    /* Las partículas se pegan hacia adelante, para que «de los Ángeles» sea
       una pieza y no tres. Se recorre desde el final por eso mismo. */
    const piezas = [];
    let arrastre = [];
    for (const t of trozos) {
        if (PARTICULAS.has(t.toLowerCase())) { arrastre.push(t); continue; }
        piezas.push([...arrastre, t].join(' '));
        arrastre = [];
    }
    /* Una partícula suelta al final no forma pieza: se cuelga de la última. */
    if (arrastre.length && piezas.length) piezas[piezas.length - 1] += ' ' + arrastre.join(' ');

    if (piezas.length < 2) return null;

    if (piezas.length === 2) {
        return { nombre: piezas[0], primerApellido: piezas[1], segundoApellido: null };
    }
    if (piezas.length === 3) {
        return { nombre: piezas[0], primerApellido: piezas[1], segundoApellido: piezas[2] };
    }
    /* Cuatro o más: los dos últimos son los apellidos. */
    return {
        nombre: piezas.slice(0, -2).join(' '),
        primerApellido: piezas[piezas.length - 2],
        segundoApellido: piezas[piezas.length - 1],
    };
}
