/**
 * El certificado de autenticidad de una pieza.
 *
 * Qué es y qué NO es, porque la palabra «certificado» significa dos cosas muy
 * distintas en joyería y confundirlas tiene consecuencias:
 *
 * - **Certificado gemológico**: lo emite un laboratorio (CDTEC, la Fundación
 *   Gemológica). Dice quilates, origen y tratamiento de la piedra. Tiene peso
 *   comercial. **Esto no es eso**, y aquí se emite sólo cuando la clienta paga
 *   el excedente.
 * - **Certificado del taller**: procedencia y garantía. Declara que la pieza
 *   salió de aquí, cuándo, en qué metal, y qué respondemos por ella. **Esto
 *   es esto.**
 *
 * Por eso `NOTA_LEGAL` viaja en el documento y no es opcional: una declaración
 * del vendedor que parezca un dictamen de laboratorio es publicidad engañosa
 * ante la SIC, y frente a una clienta que sepa de joyas queda peor que no
 * tener nada.
 *
 * ── Lo que congela y por qué ──────────────────────────────────────────
 *
 * El certificado guarda su propia copia de los datos, igual que
 * `order_items` congela los precios. Si mañana al taller le corrigen el metal
 * de una pieza, el certificado que ya se emitió **no puede cambiar solo**: es
 * un documento con fecha, no una consulta a la base. `congelar()` es lo que
 * arma esa copia.
 *
 * ── Ningún campo vacío ────────────────────────────────────────────────
 *
 * Una línea en blanco en un certificado lo desmiente. La referencia impresa
 * que circula por ahí tiene doce renglones con puntitos para llenar a mano;
 * éste se genera, así que **lo que no se sabe sencillamente no aparece**.
 * `campos()` es la única lista de qué se enseña, y la comparten la página
 * pública y la tarjeta que se manda por WhatsApp: si cada una tuviera la suya,
 * el día que se añada un dato una de las dos se quedaría atrás y el papel
 * diría menos que la pantalla a la que apunta su propio QR.
 */

import { refDe } from './referencia';
import { partirNombre } from './nombre';

/* Sin 0/O ni 1/I/L. Este código se lee en voz alta por WhatsApp y se teclea a
   mano desde una tarjeta impresa: las parejas que se confunden al leer son las
   que convierten un certificado válido en uno que «no existe». */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LARGO = 8;

/** `AG-` + 8. El prefijo es el mismo de la referencia de pieza, a propósito. */
export const PATRON_CODIGO = /^AG-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

/**
 * Un código nuevo, al azar.
 *
 * **Al azar y no consecutivo**, por dos razones que pesan lo mismo: un
 * «N.º 003» le está diciendo a la clienta que es la tercera compra en la
 * historia de la joyería, y un consecutivo se adivina — cualquiera podría
 * pasearse por los certificados de los demás cambiando el último dígito.
 *
 * La unicidad la impone la llave primaria de la tabla, no esta función. Con
 * 31⁸ combinaciones un choque es prácticamente imposible, pero «prácticamente»
 * no es «nunca» y quien inserta reintenta.
 *
 * @param {() => number} [azar] Inyectable para poder probarlo.
 */
export function nuevoCodigo(azar = Math.random) {
    let salida = '';
    for (let i = 0; i < LARGO; i++) {
        salida += ALFABETO[Math.floor(azar() * ALFABETO.length)];
    }
    return `AG-${salida}`;
}

/**
 * Normaliza lo que alguien teclea buscando su certificado.
 *
 * Quien llega desde una tarjeta impresa escribe el código a mano, y va a
 * escribirlo en minúscula, con o sin el `AG-`, y con espacios. Todas esas
 * formas son el mismo certificado. Devuelve `null` si no hay nada que salvar.
 */
