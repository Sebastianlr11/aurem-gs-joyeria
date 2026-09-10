/**
 * La tarjeta del certificado, pintada en un canvas.
 *
 * Es lo que la clienta recibe por WhatsApp y —cuando se imprima— lo que va
 * dentro del estuche. **Una sola cara**: en WhatsApp la segunda imagen no la
 * abre nadie, así que la tarjeta es la invitación y el documento completo vive
 * en la página a la que apunta su QR.
 *
 * ── Por qué en el navegador y no en una Edge Function ─────────────────────
 *
 * Porque el panel ya tiene todo lo que hace falta —las fuentes de la marca
 * cargadas, la sesión, y un canvas— y una función en Deno necesitaría una
 * librería de imágenes, las fuentes empaquetadas aparte y un despliegue cada
 * vez que se corrija una coma del diseño. Aquí se ve el resultado antes de
 * mandarlo, que es justo lo que uno quiere de un documento con el nombre de
 * una clienta encima.
 *
 * ── JPEG, nunca WebP ──────────────────────────────────────────────────────
 *
 * WhatsApp no acepta WebP y falla con un 200 engañoso: la API responde bien y
 * el mensaje no llega nunca. Es la misma razón por la que cada foto de
 * producto se guarda dos veces. Aquí sólo hay un formato y es JPEG.
 *
 * ── Lo que se dibuja tiene que coincidir con la página ────────────────────
 *
 * Las piezas salen de `piezasDe()` y las frases de las constantes de
 * `src/lib/certificado.js`, no escritas a mano aquí. Si la tarjeta dijera una
 * cosa y la página otra, el QR estaría desmintiendo al papel que lo lleva
 * impreso.
 *
 * ── Por qué las medidas están en «píxeles de hoja carta» ──────────────────
 *
 * La maqueta es el diseño `Certificado de Autenticidad.dc.html`, que es un
 * documento de 8,5 × 11 pulgadas — o sea 816 × 1056 px a 96 ppp. Todo lo que se
 * dibuja aquí usa **los números del diseño tal cual** y `E()` los lleva a la
 * escala del lienzo. Así, si mañana cambia el diseño, se copian sus valores sin
 * traducir nada a mano; y si cambia el tamaño del lienzo, la maqueta no se
 * entera.
 *
 * El lienzo NO es 816 × 1056 escalado: es 4:5. Esa proporción es la más alta
 * que WhatsApp enseña entera en el hilo, y una hoja carta —más estrecha— se
 * vería recortada por arriba y por abajo justo en la vista previa, que es donde
 * la clienta decide si la abre.
 */

import qr from 'qrcode-generator';
import { piezasDe, resumenDePieza, fechaLarga, urlDeCertificado, LEYENDA_QR, NOTA_LEGAL, GARANTIAS, EXCLUSION } from '../../../lib/certificado';

/* Los tokens de `DESIGN.md`, a pelo y sólo aquí.

   En un componente esto sería una infracción —los colores se toman de las
   variables CSS—, pero un canvas no lee variables CSS: `getComputedStyle` da
   el valor y añadiría una dependencia del DOM a una función que sólo dibuja.
   Si cambia la paleta, cambia esto. */
const TINTA = '#1C1714';       // cacao
const MARFIL = '#FBF7F2';
const ARENA = '#F2EAE0';   // la banda del titular
const PAPEL = '#FFFFFF';
const ORO = '#A8863F';         // decorativo: filetes y marcos
const ORO_TINTA = '#7A5F26';   // todo texto dorado sobre claro
const HUMO = '#6B615A';
const PELO = '#E6DED3';

/* 4:5, que es la proporción que WhatsApp enseña entera en el hilo sin
   recortar y la que ya usa el catálogo para las fotos de producto. */
export const ANCHO = 1080;
export const ALTO = 1350;

/* El ancho de una hoja carta a 96 ppp, que es la unidad en la que está escrito
   el diseño. */
