/* Los trazados del isotipo AG, aparte del componente.
 *
 * Están en su propio archivo porque Isotipo.jsx exportaba las dos cosas —el
 * componente y estos trazados— y un archivo que mezcla componentes con lo que
 * no lo es rompe el recambio en caliente: al editarlo se pierde el estado de
 * la pantalla en vez de refrescarse sola.
 *
 * Usan currentColor, así que el color lo decide el CSS: oro sobre claro, oro
 * luz sobre cacao.
 */
import React from 'react';

export const isotipoPaths = (
    <g transform="translate(0,495) scale(0.1,-0.1)" fill="currentColor" stroke="none">
        <path d="M2112 3633 c-8 -16 -119 -276 -271 -638 l-50 -120 182 -3 c100 -1 186 -1 193 2 6 2 24 38 40 80 16 42 32 76 35 76 3 0 39 -80 79 -177 212 -515 324 -781 336 -805 l15 -28 190 0 c177 0 191 1 187 18 -3 9 -87 213 -186 452 -99 239 -248 597 -330 795 l-149 360 -131 3 c-117 2 -132 1 -140 -15z" />
        <path d="M3048 3640 c-78 -14 -159 -40 -222 -72 -73 -36 -199 -130 -225 -167 l-19 -27 64 -154 c35 -85 76 -183 90 -218 l27 -63 27 68 c50 129 107 194 220 247 60 28 73 31 165 30 110 0 168 -17 252 -75 25 -17 48 -27 52 -23 4 5 47 72 96 149 l87 139 -28 23 c-44 36 -180 101 -259 124 -79 22 -253 33 -327 19z" />
        <path d="M3130 2745 l0 -175 140 0 140 0 0 -71 0 -70 -47 -22 c-41 -19 -66 -22 -163 -22 -104 0 -121 3 -172 27 l-56 26 75 -181 c41 -100 79 -194 85 -209 10 -27 13 -28 78 -28 171 0 351 62 498 171 l52 40 0 344 0 345 -315 0 -315 0 0 -175z" />
        <path d="M1440 2615 l0 -175 481 0 c466 0 480 1 474 19 -3 10 -35 88 -70 172 l-64 154 -411 3 -410 2 0 -175z" />
        <path d="M1515 2198 c-38 -89 -71 -165 -73 -170 -2 -4 86 -8 195 -8 l198 0 70 161 c39 89 72 165 73 170 2 5 -84 9 -195 9 l-198 0 -70 -162z" />
    </g>
);
