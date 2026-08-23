/**
 * La pantalla de una dirección que no existe.
 *
 * Antes no había ninguna: `App.jsx` no definía `path="*"`, así que cualquier
 * URL mal escrita caía en el rewrite de vercel.json y renderizaba una página
 * EN BLANCO, con el botón de WhatsApp flotando encima de la nada. Con pauta
 * encendida eso es un enlace viejo de una historia, o un dedo torpe, llevando
 * a un sitio que parece roto.
 *
 * Reutiliza el estado vacío del catálogo —mismas clases, mismo tono— y no por
 * ahorrar CSS: es literalmente la misma situación. Alguien buscaba algo que no
 * está, y en esta joyería eso nunca termina en "lo sentimos", termina en "se
 * puede hacer". El camino de salida es el mismo: el catálogo o una cotización.
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ponerMeta } from '../lib/meta';
import { waUrl } from '../lib/whatsapp';

const NoEncontrado = () => {
    /* noindex, y por eso hizo falta que ponerMeta supiera poner robots:
       index.html declara `index, follow` para todo el sitio, así que sin esto
       Google se dedicaría a coleccionar direcciones rotas.

       Lo que esto NO arregla: en una aplicación de una sola página sobre
       Vercel, esta pantalla responde HTTP 200 y no 404. Arreglarlo de verdad
       pide prerender o una función aparte; el noindex evita lo que importa. */
    useEffect(() => ponerMeta({
        titulo: 'Esta página no existe | Aurem Gs Joyería',
        descripcion: 'La dirección que buscas no está. Mira el catálogo o escríbenos y te cotizamos la pieza que tengas en mente.',
        ruta: '/404',
        robots: 'noindex, follow',
    }), []);

    const waCotizar = waUrl('Hola 🙏 Llegué a un enlace de su página que no funciona. ¿Me pueden ayudar?');

    return (
        <main className="catalogo-vacio">
            <span className="catalogo-vacio-icono">✦</span>
            <p className="catalogo-vacio-titulo">Esta página no existe</p>
            <p className="catalogo-vacio-texto">
                El enlace que seguiste no lleva a ninguna parte — puede que la pieza ya no
                esté publicada o que la dirección esté mal escrita. Lo que buscabas
                probablemente lo podemos hacer.
            </p>
            {/* El botón oscuro va primero, como en el resto del sitio. Acá el
                oscuro es el catálogo: quien cayó por un enlace roto casi
                siempre quería ver piezas, no escribir. */}
            <div className="catalogo-vacio-acciones">
                <Link to="/catalogo" className="btn-pill black">Ver el catálogo</Link>
                <a href={waCotizar} target="_blank" rel="noopener noreferrer" className="btn-pill light">
                    Escríbenos por WhatsApp
                </a>
            </div>
        </main>
    );
};

export default NoEncontrado;
