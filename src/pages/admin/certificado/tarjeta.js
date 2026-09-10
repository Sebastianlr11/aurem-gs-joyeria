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
 * Las líneas salen de `campos()` y las frases de las constantes de
 * `src/lib/certificado.js`, no escritas a mano aquí. Si la tarjeta dijera una
 * cosa y la página otra, el QR estaría desmintiendo al papel que lo lleva
 * impreso.
 */

import qr from 'qrcode-generator';
import { campos, urlDeCertificado, LEYENDA_QR, NOTA_LEGAL } from '../../../lib/certificado';

/* Los tokens de `DESIGN.md`, a pelo y sólo aquí.

   En un componente esto sería una infracción —los colores se toman de las
   variables CSS—, pero un canvas no lee variables CSS: `getComputedStyle` da
   el valor y añadiría una dependencia del DOM a una función que sólo dibuja.
   Si cambia la paleta, cambia esto. */
const TINTA = '#1C1714';       // cacao
const MARFIL = '#FBF7F2';
const PAPEL = '#FFFFFF';
const ORO = '#A8863F';         // decorativo: filetes y marcos
const ORO_TINTA = '#7A5F26';   // todo texto dorado sobre claro
const HUMO = '#6B615A';
const PELO = '#E6DED3';

/* 4:5, que es la proporción que WhatsApp enseña entera en el hilo sin
   recortar y la que ya usa el catálogo para las fotos de producto. */
