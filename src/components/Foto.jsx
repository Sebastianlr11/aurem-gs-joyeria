import React from 'react';

/**
 * Una foto del sitio, en WebP y del tamaño que hace falta.
 *
 * Las fotos estaban en JPEG y muy por encima de lo que se ven: las del
 * carrusel pesaban 147 KB para mostrarse a 290 píxeles de ancho. Con 4G
 * lento eso es medio megabyte que el cliente paga para ver lo mismo.
 *
 * El <img> con el JPEG original se queda como respaldo. Los navegadores que
 * entienden WebP —todos desde 2020— usan el <source>; el que no, cae al JPEG
 * y ve la página igual, sólo que más pesada. No hay razón para dejar a nadie
 * afuera por ahorrar unas líneas.
 *
 * `tamanos` es la pista para el navegador: cuánto va a ocupar la foto en
 * pantalla. Sin eso elige el archivo más grande "por si acaso" y todo el
 * trabajo no sirve de nada.
 */
export default function Foto({ nombre, anchos, tamanos, alt, className, ...resto }) {
    const juego = anchos.map((a) => `/assets/${nombre}-${a}.webp ${a}w`).join(', ');

    return (
        <picture>
            <source type="image/webp" srcSet={juego} sizes={tamanos} />
            <img src={`/assets/${nombre}.jpg`} alt={alt} className={className} {...resto} />
        </picture>
    );
}
