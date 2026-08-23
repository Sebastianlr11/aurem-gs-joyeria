/**
 * La referencia visible de una pieza: AG-0000.
 *
 * Se saca de los últimos cuatro dígitos del uuid. No es un número de serie ni
 * pretende serlo — es algo corto que la clienta pueda leer por WhatsApp y que
 * el taller pueda buscar, sin enseñar un uuid de treinta y seis caracteres.
 *
 * Vive aquí porque estaba escrita dos veces: en EliminarPieza.jsx, donde hay
 * que teclearla para confirmar el borrado, y a mano dentro de ProductPage.jsx.
 * Si las dos se separaran, el diálogo pediría una referencia distinta de la que
 * la ficha enseña, y no habría forma de borrar la pieza.
 */
export const refDe = (p) =>
    `AG-${String(p?.id ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0')}`;