export function normalizarCodigo(entrada) {
    const limpio = String(entrada ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    const cuerpo = limpio.startsWith('AG') ? limpio.slice(2) : limpio;
    const codigo = `AG-${cuerpo}`;
    return PATRON_CODIGO.test(codigo) ? codigo : null;
}

/**
 * El nombre que sale en el documento: sólo el de pila.
 *
 * La página del certificado es pública para quien tenga el enlace, y un
 * apellido más una joya de varios millones es más de lo que hace falta contar.
 * Con el nombre de pila el documento sigue siendo personal —«Expedido a
 * nombre de María Fernanda»— sin identificar a nadie ante un desconocido.
 *
 * `partirNombre` devuelve `null` cuando hay una sola palabra; entonces esa
 * palabra ya es el nombre de pila y se usa tal cual.
 */
export function nombreDePila(completo) {
    const texto = String(completo ?? '').trim().replace(/\s+/g, ' ');
    if (!texto) return '';
    return partirNombre(texto)?.nombre || texto;
}

/** «3 de septiembre de 2026», en hora de Bogotá. */
export function fechaLarga(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    /* En Bogotá y no en la zona del navegador: un pedido de las 8 p. m. se
       guarda en UTC como el día siguiente, y el certificado diría una fecha de
       compra que no coincide con la que la clienta recuerda. */
    return new Intl.DateTimeFormat('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
    }).format(d);
}

/**
 * El peso, con la unidad y sin decimales de más.
 *
 * `3.40` se escribe «3,4 g» y `3` se escribe «3 g». Un peso con ceros a la
 * derecha se lee como una medida copiada de un formulario, no como algo que
 * alguien puso en una balanza.
 */
export function pesoLegible(gramos) {
    const n = Number(gramos);
    if (!Number.isFinite(n) || n <= 0) return '';
    return `${n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} g`;
}

/**
 * La copia congelada que se guarda con el certificado.
 *
 * Toma el pedido y sus piezas y devuelve un objeto plano **sin ninguna clave
 * vacía**: lo que no se sabe no viaja, para que nadie tenga que decidirlo
 * después. Una línea en blanco en un certificado lo desmiente.
 *
 * `peso` y `talla` llegan sueltos por pieza porque el panel los deja corregir
 * antes de emitir: el peso de catálogo es el de la pieza de muestra y una
 * fabricación a medida no pesa lo mismo.
 */
export function congelar({ pedido, piezas = [] } = {}) {
    const datos = {};
    const poner = (destino, clave, valor) => {
        const v = typeof valor === 'string' ? valor.trim() : valor;
        if (v !== null && v !== undefined && v !== '') destino[clave] = v;
    };

    poner(datos, 'cliente', nombreDePila(pedido?.customer_name));
    poner(datos, 'compradoEn', pedido?.created_at || null);

    datos.piezas = piezas.map(({ producto, nombre, talla, peso }) => {
        const p = {};
        /* Sin reserva a `pedido.product_name`: ése es el nombre PEGADO del
           pedido —«Anillo A + Dije B»— y acabaría impreso como si fuera el
           nombre de una sola pieza. Quien llama sabe el nombre de cada una; si
           no lo sabe, esa línea no es una pieza y se cae abajo. */
        poner(p, 'nombre', nombre || producto?.name);
        poner(p, 'referencia', producto?.id ? refDe(producto) : '');
        poner(p, 'metal', producto?.metal);
        poner(p, 'piedra', producto?.piedra);
        poner(p, 'peso', pesoLegible(peso ?? producto?.peso_gramos));
        poner(p, 'talla', talla);
        /* La foto es lo que convierte el QR en algo comprobable: quien tiene la
           pieza en la mano la compara con la que enseña la página. Sin ella el
           certificado sólo dice que el código existe. */
        poner(p, 'foto', (Array.isArray(producto?.images) && producto.images[0]) || producto?.image_url);
        return p;
    }).filter((p) => p.nombre);

    return datos;
}

/**
 * Las piezas de un certificado, siempre como lista.
 *
 * **Los certificados emitidos antes del 9 de septiembre de 2026 guardan una
 * sola pieza en la raíz** —`pieza`, `metal`, `piedra`…— porque entonces un
 * pedido llevaba una. Aquéllos no se migran y no se van a migrar: un
 * certificado es un documento con fecha, y reescribirle los datos a uno que ya
 * está impreso en la casa de alguien es exactamente lo que congelarlos viene a
 * impedir. Así que se leen los dos formatos, aquí y en un solo sitio.
 */