const ANCHO_CARTA = 816;
const K = ANCHO / ANCHO_CARTA;

/** Un número del diseño, llevado a la escala del lienzo. */
const E = (n) => n * K;

const SERIF = 'Marcellus, Georgia, serif';
const UI = 'Mulish, system-ui, sans-serif';

/**
 * Las fuentes de la marca, cargadas de verdad antes de dibujar.
 *
 * `document.fonts` no las tiene listas sólo porque la hoja las declare: se
 * cargan cuando algo las usa, y un canvas no cuenta como algo. Sin esperarlas,
 * el navegador dibuja con la sustituta —Georgia, o la del sistema— sin avisar,
 * y la tarjeta sale con otra tipografía. Es el fallo que no se ve hasta que
 * alguien compara dos certificados.
 */
async function esperarFuentes() {
    if (typeof document === 'undefined' || !document.fonts) return;
    await Promise.all([
        document.fonts.load(`400 64px ${SERIF}`),
        document.fonts.load(`400 40px ${SERIF}`),
        document.fonts.load(`700 22px ${UI}`),
        document.fonts.load(`400 28px ${UI}`),
    ]);
}

/** Una imagen ya cargada, o `null` si no se pudo. Nunca lanza. */
function cargarImagen(url, { conCredenciales = false } = {}) {
    return new Promise((listo) => {
        if (!url) return listo(null);
        const img = new Image();
        /* Sin esto el canvas queda «manchado» y `toBlob` lanza un
           SecurityError: la foto vive en el dominio de Supabase Storage y el
           bucket es público, así que responde con CORS. */
        if (!conCredenciales) img.crossOrigin = 'anonymous';
        img.onload = () => listo(img);
        img.onerror = () => listo(null);
        img.src = url;
    });
}

/**
 * El isotipo, teñido de oro.
 *
 * El archivo trae `fill="#000000"` y no hay forma de pedirle otro color a un
 * `<img>`. Se dibuja en un lienzo aparte y se rellena con `source-in`, que
 * pinta sólo donde ya había tinta: el resultado es la misma silueta en oro.
 */
async function isotipoDorado(lado) {
    const img = await cargarImagen('/assets/logo-isotipo.svg');
    if (!img) return null;

    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const c = lienzo.getContext('2d');

    /* El isotipo no es cuadrado (512×495): se encaja centrado para que no
       salga estirado. */
    const escala = Math.min(lado / img.width, lado / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    c.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);

    c.globalCompositeOperation = 'source-in';
    c.fillStyle = ORO;
    c.fillRect(0, 0, lado, lado);
    return lienzo;
}

/* ── Ayudas de dibujo ──────────────────────────────────────────────── */

const texto = (c, cadena, x, y, { fuente, color, alineado = 'left', espaciado = 0 }) => {
    c.font = fuente;
    c.fillStyle = color;
    c.textAlign = alineado;
    c.textBaseline = 'alphabetic';
    /* `letterSpacing` en canvas es de Chrome 99+. El panel corre en Chrome; si
       el navegador no lo soporta, la propiedad se ignora sola y la tarjeta
       sale con el tracking por defecto en vez de romperse. */
    c.letterSpacing = `${espaciado}px`;
    c.fillText(cadena, x, y);
    c.letterSpacing = '0px';
};

const anchoDe = (c, cadena, fuente, espaciado = 0) => {
    c.font = fuente;
    c.letterSpacing = `${espaciado}px`;
    const m = c.measureText(cadena).width;
    c.letterSpacing = '0px';
    return m;
};

/** Parte una cadena en las líneas que caben. Devuelve al menos una. */
function partirEnLineas(c, cadena, fuente, maximo) {
    c.font = fuente;
    const palabras = String(cadena).split(/\s+/).filter(Boolean);
    const lineas = [];
    let actual = '';
    for (const palabra of palabras) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (c.measureText(prueba).width > maximo && actual) {
            lineas.push(actual);
            actual = palabra;
        } else {
            actual = prueba;
        }
    }
    if (actual) lineas.push(actual);
    return lineas.length ? lineas : [''];
}

