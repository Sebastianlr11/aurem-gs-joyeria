/**
 * Las respuestas rápidas del chat: los botones que dejan un texto ya escrito
 * en la caja de mensaje, para no teclear lo mismo veinte veces al día.
 *
 * Vive aquí porque los mismos seis textos estaban escritos DOS veces y en dos
 * formatos distintos: un array de `{ label, text }` en ChatPanel.jsx y una
 * cadena con barras y saltos de línea en los Ajustes del panel. Dos copias que
 * nadie sincroniza son dos copias que se separan.
 *
 * Y ya habían hecho daño. Las dos mandaban a la clienta a `auremgs.com`, un
 * dominio que **no existe** —no está registrado, no resuelve—; el sitio vive
 * en auremgsjoyeria.com. Quien pulsara "Catálogo" o "Talla" le estaba pasando
 * a una clienta un enlace muerto por WhatsApp, y arreglarlo pedía acordarse de
 * los dos sitios.
 *
 * El formato de guardado NO cambia —una línea por respuesta, `etiqueta|texto`—
 * porque ya hay navegadores con respuestas guardadas así y cambiarlo se las
 * borraría.
 */

/* Por navegador, no por cuenta: quien edite sus respuestas las edita para su
   equipo. Cambiar las de fábrica de acá abajo no toca a quien ya guardó las
   suyas; eso se cambia en Ajustes. */
export const CLAVE_RESPUESTAS = 'admin_quick_replies';

/* El sitio es www.auremgsjoyeria.com. Acá va sin www y sin protocolo porque
   esto lo lee una clienta dentro de un WhatsApp, donde lo corto se agradece y
   el enlace se arma solo. El apex redirige al www con un 307 —comprobado—,
   así que funciona igual. */
export const RESPUESTAS_POR_DEFECTO = [
    { label: '📦 En camino', text: 'Tu pedido esta en camino, pronto lo recibiras!' },
    { label: '📋 Catalogo',  text: 'Visita nuestro catalogo completo en auremgsjoyeria.com/catalogo' },
    { label: '🕐 Horario',   text: 'Nuestro horario de atencion es de lunes a sabado, 9am a 6pm.' },
    { label: '💍 Talla',     text: 'Para anillos necesitamos tu talla. Guia: auremgsjoyeria.com/guia-de-tallas' },
    { label: '🙏 Gracias',   text: 'Gracias por tu compra! Esperamos que disfrutes tu pieza.' },
    { label: '⏳ Entrega',   text: 'El tiempo de entrega es de 2-3 dias habiles en Bogota, 3-5 en otras ciudades.' },
];

/** La lista, en el texto que se edita en Ajustes y se guarda en el navegador. */
export const comoTexto = (lista) => lista.map(r => `${r.label}|${r.text}`).join('\n');

/**
 * Lo que este navegador tenga guardado, o lo de fábrica si no hay nada.
 *
 * El try/catch no sobra: un navegador con los datos de sitio bloqueados lanza
 * SecurityError al tocar localStorage, y sin la guardia se cae el panel de
 * chat entero por unos botones de conveniencia.
 */
export function leerRespuestas() {
    let guardado = null;
    try {
        guardado = localStorage.getItem(CLAVE_RESPUESTAS);
    } catch {
        return RESPUESTAS_POR_DEFECTO;
    }
    if (!guardado) return RESPUESTAS_POR_DEFECTO;

    /* El texto puede llevar barras —una URL con parámetros, por ejemplo—, así
       que sólo la primera parte la etiqueta y el resto se vuelve a unir. */
    const lista = guardado
        .split('\n')
        .filter(l => l.includes('|'))
        .map(l => {
            const [etiqueta, ...resto] = l.split('|');
            return { label: etiqueta.trim(), text: resto.join('|').trim() };
        });

    /* Un texto guardado sin ninguna línea válida dejaba cero botones y ninguna
       explicación. Se cae a las de fábrica, igual que cuando no hay nada. */
    return lista.length ? lista : RESPUESTAS_POR_DEFECTO;
}
