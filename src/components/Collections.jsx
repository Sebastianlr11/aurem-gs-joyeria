import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fotoProducto } from '../lib/fotoProducto';
import { coleccionesDe } from '../lib/portada';
import { usePiezasPublicadas } from '../lib/piezasPublicadas';
import { useAparecer, useAparecerGrupo } from '../lib/aparecer';

/* Cuántas caben en la rejilla: `repeat(3, 1fr)` en escritorio. Si el catálogo
   sólo da para dos, se pintan dos — la rejilla no las estira. */
const CUANTAS = 3;

/* Lo único que sigue escrito a mano, porque es voz y no dato. Cada frase
   describe lo que el taller sí hace en esa categoría: nada de platino ni de
   diamantes, que es lo que decía la versión anterior y no es verdad. */
const DESCRIPCION = {
    Anillos: 'Solitarios, argollas de matrimonio y anillos de caballero.',
    Collares: 'Cadenas y gargantillas, con la piedra que escojas.',
    Aretes: 'De gota y de argolla, en plata 925 y en oro.',
    Topos: 'Pequeños, para llevar todos los días.',
    Pulseras: 'Tejidas y de eslabón, en oro y en plata 925.',
    Dijes: 'Para colgar de tu cadena: esmeralda en bruto, filigrana, figuras.',
    Juegos: 'Dije y aretes de la misma familia, para llevarlos juntos.',
};

const Arrow = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="13 6 19 12 13 18" />
    </svg>
);

const Collections = () => {
    const cabecera = useAparecer();

    /* `null` mientras carga el catálogo. Si falla, `coleccionesDe` recibe una
       lista vacía y la sección se queda con su titular y su botón al catálogo,
       que es el camino que de todos modos importa. */
    const piezas = usePiezasPublicadas();
    const colecciones = useMemo(() => coleccionesDe(piezas, CUANTAS), [piezas]);
    const rejilla = useAparecerGrupo(0.12, colecciones.length);

    return (
        <section id="colecciones" className="collections-section">
            <div className="container">

                <div
                    className="collections-header"
                    ref={cabecera}
                >
                    <p className="eyebrow">Nuestras colecciones</p>
                    <h2 className="collections-title">Lo que <em>hacemos.</em></h2>
                    <p className="collections-subtitle">
                        Combinamos delicadeza y artesanía para crear piezas que perduran.
                    </p>
                </div>

                <div
                    className="collections-grid" ref={rejilla}
                >
                    {colecciones.map(c => (
                        <article key={c.categoria} className="collection-card">

                            <Link to={`/catalogo?categoria=${c.categoria}`} className="collection-card-image" aria-label={`Ver ${c.categoria.toLowerCase()}`}>
                                <img
                                    {...fotoProducto(c.foto)}
                                    sizes="(max-width: 768px) 92vw, 30vw"
                                    alt={c.alt}
                                    loading="lazy"
                                    decoding="async"
                                />
                                {c.metal && <span className="punzon collection-card-mark">{c.metal}</span>}
                            </Link>

                            <div className="collection-card-body">
                                <h3 className="collection-card-title">{c.categoria}</h3>
                                <p className="collection-card-desc">{DESCRIPCION[c.categoria]}</p>
                                <Link to={`/catalogo?categoria=${c.categoria}`} className="link-action">
                                    Ver {c.categoria.toLowerCase()} <Arrow />
                                </Link>
                            </div>

                        </article>
                    ))}
                </div>

                <div className="collections-cta">
                    <Link to="/catalogo" className="btn-pill black">Ver el catálogo</Link>
                </div>

            </div>
        </section>
    );
};

export default Collections;