const linea = (c, x1, y, x2, color = PELO, grosor = 1) => {
    c.strokeStyle = color;
    c.lineWidth = grosor;
    c.beginPath();
    c.moveTo(x1, y + 0.5);
    c.lineTo(x2, y + 0.5);
    c.stroke();
};

/**
 * El punzón del diseño: un rectángulo con la esquina superior izquierda y la
 * inferior derecha cortadas en diagonal.
 *
 * A mano y no con `clip-path`, que en un canvas no existe. Va relleno con el
 * degradado del sistema —blanco arriba, marfil abajo— y perfilado en oro.
 */
function punzon(c, x, y, w, h) {
    const m = E(6);
    const trazo = () => {
        c.beginPath();
        c.moveTo(x + m, y);
        c.lineTo(x + w, y);
        c.lineTo(x + w, y + h - m);
        c.lineTo(x + w - m, y + h);
        c.lineTo(x, y + h);
        c.lineTo(x, y + m);
        c.closePath();
    };

    const grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, PAPEL);
    grad.addColorStop(1, MARFIL);
    trazo();
    c.fillStyle = grad;
    c.fill();

    trazo();
    c.strokeStyle = ORO;
    c.globalAlpha = 0.45;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
}

/** El QR, en cuadraditos de tinta cacao sobre papel. */
function dibujarQr(c, url, x, y, lado) {
    /* Tipo 0 = que elija el tamaño mínimo que quepa. Corrección M: aguanta un
       15 % de daño, que es lo que hace falta para que un QR impreso en una
       tarjeta que vive en un estuche siga leyéndose. */
    const codigo = qr(0, 'M');
    codigo.addData(url);
    codigo.make();

    const celdas = codigo.getModuleCount();

    /* La zona de silencio: cuatro módulos de blanco alrededor, que la norma
       exige y sin los cuales muchos lectores no encuentran el código. Es el
       fallo que no se ve mirando la tarjeta —el QR parece perfecto— y sólo
       aparece cuando alguien intenta escanearlo desde el estuche, que es
       justamente cuando ya no hay forma de arreglarlo. */
    const QUIETO = 4;
    const celda = lado / (celdas + QUIETO * 2);

    c.fillStyle = PAPEL;
    c.fillRect(x, y, lado, lado);
    c.fillStyle = TINTA;
    for (let f = 0; f < celdas; f++) {
        for (let col = 0; col < celdas; col++) {
            if (!codigo.isDark(f, col)) continue;
            /* Se redondea hacia arriba: con celdas fraccionarias quedan
               costuras blancas de medio píxel entre los cuadros y algunos
               lectores fallan. */
            c.fillRect(
                Math.floor(x + (QUIETO + col) * celda),
                Math.floor(y + (QUIETO + f) * celda),
                Math.ceil(celda),
                Math.ceil(celda),
            );
        }
    }
}

/**
 * Las tres casillas de garantía, medidas sin pintarlas.
 *
 * Se mide antes de pintar por dos razones. Las tres comparten alto, y el alto
 * es el del texto más largo: un recuadro más corto que sus vecinos convierte
 * una tira en tres cajas sueltas. Y su alto es un dato que la tabla de piezas
 * necesita antes de dibujarse, para saber cuánto sitio le queda.
 *
 * El rótulo también se mide y se parte: «30 días contra defectos de
 * fabricación» no cabe en un tercio de la hoja, y encogerlo hasta que quepa lo
 * dejaba ilegible — o desbordado sobre la casilla vecina, que fue lo que pasó
 * al primer intento. Se parte en renglones, como el texto.
 */