export function piezasDe(datos) {
    if (Array.isArray(datos?.piezas)) return datos.piezas;
    if (datos?.pieza) {
        const { pieza, referencia, metal, piedra, peso, talla, foto } = datos;
        const vieja = { nombre: pieza, referencia, metal, piedra, peso, talla, foto };
        return [Object.fromEntries(Object.entries(vieja).filter(([, v]) => v))];
    }
    return [];
}

/**
 * Las líneas de UNA pieza, en orden y ya formateadas.
 *
 * Única lista de qué se enseña de cada pieza. La usan la página pública y la
 * tarjeta: si cada una tuviera la suya, el día que se añada un dato una de las
 * dos se quedaría atrás y el QR estaría desmintiendo al papel que lo lleva
 * impreso.
 */
export function camposDePieza(pieza) {
    const p = pieza || {};
    return [
        ['Referencia', p.referencia],
        ['Metal', p.metal],
        ['Piedra', p.piedra],
        ['Peso', p.peso],
        ['Talla', p.talla],
    ]
        .filter(([, valor]) => valor)
        .map(([etiqueta, valor]) => ({ etiqueta, valor: String(valor) }));
}

/**
 * Lo mismo en una sola línea: «Plata 925 · esmeralda natural · 3,4 g · Talla 14».
 *
 * Es lo que usa la tarjeta cuando el pedido lleva varias piezas: una tabla de
 * etiqueta y valor por pieza no cabe, y repetir «METAL» y «PIEDRA» tres veces
 * convierte un documento en un formulario.
 */
export function resumenDePieza(pieza) {
    const p = pieza || {};
    return [p.metal, p.piedra, p.peso, p.talla && `Talla ${p.talla}`]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Las dos garantías, copiadas de `/politica-de-devoluciones`.
 *
 * **Copiadas, no reescritas.** El certificado es el papel que la clienta
 * guarda y el que te enseña cuando reclama: si promete más que la política, es
 * la promesa la que vale; si promete menos, la política queda de adorno. Las
 * dos garantías están separadas en la política a propósito —una responde por
 * el material, la otra por el trabajo— y aquí van igual, con la exclusión de
 * las piedras incluida, que es la parte incómoda y justamente por eso la que
 * no se puede omitir.
 *
 * Si cambia la política, cambia esto. Los certificados ya emitidos no: lo que
 * se les prometió a sus dueños es lo que decía el documento el día que salió.
 */
export const GARANTIAS = [
    {
        titulo: 'De por vida en el metal',
        texto: 'Que una pieza marcada como plata 925 sea plata 925, y que un oro 18k sea oro 18k. Los ajustes de talla y el pulido van sin costo.',
    },
    {
        titulo: '30 días contra defectos de fabricación',
        texto: 'Engastes, soldaduras y acabados. Dentro de ese plazo reemplazamos o reparamos sin costo adicional.',
    },
];

/** La letra pequeña que las dos garantías no cubren. Va con ellas, siempre. */
export const EXCLUSION = 'Las piedras no entran en ninguna de las dos. Si una se suelta o se daña, escríbenos y lo revisamos caso por caso.';

/**
 * Qué es este documento, dicho por su nombre.
 *
 * Es lo que lo separa de un dictamen de laboratorio, y de paso le abre la
 * puerta a quien quiera pagar el excedente por uno de verdad.
 */
export const NOTA_LEGAL = 'Este documento es una declaración de procedencia y garantía emitida por Aurem Gs Joyería. No es un dictamen gemológico de laboratorio; ese se emite a solicitud y tiene un costo aparte.';

/** La frase que acompaña al QR, para quien lo escanea desde una tarjeta. */
export const LEYENDA_QR = 'Escanea para verificar este certificado en auremgsjoyeria.com';

/** La dirección pública de un certificado. */
export const RAIZ_PUBLICA = 'https://www.auremgsjoyeria.com';
export const urlDeCertificado = (codigo) => `${RAIZ_PUBLICA}/certificado/${codigo}`;
