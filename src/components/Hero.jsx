import React from 'react'
import Foto from './Foto'
import { Link } from 'react-router-dom'
import { useWaUrl } from '../lib/whatsapp';
import { isotipoPaths } from './isotipoPaths';

const WhatsAppIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.470 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.5 9.5 0 0 1-4.83-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.27-9.49 9.51-9.49 2.54 0 4.92.99 6.72 2.78a9.42 9.42 0 0 1 2.78 6.72c0 5.23-4.27 9.49-9.51 9.49M20.5 3.49A11.4 11.4 0 0 0 12.05 0C5.77 0 .66 5.1.66 11.37c0 2 .52 3.96 1.52 5.68L.56 24l7.1-1.86a11.4 11.4 0 0 0 5.44 1.38h.01c6.28 0 11.39-5.1 11.39-11.37 0-3.04-1.19-5.9-3.34-8.05" />
    </svg>
);

/* Sello de taller: el mismo gesto del punzón, en circular */
const Sello = () => (
    <div className="hero-seal" aria-hidden="true">
        <svg viewBox="0 0 126 126">
            <defs>
                <path id="sello-aro" d="M63,63 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
            </defs>
            <circle className="seal-ring" cx="63" cy="63" r="60" />
            <circle className="seal-ring" cx="63" cy="63" r="38" />
            <text className="seal-text">
                <textPath href="#sello-aro" startOffset="0">
                    HECHO A MANO · AUREM GS · JOYERÍA FINA ·
                </textPath>
            </text>
            <g className="seal-monogram" transform="translate(13.6,22.8) scale(0.19)">
                {isotipoPaths}
            </g>
        </svg>
    </div>
);

const Hero = () => {
    /* `useWaUrl` y no `waUrl`: el hero se pinta en el build y el enlace tiene
       que salir igual en Node que en el primer render del navegador. */
    const waAsesoria = useWaUrl({
        mobile: 'Hola! 👋 Estoy interesada en las joyas de *Aurem Gs Joyería*. Me gustaría recibir asesoría ✨',
        desktop: 'Hola! Estoy interesada en las joyas de *Aurem Gs Joyería*. Me gustaría recibir asesoría.'
    });

    return (
        <section className="hero-section">
            <div className="container">
                <div className="hero-content-grid">

                    {/* Columna de texto */}
                    <div className="hero-left-col">
                        <p className="eyebrow hero-anim" style={{ '--hero-delay': '0s' }}>
                            Joyería fina · Colombia
                        </p>

                        <h1 className="hero-h1">
                            <span className="hero-line" style={{ '--line-delay': '0.06s' }}>
                                <span>Joyas que se heredan,</span>
                            </span>
                            <span className="hero-line" style={{ '--line-delay': '0.14s' }}>
                                <span><em>no que se reemplazan.</em></span>
                            </span>
                        </h1>

                        <p className="hero-subtitle hero-anim" style={{ '--hero-delay': '0.14s' }}>
                            {/* Lo que hay de verdad en el catálogo: 4 anillos y 1 dije, en oro
                                18k, oro blanco 18k y plata 925. Decía "collares y pulseras" —no hay
                                ninguno— y "platino" —ni una pieza—. Prometer surtido que no existe
                                trae a alguien a buscar un collar y lo deja con las manos vacías; el
                                encargo a medida es mejor argumento y además es cierto. */}
                            Anillos y dijes en oro 18k y plata 925, con esmeralda colombiana natural. Cada
                            pieza sale de nuestro taller sellada con su ley y con garantía de por vida en
                            el metal. Lo que no esté en el catálogo, lo hacemos a medida.
                        </p>

                        <div className="hero-btns hero-anim" style={{ '--hero-delay': '0.2s' }}>
                            <Link to="/catalogo" className="btn-pill black">
                                Ver el catálogo
                            </Link>
                            <a
                                href={waAsesoria}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-pill light"
                            >
                                <WhatsAppIcon /> Escribir por WhatsApp
                            </a>
                        </div>

                        <div className="hero-rule" />

                        <div className="hero-marks hero-anim" style={{ '--hero-delay': '0.28s' }}>
                            {/* Sin PT950: un punzón de platino junto a los otros dos dice que
                                hay piezas de platino selladas, y no hay ninguna. Vuelve el día que
                                se publique una. */}
                            <span className="punzon">18K</span>
                            <span className="punzon">925</span>
                            <p className="hero-marks-note">
                                Cada pieza sellada con su ley y con garantía de por vida en el metal.
                            </p>
                        </div>
                    </div>

                    {/* Composición de imagen */}
                    <div className="hero-media hero-alza">
                        <figure className="hero-frame">
                            {/* Va con prioridad alta: es lo más grande del
                                primer viewport y compite con todo lo demás
                                por el ancho de banda. */}
                            <Foto
                                nombre="pen-hero"
                                anchos={[768, 928]}
                                tamanos="(max-width: 968px) 92vw, 40vw"
                                alt="Anillo de oro con diamante en la mano de un cliente de Aurem Gs Joyería"
                                width="928"
                                height="1152"
                                fetchPriority="high"
                                decoding="async"
                            />
                        </figure>
                        <Sello />
                    </div>

                </div>
            </div>
        </section>
    )
}

export default Hero