function medirCeldas(c, izq, der) {
    /* El diseño trae tres casillas: Garantía, Envío y Pago. Se conserva la
       forma y **cambia el contenido**, porque lo que decían no es cierto en
       este negocio: el envío no es de 24 a 48 horas —son 3 a 4 días en Bogotá y
       4 a 6 al resto del país— y el contraentrega **no es a todo el país, es
       sólo Bogotá**. Un certificado es el papel que la clienta enseña al
       reclamar: lo que prometa ahí, se cumple, y ante la SIC además es
       vinculante.

       Así que las casillas dicen lo único que este documento tiene que decir:
       las dos garantías, copiadas de la política de devoluciones, y la
       exclusión de las piedras — la parte incómoda, y justo por eso la que no
       se puede omitir. */
    const celdas = [
        ...GARANTIAS.map((g) => [g.titulo, g.texto]),
        ['Las piedras', EXCLUSION],
    ];
    const anchoCelda = (der - izq) / celdas.length;
    const fuenteCelda = `400 ${E(13.5)}px ${UI}`;
    const fuenteRotulo = `700 ${E(9.5)}px ${UI}`;
    const util = anchoCelda - E(40);
    const rotulos = celdas.map(([t]) => partirEnLineas(c, t.toUpperCase(), fuenteRotulo, util));
    const partidas = celdas.map(([, t]) => partirEnLineas(c, t, fuenteCelda, util));

    const altoRotulo = Math.max(...rotulos.map((l) => l.length));
    const yTexto = E(26) + altoRotulo * E(14) + E(6);
    const alto = yTexto + Math.max(...partidas.map((l) => l.length)) * E(19) + E(14);

    return { celdas, anchoCelda, fuenteCelda, fuenteRotulo, rotulos, partidas, yTexto, alto };
}

/* ── La tarjeta ────────────────────────────────────────────────────── */

