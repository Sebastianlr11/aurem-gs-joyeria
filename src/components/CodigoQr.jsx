/**
 * Un QR, dibujado como SVG.
 *
 * En SVG y no en canvas porque este certificado **se imprime**: un canvas se
 * imprime a la resolución de pantalla y los cuadros salen con el borde sucio,
 * mientras que el SVG lo rasteriza la impresora a la suya. Es la misma razón
 * por la que el resto del documento es HTML y no una imagen.
 *
 * La tarjeta que se manda por WhatsApp usa el otro camino —canvas, en
 * `pages/admin/certificado/tarjeta.js`— porque ahí el resultado ES una imagen.
 * Las dos dibujan el mismo código con la misma librería.
 *
 * **La zona de silencio no es opcional.** La norma pide cuatro módulos de
 * blanco alrededor, y sin ellos muchos lectores no encuentran el código: se ve
 * impecable y no se lee. Ya pasó una vez en la tarjeta.
 */
import React, { useMemo } from 'react';
import qr from 'qrcode-generator';

/* Cuatro módulos, como manda la norma. */
const QUIETO = 4;

const CodigoQr = ({ valor, className, titulo = 'Código QR de verificación' }) => {
    const modulos = useMemo(() => {
        if (!valor) return null;
        /* Tipo 0: que elija el tamaño mínimo que quepa. Corrección M —aguanta un
           15 % de daño— que es lo que hace falta para que un QR impreso en una
           tarjeta que vive en un estuche siga leyéndose. */
        const codigo = qr(0, 'M');
        codigo.addData(valor);
        codigo.make();

        const n = codigo.getModuleCount();
        const cuadros = [];
        for (let f = 0; f < n; f++) {
            for (let c = 0; c < n; c++) {
                if (codigo.isDark(f, c)) cuadros.push(`M${c + QUIETO} ${f + QUIETO}h1v1h-1z`);
            }
        }
        return { lado: n + QUIETO * 2, camino: cuadros.join('') };
    }, [valor]);

    if (!modulos) return null;

    return (
        <svg
            className={className}
            viewBox={`0 0 ${modulos.lado} ${modulos.lado}`}
            role="img"
            aria-label={titulo}
            /* Sin esto el navegador suaviza los cuadros al escalarlos y el
               lector pierde el borde entre módulos. */
            shapeRendering="crispEdges"
        >
            <rect width={modulos.lado} height={modulos.lado} fill="#fff" />
            <path d={modulos.camino} fill="currentColor" />
        </svg>
    );
};

export default CodigoQr;
