/**
 * El <head> de una pantalla, como un elemento más de su JSX.
 *
 * `ponerMeta()` de src/lib/meta.js ya hacía el trabajo, pero pide un efecto — y
 * las cuatro páginas que lo necesitaban son funciones flecha que devuelven JSX
 * directo. Meterles un efecto obligaba a reescribir las tres, y el diff sería
 * casi todo llaves.
 *
 * Así se pone una línea dentro del árbol que ya existe. No pinta nada: sólo
 * corre el efecto y devuelve null.
 *
 * Por qué hacía falta: privacidad, términos, devoluciones y guía de tallas no
 * llamaban a ponerMeta, así que heredaban título, descripción y CANÓNICA de la
 * portada — y las cuatro están en el sitemap. Eran cuatro URLs diciéndole a
 * Google que son la home.
 */
import { useEffect } from 'react';
import { ponerMeta } from '../lib/meta';

export default function Meta({ titulo, descripcion, ruta, imagen, tipo, robots }) {
    /* Devuelve su propia limpieza, que es lo que restaura el head al salir:
       sin ella, ir de los términos al catálogo dejaría puesto el título de los
       términos. */
    useEffect(
        () => ponerMeta({ titulo, descripcion, ruta, imagen, tipo, robots }),
        [titulo, descripcion, ruta, imagen, tipo, robots],
    );
    return null;
}
