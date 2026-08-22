/**
 * Lo que se puede hacer con el archivo de una conversación: leerlo entero,
 * llevárselo, borrarle las fotos, o borrarlo del todo.
 *
 * Vive aquí y no dentro de un componente porque lo usan tres sitios que no se
 * conocen entre sí: el diálogo de eliminar uno, el borrado en lote, y el menú
 * de exportar de la cabecera del chat. Antes cada uno tenía su copia y no
 * hacían lo mismo — la exportación, en concreto, se llevaba sólo los 200
 * mensajes que el panel tenía cargados en pantalla y no lo decía.
 *
 * Regla que atraviesa todo el archivo: **Storage primero, filas después.** Las
 * fotos son lo único que no vive en una tabla; si se borran las filas y falla
 * Storage, quedan archivos huérfanos con la correspondencia de una clienta que
 * nadie va a volver a ver ni a encontrar. Al revés no: un chat sin borrar se
 * vuelve a borrar.
 */
import { supabase } from './supabase';

/* El bucket es privado y guarda una carpeta por teléfono:
   `{telefono}/{mediaId}.jpg`. */
const BUCKET = 'chat-media';

/* Storage lista de a mil como máximo. Ningún hilo real llega, pero un bucle
   que se planta en el primer millar es un bug que sólo aparece el día que sí
   llega, y ese día borra a medias. */
const PAGINA = 1000;

/**
 * Las rutas de todas las fotos que mandó un teléfono.
 *
 * Devuelve `{ rutas }` o `{ error }`; nunca lanza, porque quien llama tiene
 * que poder decidir si sigue o se planta.
 */
async function rutasDeFotos(telefono) {
    const rutas = [];
    for (let pagina = 0; ; pagina++) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(telefono, { limit: PAGINA, offset: pagina * PAGINA });
        if (error) return { error: `no se pudieron leer las fotos (${error.message})` };
        if (!data?.length) break;
        rutas.push(...data.map(a => `${telefono}/${a.name}`));
        if (data.length < PAGINA) break;
    }
    return { rutas };
}

/**
 * Todo lo que cuelga de un número de teléfono en el panel.
 *
 * Las filas se borran en este orden a propósito: el hilo primero, que es lo
 * que se ve. Si algo falla después queda un resto invisible —una etiqueta
 * suelta— y no una conversación a medio borrar.
 */
export async function borrarTodoDe(telefono) {
    const { rutas, error: errorLista } = await rutasDeFotos(telefono);
    if (errorLista) return { error: errorLista };

    if (rutas.length) {
        const { error } = await supabase.storage.from(BUCKET).remove(rutas);
        if (error) return { error: `no se pudieron borrar las fotos (${error.message})` };
    }

    const tablas = [
        ['whatsapp_conversaciones', 'phone_number'],
        ['chat_status', 'phone_number'],
        ['contact_tags', 'phone_number'],
        ['chat_takeover', 'phone_number'],
    ];
    for (const [tabla, columna] of tablas) {
        const { error } = await supabase.from(tabla).delete().eq(columna, telefono);
        if (error) return { error: `${tabla}: ${error.message}` };
    }

    return { fotos: rutas.length };
}

/**
 * Sólo las fotos, conservando lo que se dijeron.
 *
 * Las fotos son lo único que pesa en Storage; el texto de un hilo largo no
 * llega a un par de kilobytes. Esto libera el espacio sin perder el contexto:
 * el pie que escribió la clienta y lo que Valentina entendió de la imagen
 * siguen en la fila, y la burbuja pasa a enseñar un sello de "foto borrada".
 *
 * Se apunta a `message_type = 'image'` en vez de a `media_url is not null`
 * porque volver a pasar por aquí tiene que ser inofensivo: la segunda vez no
 * hay nada que borrar y el update no cambia ninguna fila.
 */