/**
 * Pinta la tarjeta y devuelve el canvas.
 *
 * @param {{codigo: string, datos: object}} cert
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function pintarTarjeta({ codigo, datos }) {
    await esperarFuentes();

    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO;
    lienzo.height = ALTO;
    const c = lienzo.getContext('2d');

    /* Marfil de fondo y la hoja blanca encima, a 40 px del borde: el documento
       es lo blanco y el marfil es el mostrador sobre el que está. */
    c.fillStyle = MARFIL;
    c.fillRect(0, 0, ANCHO, ALTO);

    const M = E(40);
    const hoja = { x: M, y: M, w: ANCHO - M * 2, h: ALTO - M * 2 };
    c.fillStyle = PAPEL;
    c.fillRect(hoja.x, hoja.y, hoja.w, hoja.h);
    c.strokeStyle = PELO;
    c.lineWidth = 1;
    c.strokeRect(hoja.x + 0.5, hoja.y + 0.5, hoja.w - 1, hoja.h - 1);

    const izq = hoja.x + E(52);
    const der = hoja.x + hoja.w - E(52);
    let y = hoja.y + E(44);

    /* ── Cabecera: la marca a la izquierda, el punzón a la derecha ── */
    const iso = await isotipoDorado(E(34));
    if (iso) c.drawImage(iso, izq, y, E(34) * (240 / 171), E(34));

    const xTexto = izq + E(34) * (240 / 171) + E(14);
    texto(c, 'AUREM GS', xTexto, y + E(17), { fuente: `400 ${E(22)}px ${SERIF}`, color: TINTA, espaciado: E(3) });
    texto(c, 'JOYERÍA FINA · COLOMBIA', xTexto, y + E(33), { fuente: `600 ${E(9.5)}px ${UI}`, color: ORO_TINTA, espaciado: E(2.5) });

    /* El punzón, con la muesca en dos esquinas del diseño. Marca un dato
       comprobable, que es para lo que existe. */
    const rotulo = 'DOCUMENTO ORIGINAL';
    const anchoRotulo = anchoDe(c, rotulo, `700 ${E(9.5)}px ${UI}`, E(1.6));
    const pw = anchoRotulo + E(32);
    const ph = E(30);
    const px = der - pw;
    punzon(c, px, y, pw, ph);
    texto(c, rotulo, px + pw / 2, y + ph / 2 + E(3.5), {
        fuente: `700 ${E(9.5)}px ${UI}`, color: ORO_TINTA, alineado: 'center', espaciado: E(1.6),
    });

    /* ── El filete: oro corto, pelo hasta el borde ── */
    y += E(34) + E(26);
    linea(c, izq, y, izq + E(64), ORO, 2);
    linea(c, izq + E(64), y, der, PELO);

    /* ── Título y los dos datos del documento ── */
    y += E(24);
    const anchoMeta = E(236);
    const xMeta = der - anchoMeta;

    texto(c, 'Certificado de', izq, y + E(38), { fuente: `400 ${E(44)}px ${SERIF}`, color: TINTA });
    /* Versalitas espaciadas y nunca cursiva: Marcellus no tiene itálica y el
       navegador la inclinaría él. */
    texto(c, 'AUTENTICIDAD', izq, y + E(38) + E(32), { fuente: `400 ${E(27)}px ${SERIF}`, color: TINTA, espaciado: E(1.6) });

    /* El filo vertical que separa el título de la columna de datos. */
    c.strokeStyle = PELO; c.lineWidth = 1;
    c.beginPath(); c.moveTo(xMeta - E(24) + 0.5, y); c.lineTo(xMeta - E(24) + 0.5, y + E(78)); c.stroke();

    texto(c, 'N.º DE CERTIFICADO', xMeta, y + E(10), { fuente: `700 ${E(9.5)}px ${UI}`, color: ORO_TINTA, espaciado: E(1.6) });
    texto(c, codigo, xMeta, y + E(34), { fuente: `800 ${E(22)}px ${UI}`, color: TINTA, espaciado: E(0.7) });

    const fecha = fechaLarga(datos.compradoEn);
    if (fecha) {
        texto(c, 'FECHA DE COMPRA', xMeta, y + E(58), { fuente: `700 ${E(9.5)}px ${UI}`, color: ORO_TINTA, espaciado: E(1.6) });
        texto(c, fecha, xMeta, y + E(78), { fuente: `600 ${E(16)}px ${UI}`, color: TINTA });
    }

    /* ── La banda del titular ── */
    y += E(84) + E(26);
    const bandaAlto = E(74);
    c.fillStyle = ARENA;
    c.fillRect(izq, y, der - izq, bandaAlto);

    texto(c, 'EXPEDIDO A NOMBRE DE', izq + E(26), y + E(24), { fuente: `700 ${E(9.5)}px ${UI}`, color: ORO_TINTA, espaciado: E(1.6) });
    /* Un nombre largo se encoge en vez de desbordarse: es lo primero que mira
       quien recibe la tarjeta y no puede salir cortado. */
    const piezas = piezasDe(datos);
    const conteo = `${piezas.length} pieza${piezas.length !== 1 ? 's' : ''}`;
    const anchoConteo = Math.max(anchoDe(c, conteo, `400 ${E(24)}px ${SERIF}`), anchoDe(c, 'Ampara', `400 ${E(13)}px ${UI}`));
    const sitioNombre = (der - E(26)) - (izq + E(26)) - anchoConteo - E(24);
    let pxNombre = 30;
    while (pxNombre > 17 && anchoDe(c, datos.cliente || '', `400 ${E(pxNombre)}px ${SERIF}`) > sitioNombre) pxNombre -= 1;
    texto(c, datos.cliente || 'Su titular', izq + E(26), y + E(55), { fuente: `400 ${E(pxNombre)}px ${SERIF}`, color: TINTA });

    texto(c, 'Ampara', der - E(26), y + E(30), { fuente: `400 ${E(13)}px ${UI}`, color: HUMO, alineado: 'right' });
    texto(c, conteo, der - E(26), y + E(56), { fuente: `400 ${E(24)}px ${SERIF}`, color: TINTA, alineado: 'right' });

    /* ── El sitio del pie se aparta ANTES de dibujar la tabla ──

       El pie está anclado abajo y no lo mueve nada, así que lo que hay entre la
       banda y él es todo el sitio que tiene la tabla de piezas. Medirlo primero
       es lo que permite que la tabla se ajuste en vez de escribir encima: el 9
       de septiembre de 2026, al subir el QR a 150 px para que se escaneara, la
       leyenda de verificación quedó pintada sobre las casillas de garantía en
       cuanto el pedido traía dos piezas — y con tres ya se salía antes, a 104. */
    const abajo = hoja.y + hoja.h;

    /* Los 150 px del sello no son los 104 del diseño, y la diferencia es la
       diferencia entre un QR que se escanea y uno que no.

       Los 104 son la medida de una hoja carta —2,7 cm de papel, que cualquier
       lector coge de sobra—, pero esta tarjeta no es papel: llega por WhatsApp
       y en el hilo se mira a unos 400 px de ancho, donde a 104 quedan menos de
       dos píxeles por módulo. Medido el 9 de septiembre de 2026 decodificando
       la imagen con `jsqr` —no mirándola, que en pantalla grande se ve
       perfecto— a 1080, 540, 480, 400 y 360 px de ancho de tarjeta, de una a
       cinco piezas: a 104 sólo se lee la imagen entera, a 1080; a 150 se lee
       hasta 400. Por debajo de eso no lo salva ningún tamaño —a 320 falla
       incluso a 160—, y 400 es más ancho de lo que cualquier celular de hoy
       enseña una imagen 4:5 en el hilo.

       Si lo tocas, vuelve a decodificarlo de verdad. */
    const ladoQr = E(150);
    /* El sello se apoya en el margen de abajo. */
    const yPie = abajo - E(30) - ladoQr;

    /* Las casillas de garantía se miden aquí aunque se pinten luego: su alto no
       depende de las piezas —el texto es siempre el mismo— y hace falta para
       saber cuánto le queda a la tabla. */
    const medidaCeldas = medirCeldas(c, izq, der);

    /* ── La tabla de piezas ── */
    y += bandaAlto + E(30);
    const xRef = der - E(118);

    texto(c, 'PIEZA Y MATERIALES', izq + E(42), y, { fuente: `700 ${E(9.5)}px ${UI}`, color: HUMO, espaciado: E(1.6) });
    texto(c, 'REFERENCIA', der, y, { fuente: `700 ${E(9.5)}px ${UI}`, color: HUMO, alineado: 'right', espaciado: E(1.6) });
    y += E(9);
    /* Línea de tinta y no de pelo: es lo que le da al bloque el peso de una
       tabla de documento. */
    linea(c, izq, y, der, TINTA);

    /* Cuánto sitio hay hasta las casillas, que son lo siguiente que se pinta. */
    const tope = yPie - E(26) - medidaCeldas.alto - E(28);

    /* El aire de cada fila se aprieta antes que perder una pieza: con dos
       piezas la tabla respira, con tres se junta, y sólo cuando ni apretada
       cabe se dice cuántas quedaron fuera. Es la misma idea que encoger el
       nombre de la clienta en vez de partirlo. */
    const fichas = piezas.map((pz) => {
        const ficha = resumenDePieza(pz);
        return ficha ? partirEnLineas(c, ficha, `400 ${E(13.5)}px ${UI}`, der - (izq + E(42))) : [];
    });
    const altoFila = (i, aire) => aire + E(17) + (fichas[i].length ? E(20) + (fichas[i].length - 1) * E(18) : 0) + aire;
    const cabenCon = (aire) => {
        let alto = 0;
        let n = 0;
        while (n < piezas.length && y + alto + altoFila(n, aire) <= tope) alto += altoFila(n++, aire);
        return n;
    };

    /* Con el aire de siempre si caben todas; apretado si así caben todas; y si
       no, apretado y listando las que quepan. */
    let aire = E(16);
    if (cabenCon(aire) < piezas.length) aire = E(9);
    const alaVista = Math.min(cabenCon(aire), piezas.length);
    /* Si sobra una sola, la línea de «y 1 pieza más» ocupa lo mismo que la fila
       que no cupo: mejor enseñar la pieza. Pero eso ya lo decidió `cabenCon`. */

    piezas.slice(0, alaVista).forEach((pz, i) => {
        y += aire + E(17);
        texto(c, String(i + 1).padStart(2, '0'), izq, y, { fuente: `400 ${E(17)}px ${SERIF}`, color: ORO_TINTA });

        /* El nombre se encoge antes que partirse: una pieza en dos renglones
           con su referencia flotando al lado se lee como un error de maqueta. */
        let pxN = 17;
        while (pxN > 12 && anchoDe(c, pz.nombre, `700 ${E(pxN)}px ${UI}`) > xRef - (izq + E(42)) - E(16)) pxN -= 0.5;
        texto(c, pz.nombre, izq + E(42), y, { fuente: `700 ${E(pxN)}px ${UI}`, color: TINTA });
        if (pz.referencia) {
            texto(c, pz.referencia, der, y, { fuente: `700 ${E(14)}px ${UI}`, color: ORO_TINTA, alineado: 'right', espaciado: E(0.6) });
        }

        if (fichas[i].length) {
            y += E(20);
            fichas[i].forEach((t, j) => texto(c, t, izq + E(42), y + j * E(18), { fuente: `400 ${E(13.5)}px ${UI}`, color: HUMO }));
            y += (fichas[i].length - 1) * E(18);
        }
        y += aire;
        linea(c, izq, y, der, PELO);
    });

    /* Lo que no cupo se dice, no se calla: la tarjeta es la invitación y el
       documento entero está a un escaneo de distancia. Callarlo dejaría una
       tarjeta que dice «3 piezas» arriba y enseña dos. */
    const fuera = piezas.length - alaVista;
    if (fuera > 0) {
        y += aire + E(14);
        texto(c, `y ${fuera} pieza${fuera !== 1 ? 's' : ''} más — el certificado completo las lleva todas`,
            izq + E(42), y, { fuente: `400 ${E(13.5)}px ${UI}`, color: HUMO });
        y += aire;
        linea(c, izq, y, der, PELO);
    }

    /* ── Lo que se responde por las piezas ──

       El diseño trae tres casillas: Garantía, Envío y Pago. Se conserva la
       forma y **cambia el contenido**, porque lo que decían no es cierto en
       este negocio: el envío no es de 24 a 48 horas —son 3 a 4 días en Bogotá y
       4 a 6 al resto del país— y el contraentrega **no es a todo el país, es
       sólo Bogotá**. Un certificado es el papel que la clienta enseña al
       reclamar: lo que prometa ahí, se cumple, y ante la SIC además es
       vinculante.

       Así que las casillas dicen lo único que este documento tiene que decir:
       las dos garantías, copiadas de la política de devoluciones, y la
       exclusión de las piedras — la parte incómoda, y justo por eso la que no
       se puede omitir. */
    y += E(28);
    const { celdas, anchoCelda, fuenteCelda, fuenteRotulo, rotulos, partidas, yTexto, alto: altoCelda } = medidaCeldas;

    c.strokeStyle = PELO;
    c.lineWidth = 1;
    c.strokeRect(izq + 0.5, y + 0.5, der - izq - 1, altoCelda - 1);

    celdas.forEach((_, i) => {
        const x = izq + anchoCelda * i;
        if (i > 0) {
            c.beginPath();
            c.moveTo(Math.round(x) + 0.5, y);
            c.lineTo(Math.round(x) + 0.5, y + altoCelda);
            c.stroke();
        }
        rotulos[i].forEach((t, j) => {
            texto(c, t, x + E(20), y + E(26) + j * E(14), { fuente: fuenteRotulo, color: ORO_TINTA, espaciado: E(1.2) });
        });

        partidas[i].forEach((t, j) => {
            texto(c, t, x + E(20), y + yTexto + j * E(19), { fuente: fuenteCelda, color: HUMO });
        });
    });

    /* ── El pie: el sello abajo a la izquierda, la letra pequeña a su lado ──

       Anclado desde abajo y no continuando el flujo de arriba: el número de
       piezas varía, y con el pie colgando de la última, el QR bailaba de sitio
       entre una tarjeta y otra. Un documento no se maqueta así.

       El reparto cambió el 9 de septiembre de 2026, al subir el QR a 150 px
       para que se escaneara desde un celular. Antes el QR iba apilado sobre la
       firma y la nota legal cruzaba la hoja entera por debajo: ese pie medía
       249 px de los 980 de la hoja y con dos piezas ya se comía las casillas de
       garantía. Ahora el sello se apoya en el margen inferior y la firma, la
       leyenda y la nota legal se reparten la columna de su derecha, que estaba
       vacía: el pie mide 180 y el sello no le quita sitio a nadie. */
    dibujarQr(c, urlDeCertificado(codigo), izq, yPie, ladoQr);

    const xPie = izq + ladoQr + E(22);
    const anchoPie = der - xPie;

    /* La firma, arriba de la columna y contra el margen derecho. */
    linea(c, der - E(240), yPie + E(16), der, TINTA);
    texto(c, 'Aurem Gs Joyería', der, yPie + E(34), { fuente: `400 ${E(18)}px ${SERIF}`, color: TINTA, alineado: 'right' });
    texto(c, 'FIRMA AUTORIZADA', der, yPie + E(48), { fuente: `700 ${E(9.5)}px ${UI}`, color: HUMO, alineado: 'right', espaciado: E(1.6) });

    /* La nota legal se apoya en el borde de abajo del sello, y la leyenda del
       QR se cuelga de ella hacia arriba: las dos se miden en renglones, así que
       encajarlas desde una posición fija sería confiar en que ninguna de las
       dos crezca nunca. */
    const fuenteLegal = `400 ${E(13)}px ${UI}`;
    const legal = partirEnLineas(c, NOTA_LEGAL, fuenteLegal, anchoPie);
    const yLegal = yPie + ladoQr - (legal.length - 1) * E(19);
    legal.forEach((t, i) => texto(c, t, xPie, yLegal + i * E(19), { fuente: fuenteLegal, color: HUMO }));

    const leyenda = partirEnLineas(c, LEYENDA_QR, `400 ${E(13)}px ${UI}`, anchoPie);
    const yLeyenda = yLegal - E(26) - (leyenda.length - 1) * E(19);
    leyenda.forEach((t, i) => texto(c, t, xPie, yLeyenda + i * E(19), { fuente: `400 ${E(13)}px ${UI}`, color: HUMO }));
    texto(c, 'VERIFICACIÓN', xPie, yLeyenda - E(20), { fuente: `700 ${E(9.5)}px ${UI}`, color: ORO_TINTA, espaciado: E(1.6) });

    return lienzo;
}

/**
 * La tarjeta como archivo, lista para subir o para descargar.
 *
 * Calidad 0,92: por debajo de 0,9 los filetes de 1px de oro sobre blanco
 * cogen halo, que en un documento se ve como un escaneo malo.
 */
export async function tarjetaJpeg(cert) {
    const lienzo = await pintarTarjeta(cert);
    const blob = await new Promise((listo) => lienzo.toBlob(listo, 'image/jpeg', 0.92));
    if (!blob) throw new Error('El navegador no pudo generar la imagen de la tarjeta.');
    return blob;
}