export const ANCHO = 1080;
export const ALTO = 1350;

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

    /* Fondo marfil y papel blanco encima: el documento es lo blanco, y el
       marfil es el mostrador sobre el que está. */
    c.fillStyle = MARFIL;
    c.fillRect(0, 0, ANCHO, ALTO);

    const M = 48;                       // margen del papel
    const papel = { x: M, y: M, w: ANCHO - M * 2, h: ALTO - M * 2 };
    c.fillStyle = PAPEL;
    c.fillRect(papel.x, papel.y, papel.w, papel.h);
    c.strokeStyle = PELO;
    c.lineWidth = 1;
    c.strokeRect(papel.x + 0.5, papel.y + 0.5, papel.w - 1, papel.h - 1);

    /* El filete de oro, por dentro del borde. Mismo gesto que el marco
       interior de la banda oscura de la portada: 1px, oro viejo, a 18px. */
    c.strokeStyle = ORO;
    c.globalAlpha = 0.45;
    c.strokeRect(papel.x + 18.5, papel.y + 18.5, papel.w - 37, papel.h - 37);
    c.globalAlpha = 1;

    const centro = ANCHO / 2;
    const izq = papel.x + 72;
    const der = papel.x + papel.w - 72;
    let y = papel.y + 96;

    /* ── Marca ── */
    const iso = await isotipoDorado(88);
    if (iso) {
        c.drawImage(iso, centro - 44, y - 44, 88, 88);
        y += 76;
    }

    texto(c, 'AUREM GS', centro, y, { fuente: `400 52px ${SERIF}`, color: TINTA, alineado: 'center', espaciado: 6 });
    y += 34;
    texto(c, 'JOYERÍA', centro, y, { fuente: `700 18px ${UI}`, color: ORO_TINTA, alineado: 'center', espaciado: 9 });

    y += 46;
    /* 2px y no 1: la tarjeta se pinta a 1080 de ancho y se ve a un tercio de
       eso en un celular, donde un filete de 1px desaparece. En pantalla el
       sistema pide 1px porque ahí 1px es 1px. */
    linea(c, centro - 40, y, centro + 40, ORO, 2);

    /* ── Título ── */
    y += 66;
    texto(c, 'Certificado de', centro, y, { fuente: `400 44px ${SERIF}`, color: TINTA, alineado: 'center' });
    y += 46;
    /* Versalitas espaciadas y nunca cursiva: Marcellus no tiene itálica y el
       navegador la inclinaría él, que a este tamaño se nota. */
    texto(c, 'AUTENTICIDAD', centro, y, { fuente: `400 30px ${SERIF}`, color: TINTA, alineado: 'center', espaciado: 7 });

    /* ── A nombre de quién ── */
    if (datos.cliente) {
        y += 62;
        texto(c, 'EXPEDIDO A NOMBRE DE', centro, y, { fuente: `700 15px ${UI}`, color: HUMO, alineado: 'center', espaciado: 4 });
        y += 44;
        /* Un nombre largo se encoge en vez de desbordarse: es lo primero que
           mira quien recibe la tarjeta y no puede salir cortado. */
        const fuenteNombre = (px) => `400 ${px}px ${SERIF}`;
        let px = 46;
        while (px > 26 && anchoDe(c, datos.cliente, fuenteNombre(px)) > der - izq) px -= 2;
        texto(c, datos.cliente, centro, y, { fuente: fuenteNombre(px), color: TINTA, alineado: 'center' });
    }

    /* ── Los datos ── */
    y += 56;
    const lineas = campos(datos);
    for (const { etiqueta, valor } of lineas) {
        linea(c, izq, y, der);
        y += 38;

        texto(c, etiqueta.toUpperCase(), izq, y, { fuente: `700 15px ${UI}`, color: HUMO, espaciado: 3 });

        /* El valor se parte si no cabe: hay nombres de pieza de 33 caracteres
           y piedras que se escriben «Esmeralda colombiana natural». */
        const anchoEtiqueta = anchoDe(c, etiqueta.toUpperCase(), `700 15px ${UI}`, 3);
        const disponible = (der - izq) - anchoEtiqueta - 40;
        const fuenteValor = `400 25px ${UI}`;
        const trozos = partirEnLineas(c, valor, fuenteValor, disponible);
        trozos.forEach((trozo, i) => {
            texto(c, trozo, der, y + i * 32, { fuente: fuenteValor, color: TINTA, alineado: 'right' });
        });

        y += 22 + (trozos.length - 1) * 32;
    }
    linea(c, izq, y, der);

    /* ── El pie, anclado desde abajo ──

       Y no continuando el flujo de arriba: el número de líneas de datos varía
       —una pieza sin piedra ni talla tiene dos menos, y un nombre de pieza
       largo parte en dos— y con el pie colgando del último dato, el QR bailaba
       de sitio entre una tarjeta y otra. Un documento no se maqueta así. */
    const abajo = papel.y + papel.h;

    /* Qué es este papel, dicho por su nombre. No es letra pequeña de relleno:
       es lo que lo separa de un dictamen de laboratorio, que es una promesa que
       no podemos hacer, y de paso le abre la puerta a quien quiera pagar el
       excedente por uno de verdad. */
    const fuenteLegal = `400 17px ${UI}`;
    const legal = partirEnLineas(c, NOTA_LEGAL, fuenteLegal, der - izq);
    const yLegal = abajo - 64 - (legal.length - 1) * 24;
    legal.forEach((trozo, i) => {
        texto(c, trozo, izq, yLegal + i * 24, { fuente: fuenteLegal, color: HUMO });
    });

    const ladoQr = 200;
    const yQr = yLegal - 30 - ladoQr;
    dibujarQr(c, urlDeCertificado(codigo), izq, yQr, ladoQr);

    const xTexto = izq + ladoQr + 32;
    texto(c, 'N.º DE CERTIFICADO', xTexto, yQr + 44, { fuente: `700 15px ${UI}`, color: HUMO, espaciado: 3 });
    texto(c, codigo, xTexto, yQr + 92, { fuente: `700 38px ${UI}`, color: TINTA, espaciado: 2 });

    partirEnLineas(c, LEYENDA_QR, `400 19px ${UI}`, der - xTexto).forEach((trozo, i) => {
        texto(c, trozo, xTexto, yQr + 138 + i * 27, { fuente: `400 19px ${UI}`, color: HUMO });
    });

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