export async function borrarFotosDe(telefono) {
    const { rutas, error: errorLista } = await rutasDeFotos(telefono);
    if (errorLista) return { error: errorLista };

    if (rutas.length) {
        const { error } = await supabase.storage.from(BUCKET).remove(rutas);
        if (error) return { error: `no se pudieron borrar las fotos (${error.message})` };
    }

    const { error } = await supabase
        .from('whatsapp_conversaciones')
        .update({ media_url: null })
        .eq('phone_number', telefono)
        .eq('message_type', 'image');
    if (error) return { error: `no se pudo marcar el hilo (${error.message})` };

    return { fotos: rutas.length };
}

/**
 * El hilo entero, del primer mensaje al último.
 *
 * El panel carga sólo los 200 últimos, que es lo correcto para pintar una
 * pantalla y lo incorrecto para llevarse una copia: un hilo de dos años se
 * exportaba recortado y sin decirlo. Aquí se pagina hasta el final.
 */
export async function traerMensajes(telefono) {
    const mensajes = [];
    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
            .from('whatsapp_conversaciones')
            .select('phone_number, content, role, created_at, message_type')
            .eq('phone_number', telefono)
            .order('created_at', { ascending: true })
            .range(desde, desde + PAGINA - 1);
        if (error) return { error: error.message };
        if (!data?.length) break;
        mensajes.push(...data);
        if (data.length < PAGINA) break;
    }
    return { mensajes };
}

const quien = (m) => (m.role === 'user' ? 'Cliente' : 'Valentina');

/* Una foto que ya se borró sigue siendo un mensaje: en la copia se dice, en
   vez de dejar una línea vacía que no se entiende al releerla. */
const textoDe = (m) => {
    const contenido = String(m.content || '').trim();
    if (contenido) return contenido;
    return m.message_type === 'image' ? '[foto]' : '';
};

const enTxt = (mensajes) => mensajes
    .map(m => `[${new Date(m.created_at).toLocaleString('es-CO')}] ${quien(m)}: ${textoDe(m)}`)
    .join('\n');

const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/* La columna del teléfono va siempre, aunque sea un solo hilo: así dos copias
   descargadas en días distintos se pueden pegar una debajo de otra. */
const enCsv = (mensajes) => {
    const filas = mensajes.map(m => {
        const d = new Date(m.created_at);
        return [
            m.phone_number,
            d.toLocaleDateString('es-CO'),
            d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
            quien(m),
            textoDe(m),
        ].map(celda).join(',');
    });
    return ['Telefono,Fecha,Hora,Remitente,Mensaje', ...filas].join('\n');
};

/**
 * Deja el archivo en la carpeta de descargas.
 *
 * El CSV lleva marca de orden de bytes. Sin ella Excel en Windows abre el
 * archivo como Latin-1 y las tildes salen rotas — y este CSV está lleno de
 * español escrito por clientas.
 */
function descargar(nombre, contenido, tipo) {
    const bom = tipo.startsWith('text/csv') ? '\uFEFF' : '';
    const blob = new Blob([bom + contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
}

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Descarga uno o varios hilos completos.
 *
 * `telefonos` puede ser uno o una lista. El formato por defecto es TXT para un
 * hilo —se lee como una conversación— y CSV en cuanto hay varios, porque un
 * TXT con siete conversaciones pegadas no se lee de ninguna manera útil.
 */
export async function descargarChat(telefonos, formato) {
    const lista = [].concat(telefonos).filter(Boolean);
    if (!lista.length) return { error: 'no hay ninguna conversación que descargar' };

    const tipo = formato || (lista.length > 1 ? 'csv' : 'txt');

    const mensajes = [];
    for (const telefono of lista) {
        const { mensajes: hilo, error } = await traerMensajes(telefono);
        if (error) return { error };
        mensajes.push(...hilo);
    }
    if (!mensajes.length) return { error: 'la conversación está vacía' };

    const nombre = lista.length === 1 ? `chat_${lista[0]}` : `chats_${lista.length}`;

    if (tipo === 'csv') descargar(`${nombre}_${hoy()}.csv`, enCsv(mensajes), 'text/csv;charset=utf-8');
    else descargar(`${nombre}_${hoy()}.txt`, enTxt(mensajes), 'text/plain;charset=utf-8');

    return { mensajes: mensajes.length };
}
